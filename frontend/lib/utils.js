import { ASSET_TYPE_TO_CATEGORY } from './constants';

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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

export function computeCategoryTotals(state) {
  const totals = {};
  state.holdings.forEach((h) => {
    const cat = ASSET_TYPE_TO_CATEGORY[h.assetType] || h.assetType;
    totals[cat] = (totals[cat] || 0) + holdingCurrentValue(h);
  });
  state.otherAssets.forEach((a) => {
    totals[a.category] = (totals[a.category] || 0) + (Number(a.amount) || 0);
  });
  return totals;
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

export function liquidCash(state) {
  return (state.otherAssets || [])
    .filter((a) => a.category === 'Cash')
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

export function avgMonthlyExpense(state, months = 3) {
  const now = new Date();
  const keys = [];
  for (let i = 0; i < months; i++) keys.push(shiftMonthKey(monthKey(now), -i));
  const total = keys.reduce((s, mk) => s + monthTotal(state.expenses, mk), 0);
  return total / months;
}

export function emergencyFundMonths(state) {
  const expense = avgMonthlyExpense(state);
  if (!expense) return 0;
  return liquidCash(state) / expense;
}

// Years-to-financial-independence lookup, by savings rate — same reference
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
  if (savingsRatePct <= 0) return null;
  const sorted = [...FI_TABLE].sort((a, b) => a.rate - b.rate);
  for (const row of sorted) {
    if (savingsRatePct <= row.rate) return row.years;
  }
  return sorted[sorted.length - 1].years;
}

export function recommendedTermCover(annualExpense, netWorthVal) {
  return Math.max(0, annualExpense * 25 - netWorthVal);
}

export function totalInvested(state) {
  const h = state.holdings.reduce((s, x) => s + holdingInvestedValue(x), 0);
  const o = state.otherAssets.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return h + o;
}

export function totalCurrentEquityValue(state) {
  return state.holdings.reduce((s, x) => s + holdingCurrentValue(x), 0);
}

export function totalInvestedEquityValue(state) {
  return state.holdings.reduce((s, x) => s + holdingInvestedValue(x), 0);
}

export function categoryColor(cat) {
  const map = {
    Stocks: '#276B47',
    'Mutual Funds': '#3B4C8C',
    Gold: '#9A3412',
    Cash: '#5C8AA6',
    'Fixed Deposit': '#7A6BAE',
    'Real Estate': '#AE4A2C',
    Other: '#8A8F99',
  };
  if (map[cat]) return map[cat];
  let hash = 0;
  for (const c of cat) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 40% 42%)`;
}

export function dueStatus(dateStr) {
  if (!dateStr) return { cls: 'ok', label: 'No date set' };
  const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (days < 0) return { cls: 'late', label: 'Overdue' };
  if (days <= 30) return { cls: 'soon', label: `Due in ${days}d` };
  return { cls: 'ok', label: 'Active' };
}

export function monthTotal(expenses, mk) {
  return expenses.filter((e) => e.date.slice(0, 7) === mk).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}
