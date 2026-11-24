// Bank-balance side effects of ledger entries (expenses / income / transfers /
// ATM withdrawals). Create, edit and delete ALL go through here so balances can
// never drift from the entries that explain them.
const { round2 } = require('./money');
const { HttpError } = require('./validate');

// Returns [{ accountId, delta }] for one entry.
function effectsOf(entry) {
  const amt = Number(entry.amount) || 0;
  const a = entry.accountId || '';
  const b = entry.transferToAccountId || '';
  switch (entry.expenseType || 'expense') {
    case 'income': return a ? [{ accountId: a, delta: +amt }] : [];
    case 'transfer': return [...(a ? [{ accountId: a, delta: -amt }] : []), ...(b ? [{ accountId: b, delta: +amt }] : [])];
    case 'atm_withdrawal':
    case 'expense':
    default: return a ? [{ accountId: a, delta: -amt }] : [];
  }
}

function applyEffects(user, effects, sign = 1) {
  const today = new Date().toISOString().slice(0, 10);
  for (const { accountId, delta } of effects) {
    const acct = user.bankAccounts.id(accountId);
    if (!acct) continue; // dangling reference (account deleted): nothing to adjust
    acct.balance = round2((Number(acct.balance) || 0) + sign * delta);
    acct.updatedAt = today;
  }
}

const applyEntry = (user, entry) => applyEffects(user, effectsOf(entry), +1);
const reverseEntry = (user, entry) => applyEffects(user, effectsOf(entry), -1);

// Every account an entry points at must belong to this user.
function assertAccountsExist(user, entry) {
  for (const id of [entry.accountId, entry.transferToAccountId]) {
    if (id && !user.bankAccounts.id(id)) throw new HttpError(400, 'Selected account not found');
  }
  if ((entry.expenseType === 'transfer') && entry.accountId && entry.accountId === entry.transferToAccountId) {
    throw new HttpError(400, 'Source and destination accounts must differ');
  }
}

module.exports = { effectsOf, applyEntry, reverseEntry, assertAccountsExist };
