const User = require('../models/User');
const { withUser } = require('./withUser');
const { todayStr } = require('../utils/dates');

/*
 * Free, keyless sources:
 *   STOCKS       -> Yahoo Finance public chart endpoint (unofficial; may change).
 *                   Paste what Google shows ("NSE:GOLDBEES", "DATAPATTNS", "TCS").
 *   MUTUAL FUNDS -> mfapi.in (AMFI data). Leave symbol blank to match by name,
 *                   or type the AMFI scheme code for an exact match.
 *   GOLD         -> manual.
 */

const FETCH_TIMEOUT_MS = 10000;
const MIN_GAP_MS = 250; // be polite to the free APIs
const MAX_PRICE = 1e9;

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.json();
}

function normalizeStockSymbol(raw) {
  let s = String(raw).trim().toUpperCase();
  const m = s.match(/^(NSE|BSE|BOM):(.+)$/);
  let exchange = null;
  if (m) { exchange = m[1]; s = m[2]; }
  if (/\.(NS|BO)$/.test(s)) return s;
  if (exchange === 'BSE' || exchange === 'BOM') return `${s}.BO`;
  return `${s}.NS`;
}

const validPrice = (p) => Number.isFinite(p) && p > 0 && p < MAX_PRICE;

async function fetchStockPrice(symbol) {
  const y = normalizeStockSymbol(symbol);
  const data = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}`, { 'User-Agent': 'Mozilla/5.0' });
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!validPrice(price)) throw new Error(`No valid price for "${y}" - check it is a real NSE/BSE ticker`);
  return price;
}

async function fetchMutualFundNavByCode(code) {
  const data = await getJson(`https://api.mfapi.in/mf/${encodeURIComponent(code)}/latest`);
  const row = data?.data?.[0];
  const nav = parseFloat(row?.nav);
  if (!validPrice(nav)) throw new Error(`No valid NAV for scheme code "${code}"`);
  return { nav, navDate: row?.date || '' };
}

const mfSearchCache = new Map();
const tokens = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3 && !['fund', 'the', 'and', 'plan', 'option'].includes(t));

// Match by name - but ONLY accept schemes whose name contains every
// significant word of the holding's name, so we never price the wrong fund.
async function searchMutualFundCode(name) {
  const key = name.trim().toLowerCase();
  if (mfSearchCache.has(key)) return mfSearchCache.get(key);
  const results = await getJson(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`);
  const want = tokens(name);
  const ok = (Array.isArray(results) ? results : []).filter((r) => {
    const have = String(r.schemeName).toLowerCase();
    return want.length > 0 && want.every((t) => have.includes(t));
  });
  if (!ok.length) throw new Error(`No confident match for "${name}" - enter the AMFI scheme code in the Symbol field`);
  const best = ok.find((r) => /direct/i.test(r.schemeName) && /growth/i.test(r.schemeName))
    || ok.find((r) => /direct/i.test(r.schemeName)) || ok[0];
  const match = { code: String(best.schemeCode), matchedName: best.schemeName };
  mfSearchCache.set(key, match);
  return match;
}

// dd-mm-yyyy -> age in days
function navAgeDays(d) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d || '');
  if (!m) return null;
  return Math.floor((Date.now() - Date.UTC(+m[3], +m[2] - 1, +m[1])) / 86400000);
}

// Network lookup only - no mutation. Returns { price, symbolToStore?, note? }.
async function lookup(h) {
  if (h.assetType === 'Stock') return { price: await fetchStockPrice(h.symbol) };
  const code = h.symbol && /^\d+$/.test(h.symbol.trim()) ? { code: h.symbol.trim(), matchedName: null } : await searchMutualFundCode(h.name);
  const { nav, navDate } = await fetchMutualFundNavByCode(code.code);
  const notes = [];
  if (code.matchedName) notes.push(`Matched: ${code.matchedName}`);
  const age = navAgeDays(navDate);
  if (age !== null && age > 10) notes.push(`NAV is ${age} days old`);
  return { price: nav, symbolToStore: code.code, note: notes.join(' · ') };
}

function applyResult(h, result, err) {
  h.lastSyncedAt = new Date();
  if (err) {
    h.lastSyncStatus = 'failed';
    h.lastSyncMessage = String(err.message || err).slice(0, 200);
    return false;
  }
  const prev = Number(h.currentRate) || 0;
  const notes = result.note ? [result.note] : [];
  if (prev > 0) {
    const move = Math.abs(result.price - prev) / prev * 100;
    if (move > 50) notes.push(`⚠ price moved ${move.toFixed(0)}% - check for a split/bonus`);
  }
  h.currentRate = result.price;
  if (result.symbolToStore && h.symbol !== result.symbolToStore) h.symbol = result.symbolToStore;
  h.lastSyncStatus = 'ok';
  h.lastSyncMessage = notes.join(' · ').slice(0, 300); // success clears any stale error
  h.updatedAt = todayStr();
  return true;
}

const eligible = (h) => h.autoSync && h.assetType !== 'Gold' && !(h.assetType === 'Stock' && !h.symbol);

// Used by the "Sync now" button.
async function syncHolding(h) {
  if (h.assetType === 'Gold') { h.lastSyncStatus = 'no-symbol'; return false; }
  if (!h.autoSync) return false;
  if (h.assetType === 'Stock' && !h.symbol) { h.lastSyncStatus = 'no-symbol'; return false; }
  try { return applyResult(h, await lookup(h)); } catch (e) { return applyResult(h, null, e); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nightly job. Fetch prices FIRST (slow, network), then apply them to a fresh
// copy of each user's document (fast) so we never overwrite concurrent edits.
async function syncAllUsers() {
  const cache = new Map();
  let updated = 0; let attempted = 0; let users = 0;
  const cursor = User.find({ 'holdings.0': { $exists: true } }).select('_id').lean().cursor();

  for await (const { _id } of cursor) {
    users += 1;
    const snapshot = await User.findById(_id).select('holdings.name holdings.symbol holdings.assetType holdings.autoSync').lean();
    const results = new Map();
    for (const h of snapshot?.holdings || []) {
      if (!eligible(h)) continue;
      attempted += 1;
      const key = `${h.assetType}|${h.assetType === 'Stock' ? h.symbol : (h.symbol || h.name)}`.toLowerCase();
      if (!cache.has(key)) {
        try { cache.set(key, { result: await lookup(h) }); } catch (e) { cache.set(key, { err: e }); }
        await sleep(MIN_GAP_MS);
      }
      results.set(String(h._id), cache.get(key));
    }
    if (!results.size) continue;
    await withUser(_id, (user) => {
      for (const h of user.holdings) {
        const r = results.get(String(h._id));
        if (r && applyResult(h, r.result, r.err)) updated += 1;
      }
    }).catch((e) => console.error('[priceSync] user failed:', e.message));
  }
  console.log(`[priceSync] ${updated}/${attempted} holding(s) updated across ${users} user(s).`);
  return { updated, attempted, users };
}

module.exports = { syncAllUsers, syncHolding, fetchStockPrice, normalizeStockSymbol, searchMutualFundCode };
