const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { toCsv, sendCsv } = require('../utils/csv');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');

const router = express.Router();

router.get(
  '/holdings.csv',
  asyncHandler(async (req, res) => {
    const rows = req.user.holdings.map((h) => ({
      name: h.name,
      symbol: h.symbol,
      assetType: h.assetType,
      qty: h.qty,
      avgRate: h.avgRate,
      currentRate: h.currentRate,
      invested: holdingInvestedValue(h),
      currentValue: holdingCurrentValue(h),
      pl: holdingCurrentValue(h) - holdingInvestedValue(h),
      lastSyncStatus: h.lastSyncStatus,
      lastSyncedAt: h.lastSyncedAt ? h.lastSyncedAt.toISOString() : '',
      updatedAt: h.updatedAt,
    }));
    const csv = toCsv(rows, [
      { label: 'Name', value: 'name' },
      { label: 'Symbol', value: 'symbol' },
      { label: 'Type', value: 'assetType' },
      { label: 'Quantity', value: 'qty' },
      { label: 'Avg Rate', value: 'avgRate' },
      { label: 'Current Rate', value: 'currentRate' },
      { label: 'Invested', value: 'invested' },
      { label: 'Current Value', value: 'currentValue' },
      { label: 'P/L', value: 'pl' },
      { label: 'Sync Status', value: 'lastSyncStatus' },
      { label: 'Last Synced At', value: 'lastSyncedAt' },
      { label: 'Updated', value: 'updatedAt' },
    ]);
    sendCsv(res, `holdings-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  })
);

router.get(
  '/transactions.csv',
  asyncHandler(async (req, res) => {
    const rows = [...req.user.transactions].sort((a, b) => a.date.localeCompare(b.date));
    const csv = toCsv(rows, [
      { label: 'Date', value: 'date' },
      { label: 'Type', value: 'type' },
      { label: 'Instrument', value: 'name' },
      { label: 'Symbol', value: 'symbol' },
      { label: 'Asset Type', value: 'assetType' },
      { label: 'Quantity', value: 'qty' },
      { label: 'Price', value: 'price' },
      { label: 'Amount', value: 'amount' },
      { label: 'Notes', value: 'notes' },
    ]);
    sendCsv(res, `transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  })
);

router.get(
  '/expenses.csv',
  asyncHandler(async (req, res) => {
    const { scope = 'all', month, year } = req.query;
    let rows = [...req.user.expenses];
    let label = 'all';

    if (scope === 'month' && month) {
      rows = rows.filter((e) => e.date.slice(0, 7) === month);
      label = month;
    } else if (scope === 'year' && year) {
      rows = rows.filter((e) => e.date.slice(0, 4) === String(year));
      label = String(year);
    }

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const csv = toCsv(rows, [
      { label: 'Date', value: 'date' },
      { label: 'Category', value: 'category' },
      { label: 'Description', value: 'description' },
      { label: 'Amount', value: 'amount' },
    ]);
    sendCsv(res, `daily-spends-${label}.csv`, csv);
  })
);

module.exports = router;
