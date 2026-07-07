const User = require('../models/User');

/*
 * Two free, keyless sources, chosen after real-world testing:
 *
 *   STOCKS       -> Yahoo Finance's public quote endpoint. You paste EXACTLY
 *                   what Google's finance card shows you under the name —
 *                   e.g. "NSE:GOLDBEES", "DATAPATTNS", "TCS", "RELIANCE.NS" —
 *                   and normalizeStockSymbol() below converts it to what
 *                   Yahoo expects (strips an "NSE:"/"BSE:"/"BOM:" prefix,
 *                   adds ".NS" if there's no suffix at all, ".BO" if you
 *                   wrote "BSE:" or "BOM:"). No manual format conversion
 *                   needed on your end.
 *
 *   MUTUAL FUNDS -> mfapi.in — a free, keyless API built specifically to
 *                   serve India's AMFI mutual fund data reliably (AMFI's own
 *                   raw file can be flaky to hit directly, confirmed in
 *                   testing). Two ways to use it:
 *                     1. Leave the symbol blank -> we search mfapi.in by the
 *                        holding's NAME and use the best match. The scheme
 *                        code it finds gets cached onto the holding so every
 *                        sync after the first is a single direct lookup.
 *                     2. Or type the AMFI scheme code yourself (a plain
 *                        number, e.g. "122639") for an exact, immediate match.
 *                   The Google-style slug codes (e.g. "PARA_PARI_FLEX_1W4KC")
 *                   aren't a public lookup key anywhere, so they're not used
 *                   directly — but you don't need them: leaving the field
 *                   blank and letting the name-search resolve it does the
 *                   same job.
 *
 *   GOLD         -> no equivalent free, reliable, keyless daily source
 *                   exists — stays manual, update it by hand when you check
 *                   a rate.
 */

function normalizeStockSymbol(raw) {
  let s = String(raw).trim().toUpperCase();
  // Strip a Google-style "EXCHANGE:" prefix if present.
  const prefixMatch = s.match(/^(NSE|BSE|BOM):(.+)$/);
  let exchange = null;
  if (prefixMatch) {
    exchange = prefixMatch[1];
    s = prefixMatch[2];
  }
  // Already has a Yahoo-style suffix -> use as-is.
  if (/\.(NS|BO)$/.test(s)) return s;
  if (exchange === 'BSE' || exchange === 'BOM') return `${s}.BO`;
  return `${s}.NS`; // default assumption: NSE, the common case
}

async function fetchStockPrice(symbol) {
  const yahooSymbol = normalizeStockSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for "${yahooSymbol}"`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!Number.isFinite(price)) throw new Error(`No price found for "${yahooSymbol}" — check the symbol is a valid NSE/BSE ticker`);
  return price;
}

async function fetchMutualFundNavByCode(schemeCode) {
  const res = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`);
  if (!res.ok) throw new Error(`mfapi.in returned ${res.status} for scheme code "${schemeCode}"`);
  const data = await res.json();
  const nav = parseFloat(data?.data?.[0]?.nav);
  if (!Number.isFinite(nav)) throw new Error(`No NAV found for scheme code "${schemeCode}"`);
  return nav;
}

// Cached in-memory for the life of the process — search results don't change
// often enough to justify hitting mfapi.in's search endpoint every sync.
const mfSearchCache = new Map();

async function searchMutualFundCode(name) {
  const key = name.trim().toLowerCase();
  if (mfSearchCache.has(key)) return mfSearchCache.get(key);

  const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`mfapi.in search returned ${res.status}`);
  const results = await res.json();
  if (!Array.isArray(results) || !results.length) {
    throw new Error(`No mutual fund matching "${name}" found on mfapi.in — try adding the AMFI scheme code directly instead`);
  }

  // Prefer a "Direct Growth" match if one exists (the common choice for
  // self-directed investors); otherwise take the first result.
  const preferred =
    results.find((r) => /direct/i.test(r.schemeName) && /growth/i.test(r.schemeName)) ||
    results.find((r) => /direct/i.test(r.schemeName)) ||
    results[0];

  const match = { code: preferred.schemeCode, matchedName: preferred.schemeName };
  mfSearchCache.set(key, match);
  return match;
}

async function fetchMutualFundNav(holding) {
  // A plain number typed into the symbol field is treated as a known AMFI
  // scheme code -> direct, exact lookup.
  if (holding.symbol && /^\d+$/.test(holding.symbol.trim())) {
    return { nav: await fetchMutualFundNavByCode(holding.symbol.trim()), resolvedCode: holding.symbol.trim(), matchedName: null };
  }
  // Otherwise search by name (ignoring any non-numeric "symbol" text someone
  // pasted, like a Google MUTF_IN slug, since that's not a lookup key mfapi
  // understands) and cache the resolved code for next time.
  const { code, matchedName } = await searchMutualFundCode(holding.name);
  return { nav: await fetchMutualFundNavByCode(code), resolvedCode: code, matchedName };
}

async function syncHolding(holding) {
  if (!holding.autoSync || holding.assetType === 'Gold') {
    if (holding.assetType === 'Gold') holding.lastSyncStatus = 'no-symbol';
    return false;
  }
  try {
    if (holding.assetType === 'Stock') {
      if (!holding.symbol) {
        holding.lastSyncStatus = 'no-symbol';
        return false;
      }
      holding.currentRate = await fetchStockPrice(holding.symbol);
    } else {
      const { nav, resolvedCode, matchedName } = await fetchMutualFundNav(holding);
      holding.currentRate = nav;
      if (resolvedCode && holding.symbol !== resolvedCode) {
        holding.symbol = resolvedCode; // cache it so future syncs skip the search
        holding.lastSyncMessage = matchedName ? `Matched: ${matchedName}` : '';
      }
    }
    holding.lastSyncedAt = new Date();
    holding.lastSyncStatus = 'ok';
    if (!holding.lastSyncMessage) holding.lastSyncMessage = '';
    holding.updatedAt = new Date().toISOString().slice(0, 10);
    return true;
  } catch (err) {
    holding.lastSyncStatus = 'failed';
    holding.lastSyncMessage = err.message.slice(0, 200);
    holding.lastSyncedAt = new Date();
    return false;
  }
}

async function syncAllUsers() {
  const users = await User.find({ 'holdings.0': { $exists: true } });
  let updated = 0;
  let attempted = 0;

  for (const user of users) {
    let changed = false;
    for (const holding of user.holdings) {
      if (!holding.autoSync || holding.assetType === 'Gold') continue;
      if (holding.assetType === 'Stock' && !holding.symbol) continue;
      attempted += 1;
      const ok = await syncHolding(holding);
      if (ok) updated += 1;
      changed = true;
    }
    if (changed) await user.save();
  }

  console.log(`[priceSync] ${updated}/${attempted} holding(s) updated across ${users.length} user(s).`);
  return { updated, attempted, users: users.length };
}

module.exports = { syncAllUsers, syncHolding, fetchStockPrice, fetchMutualFundNav, normalizeStockSymbol };
