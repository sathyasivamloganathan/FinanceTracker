// Single source of truth for portfolio / net-worth maths on the server.
// (frontend/lib/utils.js mirrors these definitions exactly.)
const { round2 } = require('./money');
const { daysBetween } = require('./dates');

const ASSET_TYPE_TO_CATEGORY = { Stock: 'Stocks', 'Mutual Fund': 'Mutual Funds', Gold: 'Gold' };
const COMPOUNDING_PER_YEAR = { Monthly: 12, Quarterly: 4, 'Half-yearly': 2, Yearly: 1 };

const holdingInvestedValue = (h) => (Number(h.qty) || 0) * (Number(h.avgRate) || 0);
const holdingCurrentValue = (h) => (Number(h.qty) || 0) * (Number(h.currentRate) || 0);

// Value of a principal after `days` at a nominal annual rate (percent).
// 'On maturity' (and unknown) = simple interest; others compound n times a year.
function fdValueAfterDays(principal, ratePct, days, compounding) {
  const p = Number(principal) || 0;
  const r = (Number(ratePct) || 0) / 100;
  const years = Math.max(0, days) / 365;
  const n = COMPOUNDING_PER_YEAR[compounding];
  const v = n ? p * Math.pow(1 + r / n, n * years) : p * (1 + r * years);
  return round2(v);
}

function calcMaturity(principal, ratePct, startDate, maturityDate, compounding) {
  return fdValueAfterDays(principal, ratePct, daysBetween(startDate, maturityDate), compounding);
}

// What an active FD is worth today (accrued), never above its maturity value.
function fdAccruedValue(fd, today) {
  const total = Math.max(0, daysBetween(fd.startDate, fd.maturityDate));
  const elapsed = Math.min(Math.max(0, daysBetween(fd.startDate, today)), total);
  const v = fdValueAfterDays(fd.principal, fd.interestRate, elapsed, fd.compounding);
  const cap = Number(fd.maturityAmount) > 0 ? Number(fd.maturityAmount) : Infinity;
  return Math.min(v, cap);
}

function computeCategoryTotals(user, today) {
  const totals = {};
  const add = (k, v) => { totals[k] = (totals[k] || 0) + v; };
  (user.holdings || []).forEach((h) => add(ASSET_TYPE_TO_CATEGORY[h.assetType] || h.assetType, holdingCurrentValue(h)));
  (user.otherAssets || []).forEach((a) => add(a.category, Number(a.amount) || 0));
  const fdTotal = (user.fds || []).filter((f) => f.status === 'active').reduce((s, f) => s + fdAccruedValue(f, today), 0);
  if (fdTotal) add('Fixed Deposits', fdTotal);
  const bankTotal = (user.bankAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  if (bankTotal) add('Bank Accounts', bankTotal); // overdrafts reduce net worth
  Object.keys(totals).forEach((k) => { totals[k] = round2(totals[k]); });
  return totals;
}

function computeNetWorth(user, today) {
  const breakdown = computeCategoryTotals(user, today);
  const grossAssets = round2(Object.values(breakdown).reduce((a, b) => a + b, 0));
  const totalLiabilities = round2((user.liabilities || []).reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const invested = round2((user.holdings || []).reduce((s, h) => s + holdingInvestedValue(h), 0));
  return { netWorth: round2(grossAssets - totalLiabilities), grossAssets, totalLiabilities, invested, breakdown };
}

module.exports = {
  ASSET_TYPE_TO_CATEGORY, holdingInvestedValue, holdingCurrentValue,
  calcMaturity, fdValueAfterDays, fdAccruedValue, computeCategoryTotals, computeNetWorth,
};
