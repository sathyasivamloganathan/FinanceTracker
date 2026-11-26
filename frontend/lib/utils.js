import { ASSET_TYPE_TO_CATEGORY } from './constants';

// Today's date in the USER'S local calendar (not UTC): between midnight and
// 05:30 in India, toISOString() would still say "yesterday".
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDateStr = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export function addMonthsClamped(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ty = Math.floor(total / 12); const tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
export function addDaysStr(s, n) { return new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10); }

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function shiftMonthKey(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function fmtINR(n, decimals = 0) {
  const v = Number(n) || 0;
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function fmtNum(n, decimals = 2) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export function fmtPct(n) {
  const v = Number(n) || 0;
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export function holdingInvestedValue(h) {
  return (Number(h.qty) || 0) * (Number(h.avgRate) || 0);
}

export function holdingCurrentValue(h) {
  return (Number(h.qty) || 0) * (Number(h.currentRate) || 0);
}

const FD_COMPOUNDING_N = { Monthly: 12, Quarterly: 4, 'Half-yearly': 2, Yearly: 1 };

// Value of an FD after `days` - identical to the server's calculation.
export function fdValueAfterDays(principal, ratePct, days, compounding) {
  const p = Number(principal) || 0;
  const r = (Number(ratePct) || 0) / 100;
  const years = Math.max(0, days) / 365;
  const n = FD_COMPOUNDING_N[compounding];
  const v = n ? p * Math.pow(1 + r / n, n * years) : p * (1 + r * years);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
export function calcMaturity(principal, ratePct, startDate, maturityDate, compounding) {
  if (!isDateStr(startDate) || !isDateStr(maturityDate)) return Number(principal) || 0;
  return fdValueAfterDays(principal, ratePct, daysBetween(startDate, maturityDate), compounding);
}
// What an active FD is worth today (accrued), capped at its maturity value.
export function fdAccruedValue(fd, today = todayStr()) {
  if (!isDateStr(fd.startDate) || !isDateStr(fd.maturityDate)) return Number(fd.principal) || 0;
  const total = Math.max(0, daysBetween(fd.startDate, fd.maturityDate));
  const elapsed = Math.min(Math.max(0, daysBetween(fd.startDate, today)), total);
  const v = fdValueAfterDays(fd.principal, fd.interestRate, elapsed, fd.compounding);
  return Number(fd.maturityAmount) > 0 ? Math.min(v, Number(fd.maturityAmount)) : v;
}

// Same definition as the server (backend/src/utils/financeMath.js):
// holdings at market value + other assets + ACCRUED active FDs + bank balances
// (overdrafts count as negative).
export function computeCategoryTotals(state) {
  const totals = {};
  const add = (k, v) => { totals[k] = (totals[k] || 0) + v; };
  (state.holdings || []).forEach((h) => add(ASSET_TYPE_TO_CATEGORY[h.assetType] || h.assetType, holdingCurrentValue(h)));
  (state.otherAssets || []).forEach((a) => add(a.category, Number(a.amount) || 0));
  const today = todayStr();
  const fdTotal = (state.fds || []).filter((fd) => fd.status === 'active').reduce((s, fd) => s + fdAccruedValue(fd, today), 0);
  if (fdTotal) add('Fixed Deposits', fdTotal);
  const bankTotal = (state.bankAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  if (bankTotal) add('Bank Accounts', bankTotal);
  return totals;
}

// Map a category onto the user's allocation-target buckets so cash-like
// things (bank accounts, FDs, cash) are compared with the "Cash" target.
const CASH_LIKE = ['Bank Accounts', 'Fixed Deposits', 'Fixed Deposit', 'Cash'];
export function allocationBucket(cat, targets = {}) {
  if (cat in targets) return cat;
  if (CASH_LIKE.includes(cat) && 'Cash' in targets) return 'Cash';
  if ('Other' in targets) return 'Other';
  return cat;
}
// Percentages are of GROSS assets (what targets are expressed in), not net worth.
export function allocationTotals(state) {
  const targets = state.targets || {};
  const buckets = {};
  Object.entries(computeCategoryTotals(state)).forEach(([cat, v]) => {
    const b = allocationBucket(cat, targets);
    buckets[b] = (buckets[b] || 0) + v;
  });
  const gross = Object.values(buckets).reduce((a, b) => a + b, 0);
  return { buckets, gross };
}

export function totalLiabilities(state) {
  return (state.liabilities || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

export function grossAssets(state) {
  return Object.values(computeCategoryTotals(state)).reduce((a, b) => a + b, 0);
}

export function netWorth(state) {
  return grossAssets(state) - totalLiabilities(state);
}

export function debtRatio(state) {
  const assets = grossAssets(state);
  return assets ? (totalLiabilities(state) / assets) * 100 : 0;
}

// Cash you can reach quickly: cash holdings + positive bank balances.
export function liquidCash(state) {
  const cash = (state.otherAssets || []).filter((a) => a.category === 'Cash').reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const bank = (state.bankAccounts || []).reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
  return cash + bank;
}

// Average monthly SPENDING over the last `months` COMPLETE months that have
// data. The current, partly-filled month is only used when nothing else exists.
export function avgMonthlyExpense(state, months = 3) {
  const nowKey = monthKey(new Date());
  const keys = [];
  for (let i = 1; i <= months; i++) keys.push(shiftMonthKey(nowKey, -i));
  const withData = keys.map((mk) => monthTotal(state.expenses || [], mk)).filter((t) => t > 0);
  if (withData.length) return withData.reduce((a, b) => a + b, 0) / withData.length;
  return monthTotal(state.expenses || [], nowKey);
}

export function emergencyFundMonths(state) {
  const expense = avgMonthlyExpense(state);
  if (!expense) return 0;
  return liquidCash(state) / expense;
}

// Years-to-financial-independence lookup, by savings rate - same reference
// table shape as common FIRE calculators (25x annual expenses target).
export const FI_TABLE = [
  { rate: 10, years: 51 },
  { rate: 20, years: 37 },
  { rate: 30, years: 28 },
  { rate: 40, years: 22 },
  { rate: 50, years: 17 },
  { rate: 60, years: 12.5 },
  { rate: 70, years: 8.5 },
  { rate: 80, years: 5.5 },
  { rate: 90, years: 3 },
];

export function yearsToFI(savingsRatePct) {
  if (!(savingsRatePct > 0)) return null;
  const rows = [...FI_TABLE].sort((a, b) => a.rate - b.rate);
  if (savingsRatePct <= rows[0].rate) return rows[0].years; // below the table: best known bound
  if (savingsRatePct >= rows[rows.length - 1].rate) return rows[rows.length - 1].years;
  for (let i = 1; i < rows.length; i++) {
    if (savingsRatePct <= rows[i].rate) {
      const a = rows[i - 1]; const b = rows[i];
      const t = (savingsRatePct - a.rate) / (b.rate - a.rate);
      return a.years + t * (b.years - a.years); // interpolate instead of jumping to the next bucket
    }
  }
  return rows[rows.length - 1].years;
}

export function ageFromDOB(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function yearsToRetirement(dob, retirementAge = 60) {
  const age = ageFromDOB(dob);
  if (age === null) return null;
  return Math.max(0, retirementAge - age);
}

// Rule of thumb for life cover: ~10x annual income, plus outstanding loans,
// minus assets you already hold. (25x expenses is the retirement-corpus rule,
// not an insurance rule.)
export function recommendedTermCover(annualIncome, liabilities, grossAssetsVal) {
  if (!(annualIncome > 0)) return null;
  return Math.max(0, annualIncome * 10 + (Number(liabilities) || 0) - (Number(grossAssetsVal) || 0));
}

// Amount put into market holdings (cost basis) - matches the server's `invested`.
export function totalInvested(state) {
  return (state.holdings || []).reduce((s, x) => s + holdingInvestedValue(x), 0);
}

export function totalCurrentEquityValue(state) {
  return state.holdings.reduce((s, x) => s + holdingCurrentValue(x), 0);
}

export function totalInvestedEquityValue(state) {
  return state.holdings.reduce((s, x) => s + holdingInvestedValue(x), 0);
}

export function categoryColor(cat) {
  const map = {
    Stocks: "#059669",
    "Mutual Funds": "#2563EB",
    Gold: "#9A3412",
    Cash: "#a544e1",
    "Fixed Deposit": "#7C3AED",
    "Fixed Deposits": "#7C3AED",
    "Bank Accounts": "#0891B2",
    "Real Estate": "#DC2626",
    Other: "#6B7280",
  };
  if (map[cat]) return map[cat];
  let hash = 0;
  for (const c of cat) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 40% 42%)`;
}

// Next date a bill falls due, rolling recurring premiums forward past old dates.
export function nextDueDate(dateStr, frequency, today = todayStr()) {
  if (!isDateStr(dateStr)) return null;
  if (dateStr >= today) return dateStr;
  const step = { Yearly: 12, 'Half-yearly': 6, Quarterly: 3, Monthly: 1 }[frequency];
  if (!step) return dateStr; // one-time (or unknown): stays in the past
  for (let k = 1; k < 2000; k++) {
    const d = addMonthsClamped(dateStr, step * k);
    if (d >= today) return d;
  }
  return dateStr;
}

export function dueStatus(dateStr, frequency) {
  if (!dateStr) return { cls: 'ok', label: 'No date set' };
  if (!isDateStr(dateStr)) return { cls: 'ok', label: 'Invalid date' };
  const today = todayStr();
  const next = nextDueDate(dateStr, frequency, today);
  const days = daysBetween(today, next);
  if (days < 0) return { cls: 'late', label: 'Overdue' };
  if (days === 0) return { cls: 'soon', label: 'Due today' };
  if (days <= 30) return { cls: 'soon', label: `Due in ${days}d` };
  return { cls: 'ok', label: 'Active' };
}

export function confirmDelete(message = 'Delete this? This cannot be undone.') {
  return typeof window !== 'undefined' && window.confirm(message);
}

// SPENDING in a month. Income, transfers between your own accounts and ATM
// withdrawals are not spending and are excluded.
export const isSpend = (e) => (e.expenseType || 'expense') === 'expense';
export function monthTotal(expenses, mk) {
  return (expenses || []).filter((e) => isSpend(e) && e.date.slice(0, 7) === mk).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

// ---- recurring schedules (mirrors backend/src/utils/dates.js) ----
const RECURRING_STEP = { daily: { days: 1 }, weekly: { days: 7 }, fortnightly: { days: 14 }, monthly: { months: 1 }, quarterly: { months: 3 }, yearly: { months: 12 } };

// k-th occurrence counted from the ORIGINAL start date (so 31 Jan → 28 Feb → 31 Mar, no drift).
export function recurringOccurrence(startDate, frequency, k) {
  const f = RECURRING_STEP[frequency];
  if (!f || !isDateStr(startDate)) return null;
  return f.days ? addDaysStr(startDate, f.days * k) : addMonthsClamped(startDate, f.months * k);
}

// The next date this template will create an entry for (the start date itself counts).
export function nextRecurringDate(r) {
  for (let k = 0; k < 20000; k++) {
    const d = recurringOccurrence(r.startDate, r.frequency, k);
    if (!d) return null;
    if (r.endDate && d > r.endDate) return null;
    if (!r.lastGeneratedDate || d > r.lastGeneratedDate) return d;
  }
  return null;
}

// Entries created by older versions had "[recurring:<id>]" appended to the description.
export const cleanDescription = (d) => String(d || '').replace(/\s*\[recurring:[a-f0-9]{24}\]/gi, '').trim();
