// Holding quantity / average-cost bookkeeping driven by transactions.
// Edits and deletes REVERSE the old transaction before applying the new one,
// so the holding always agrees with the ledger (and legacy data keeps working,
// because we apply deltas rather than replaying from scratch).
const { EPS } = require('./money');
const r6 = (n) => Math.round(n * 1e6) / 1e6; // quantities / unit rates: 6 decimals
const { HttpError } = require('./validate');

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const findHolding = (user, name, assetType) =>
  user.holdings.find((h) => sameName(h.name, name) && h.assetType === assetType);

// Apply a transaction to holdings. Throws HttpError on invalid sells.
function applyTx(user, tx, { today } = {}) {
  const qty = Number(tx.qty); const amount = Number(tx.amount); const price = Number(tx.price);
  let h = findHolding(user, tx.name, tx.assetType);
  if (tx.type === 'Buy') {
    if (!h) {
      user.holdings.push({
        name: tx.name, symbol: (tx.symbol || '').toUpperCase(), assetType: tx.assetType,
        qty: 0, avgRate: 0, currentRate: price, autoSync: true, updatedAt: today,
      });
      h = user.holdings[user.holdings.length - 1];
    }
    const cost = (Number(h.qty) || 0) * (Number(h.avgRate) || 0) + amount;
    const newQty = (Number(h.qty) || 0) + qty;
    h.qty = newQty;
    h.avgRate = newQty > 0 ? r6(cost / newQty) : 0;
    if (!(Number(h.currentRate) > 0)) h.currentRate = price; // never overwrite a live price
    if (!h.symbol && tx.symbol) h.symbol = tx.symbol.toUpperCase();
    h.updatedAt = today;
  } else {
    if (!h) throw new HttpError(409, `You don't hold "${tx.name}" - nothing to sell`);
    if (qty > (Number(h.qty) || 0) + EPS) {
      throw new HttpError(409, `Cannot sell ${qty} of "${tx.name}" - only ${h.qty} held`);
    }
    h.qty = Math.max(0, r6((Number(h.qty) || 0) - qty));
    h.updatedAt = today; // average cost is unchanged by a sale
  }
}

// Undo a previously-applied transaction.
function reverseTx(user, tx, { today } = {}) {
  const qty = Number(tx.qty); const amount = Number(tx.amount);
  const h = findHolding(user, tx.name, tx.assetType);
  if (!h) return; // holding was removed by the user; nothing to undo
  if (tx.type === 'Buy') {
    const newQty = (Number(h.qty) || 0) - qty;
    if (newQty < -EPS) {
      throw new HttpError(409, `Cannot remove this buy: later sells of "${tx.name}" depend on it. Remove or edit those sells first.`);
    }
    const cost = Math.max(0, (Number(h.qty) || 0) * (Number(h.avgRate) || 0) - amount);
    h.qty = Math.max(0, newQty);
    h.avgRate = h.qty > 0 ? r6(cost / h.qty) : h.avgRate;
  } else {
    h.qty = (Number(h.qty) || 0) + qty;
  }
  h.updatedAt = today;
}

module.exports = { applyTx, reverseTx, findHolding, sameName };
