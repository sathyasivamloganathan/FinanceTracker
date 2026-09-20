const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { holdingInvestedValue } = require('../utils/financeMath');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { date, type, assetType, name, symbol, qty, price, amount, notes } = req.body || {};
    if (!name || !type || !assetType) return res.status(400).json({ error: 'name, type and assetType are required' });
    const qtyNum = Number(qty);
    const priceNum = Number(price);
    if (!(qtyNum > 0) || !(priceNum > 0)) return res.status(400).json({ error: 'qty and price must be positive numbers' });
    const amountNum = Number(amount) || qtyNum * priceNum;
    const txDate = date || new Date().toISOString().slice(0, 10);

    req.user.transactions.push({
      date: txDate,
      type,
      assetType,
      name: String(name).trim(),
      symbol: symbol ? String(symbol).trim().toUpperCase() : '',
      qty: qtyNum,
      price: priceNum,
      amount: amountNum,
      notes: notes ? String(notes).trim() : '',
    });

    // This is the ONE consolidation path: buying/selling something with the
    // same name + type always merges into a single holding (weighted-average
    // cost on Buy), instead of creating duplicate rows.
    const holding = req.user.holdings.find(
      (h) => h.name.toLowerCase() === String(name).trim().toLowerCase() && h.assetType === assetType
    );

    if (type === 'Buy') {
      if (holding) {
        const totalCost = holdingInvestedValue(holding) + amountNum;
        const newQty = Number(holding.qty) + qtyNum;
        holding.qty = newQty;
        holding.avgRate = newQty ? totalCost / newQty : 0;
        holding.currentRate = priceNum; // best guess until you update it manually
        holding.updatedAt = txDate;
        if (symbol && !holding.symbol) holding.symbol = String(symbol).trim().toUpperCase();
      } else {
        req.user.holdings.push({
          name: String(name).trim(),
          symbol: symbol ? String(symbol).trim().toUpperCase() : '',
          assetType,
          qty: qtyNum,
          avgRate: priceNum,
          currentRate: priceNum,
          updatedAt: txDate,
        });
      }
    } else if (type === 'Sell' && holding) {
      holding.qty = Math.max(0, Number(holding.qty) - qtyNum);
      holding.updatedAt = txDate;
    }

    await req.user.save();
    res.status(201).json({ transactions: serializeList(req.user.transactions), holdings: serializeList(req.user.holdings) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const tx = req.user.transactions.id(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    const { date, qty, price, amount, notes } = req.body || {};
    // Note: editing a transaction does NOT retroactively recompute the
    // holding's average rate (that would require replaying every transaction
    // in order). Delete and re-add if a correction needs to change your
    // consolidated average.
    if (date) tx.date = date;
    if (qty !== undefined) tx.qty = Number(qty) || tx.qty;
    if (price !== undefined) tx.price = Number(price) || tx.price;
    if (amount !== undefined) tx.amount = Number(amount) || tx.amount;
    if (notes !== undefined) tx.notes = String(notes).trim();
    await req.user.save();
    res.json({ transactions: serializeList(req.user.transactions) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.transactions.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ transactions: serializeList(req.user.transactions) });
  })
);

module.exports = router;
