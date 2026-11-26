const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { toCsv, sendCsv } = require('../utils/csv');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');
const { todayStr } = require('../utils/dates');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();

router.get('/holdings.csv', asyncHandler(async (req, res) => {
  const rows = req.user.holdings.map((h) => ({
    ...h.toObject(),
    invested: round2(holdingInvestedValue(h)),
    currentValue: round2(holdingCurrentValue(h)),
    pl: round2(holdingCurrentValue(h) - holdingInvestedValue(h)),
    lastSyncedAt: h.lastSyncedAt ? h.lastSyncedAt.toISOString() : '',
  }));
  sendCsv(res, `holdings-${todayStr()}.csv`, toCsv(rows, [
    { label: 'Name', value: 'name' }, { label: 'Symbol', value: 'symbol' }, { label: 'Type', value: 'assetType' },
    { label: 'Quantity', value: 'qty' }, { label: 'Avg Rate', value: 'avgRate' }, { label: 'Current Rate', value: 'currentRate' },
    { label: 'Invested', value: 'invested' }, { label: 'Current Value', value: 'currentValue' }, { label: 'P/L', value: 'pl' },
    { label: 'Sync Status', value: 'lastSyncStatus' }, { label: 'Last Synced At', value: 'lastSyncedAt' }, { label: 'Updated', value: 'updatedAt' },
  ]));
}));

router.get('/transactions.csv', asyncHandler(async (req, res) => {
  const rows = [...req.user.transactions].sort((a, b) => a.date.localeCompare(b.date));
  sendCsv(res, `transactions-${todayStr()}.csv`, toCsv(rows, [
    { label: 'Date', value: 'date' }, { label: 'Type', value: 'type' }, { label: 'Instrument', value: 'name' },
    { label: 'Symbol', value: 'symbol' }, { label: 'Asset Type', value: 'assetType' }, { label: 'Quantity', value: 'qty' },
    { label: 'Price', value: 'price' }, { label: 'Amount', value: 'amount' }, { label: 'Notes', value: 'notes' },
  ]));
}));

router.get('/expenses.csv', asyncHandler(async (req, res) => {
  const scope = V.oneOf(typeof req.query.scope === 'string' ? req.query.scope : undefined, ['all', 'month', 'year'], { field: 'scope', fallback: 'all' });
  let rows = [...req.user.expenses];
  let label = 'all';
  if (scope === 'month') {
    const month = V.monthKey(req.query.month, 'month');
    rows = rows.filter((e) => e.date.slice(0, 7) === month); label = month;
  } else if (scope === 'year') {
    const year = String(req.query.year || '');
    if (!/^\d{4}$/.test(year)) throw V.bad('year must be YYYY');
    rows = rows.filter((e) => e.date.slice(0, 4) === year); label = year;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const nameOf = (id) => req.user.bankAccounts.id(id)?.name || '';
  sendCsv(res, `daily-spends-${label}.csv`, toCsv(rows, [
    { label: 'Date', value: 'date' }, { label: 'Type', value: (e) => e.expenseType || 'expense' },
    { label: 'Category', value: 'category' }, { label: 'Description', value: 'description' },
    { label: 'Amount', value: 'amount' }, { label: 'Account', value: (e) => nameOf(e.accountId) },
    { label: 'To account', value: (e) => nameOf(e.transferToAccountId) }, { label: 'Notes', value: 'notes' },
  ]));
}));

// Full data export (portability / backup).
router.get('/all.json', asyncHandler(async (req, res) => {
  const { id, ...data } = req.user.toSafeJSON();
  res.setHeader('Content-Disposition', `attachment; filename="FinanceTracer-export-${todayStr()}.json"`);
  res.json({ exportedAt: new Date().toISOString(), ...data });
}));

module.exports = router;
