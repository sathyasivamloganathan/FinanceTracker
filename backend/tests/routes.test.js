const test = require('node:test');
const assert = require('node:assert/strict');
const { makeUser, startApp } = require('./helpers');
const { todayStr } = require('../src/utils/dates');

const mountAll = (app) => {
  app.use('/expenses', require('../src/routes/expenses.routes'));
  app.use('/accounts', require('../src/routes/bankAccounts.routes'));
  app.use('/tx', require('../src/routes/transactions.routes'));
  app.use('/holdings', require('../src/routes/holdings.routes'));
  app.use('/fds', require('../src/routes/fds.routes'));
  app.use('/recurring', require('../src/routes/recurring.routes'));
  app.use('/assets', require('../src/routes/assets.routes'));
  app.use('/snapshots', require('../src/routes/snapshots.routes'));
  app.use('/targets', require('../src/routes/targets.routes'));
  app.use('/budget', require('../src/routes/budget.routes'));
  app.use('/insurance', require('../src/routes/insurance.routes'));
  app.use('/goals', require('../src/routes/goals.routes'));
  app.use('/liabilities', require('../src/routes/liabilities.routes'));
};
const setup = async (extra = {}) => {
  const user = makeUser({ bankAccounts: [{ name: 'HDFC', balance: 1000 }, { name: 'SBI', balance: 500 }], ...extra });
  const app = await startApp(user, mountAll);
  return { user, ...app, A: String(user.bankAccounts[0]._id), B: String(user.bankAccounts[1]._id) };
};
const bal = (u, i) => u.bankAccounts[i].balance;

test('expenses: create / edit / delete keep bank balances consistent', async (t) => {
  const { user, call, close, A, B } = await setup(); t.after(close);
  let r = await call('POST', '/expenses', { amount: 100, category: 'Food', accountId: A, date: '2026-11-01' });
  assert.equal(r.status, 201); assert.equal(bal(user, 0), 900);
  const id = r.json.expenses[0].id;

  r = await call('PATCH', `/expenses/${id}`, { amount: 250, notes: 'dinner' });
  assert.equal(r.status, 200); assert.equal(bal(user, 0), 750, 'editing the amount re-adjusts the balance');
  assert.equal(user.expenses[0].notes, 'dinner', 'notes are saved');

  r = await call('PATCH', `/expenses/${id}`, { accountId: B });
  assert.equal(bal(user, 0), 1000); assert.equal(bal(user, 1), 250, 'moving to another account moves the deduction');

  r = await call('PATCH', `/expenses/${id}`, { expenseType: 'income' });
  assert.equal(bal(user, 1), 750, 'expense→income flips the effect (500 + 250)');

  r = await call('DELETE', `/expenses/${id}`);
  assert.equal(r.status, 200); assert.equal(bal(user, 1), 500, 'delete reverses the effect');
  assert.equal(user.expenses.length, 0);
});

test('expenses: income credits, transfer moves money, undo (delete+re-add) is neutral', async (t) => {
  const { user, call, close, A, B } = await setup(); t.after(close);
  await call('POST', '/expenses', { amount: 300, category: 'Salary', expenseType: 'income', accountId: A });
  assert.equal(bal(user, 0), 1300);
  let r = await call('POST', '/expenses', { amount: 200, expenseType: 'transfer', accountId: A, transferToAccountId: B, category: 'Transfer' });
  assert.equal(bal(user, 0), 1100); assert.equal(bal(user, 1), 700);
  const t1 = r.json.expenses.find((e) => e.expenseType === 'transfer');
  const before = [bal(user, 0), bal(user, 1)];
  await call('DELETE', `/expenses/${t1.id}`);
  await call('POST', '/expenses', { amount: 200, expenseType: 'transfer', accountId: A, transferToAccountId: B, category: 'Transfer' });
  assert.deepEqual([bal(user, 0), bal(user, 1)], before, 'undo of a delete does not double-deduct');
  r = await call('POST', '/expenses', { amount: 5, expenseType: 'transfer', accountId: A });
  assert.equal(r.status, 400);
  r = await call('POST', '/expenses', { amount: 5, accountId: 'f'.repeat(24) });
  assert.equal(r.status, 400, 'unknown account refused');
});

test('expenses: validation', async (t) => {
  const { call, close } = await setup(); t.after(close);
  for (const body of [{ amount: 'abc' }, { amount: -5 }, { amount: 0 }, { amount: 1e12 }, { amount: 5, date: '2026-13-40' }, { amount: 5, expenseType: 'bogus' }, { amount: 5, category: {} }, []]) {
    const r = await call('POST', '/expenses', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal((await call('DELETE', '/expenses/not-an-id')).status, 400, 'bad id is a 400, not a 500');
  assert.equal((await call('DELETE', `/expenses/${'a'.repeat(24)}`)).status, 404);
});

test('transactions drive holdings; edit/delete reverse correctly; no oversell', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  const buy = { type: 'Buy', assetType: 'Stock', name: 'ACME', symbol: 'acme', qty: 10, price: 100, date: '2026-11-01' };
  let r = await call('POST', '/tx', buy); assert.equal(r.status, 201);
  r = await call('POST', '/tx', { ...buy, qty: 10, price: 200 });
  const h = user.holdings[0];
  assert.equal(h.qty, 20); assert.equal(h.avgRate, 150);
  user.holdings[0].currentRate = 175; // live price must survive further buys
  await call('POST', '/tx', { ...buy, qty: 1, price: 90, date: '2020-01-01' });
  assert.equal(user.holdings[0].currentRate, 175, 'a (back-dated) buy never overwrites the live price');

  r = await call('POST', '/tx', { type: 'Sell', assetType: 'Stock', name: 'acme', qty: 500, price: 10 });
  assert.equal(r.status, 409, 'cannot oversell');
  r = await call('POST', '/tx', { type: 'Sell', assetType: 'Stock', name: 'GHOST', qty: 1, price: 10 });
  assert.equal(r.status, 409, 'cannot sell what you do not hold');

  const txId = user.transactions[1]._id.toString();
  r = await call('PATCH', `/tx/${txId}`, { qty: 5 });
  assert.equal(r.status, 200); assert.equal(user.holdings[0].qty, 16, 'edit adjusts holding');
  assert.equal(user.transactions[1].amount, 1000, 'amount recomputed from qty×price');

  r = await call('DELETE', `/tx/${txId}`);
  assert.equal(user.holdings[0].qty, 11, 'delete reverses holding (no double count on re-add)');
  await call('POST', '/tx', { ...buy, qty: 5, price: 200 });
  assert.equal(user.holdings[0].qty, 16);
  assert.equal((await call('POST', '/tx', { ...buy, qty: 'x' })).status, 400);
});

test('holdings: opening balance ledger, strict rate, rename keeps history, duplicate refused', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  let r = await call('POST', '/holdings', { name: 'Fund A', assetType: 'Mutual Fund', qty: 10, avgRate: 50 });
  assert.equal(r.status, 201); assert.equal(user.transactions.length, 1); assert.equal(user.transactions[0].notes, 'Opening balance');
  const id = user.holdings[0]._id.toString();
  assert.equal((await call('PATCH', `/holdings/${id}/rate`, { currentRate: 'oops' })).status, 400, 'junk rate is rejected, not zeroed');
  assert.equal((await call('PATCH', `/holdings/${id}/rate`, {})).status, 400);
  assert.equal((await call('PATCH', `/holdings/${id}/rate`, { currentRate: 62.5 })).status, 200);
  assert.equal(user.holdings[0].currentRate, 62.5);
  assert.equal((await call('POST', '/holdings', { name: 'fund a', assetType: 'Mutual Fund' })).status, 409);
  await call('PATCH', `/holdings/${id}`, { name: 'Fund A Direct' });
  assert.equal(user.transactions[0].name, 'Fund A Direct');
});

test('bank accounts: transfer + ATM through the ledger, rename dupes, delete clears references', async (t) => {
  const { user, call, close, A, B } = await setup(); t.after(close);
  let r = await call('POST', '/accounts/transfer', { fromId: A, toId: B, amount: 100 });
  assert.equal(r.status, 201); assert.equal(bal(user, 0), 900); assert.equal(bal(user, 1), 600);
  r = await call('POST', '/accounts/transfer', { fromId: A, amount: 50 });
  assert.equal(bal(user, 0), 850); assert.equal(user.expenses[1].expenseType, 'atm_withdrawal');
  assert.equal((await call('POST', '/accounts/transfer', { fromId: A, toId: A, amount: 5 })).status, 400);
  assert.equal((await call('PATCH', `/accounts/${B}`, { name: 'hdfc' })).status, 409);
  await call('DELETE', `/accounts/${A}`);
  assert.ok(user.expenses.every((e) => e.accountId !== A), 'no dangling account references');
});

test('FDs: manual maturity survives edits; early closure needs confirmation; money never vanishes', async (t) => {
  const { user, call, close, A } = await setup(); t.after(close);
  let r = await call('POST', '/fds', { bankName: 'X', principal: 100000, interestRate: 7, startDate: '2026-01-01', maturityDate: '2026-02-01', maturityAmount: 100999, creditToAccountId: A });
  assert.equal(r.status, 201);
  const id = user.fds[0]._id.toString();
  assert.equal(user.fds[0].maturityAmount, 100999); assert.equal(user.fds[0].manualMaturity, true);
  await call('PATCH', `/fds/${id}`, { notes: 'hello', principal: 100000 });
  assert.equal(user.fds[0].maturityAmount, 100999, 'bank-quoted value is not overwritten by an edit');
  await call('PATCH', `/fds/${id}`, { maturityAmount: 0 });
  assert.notEqual(user.fds[0].maturityAmount, 100999, 'clearing it recomputes');
  assert.equal((await call('PATCH', `/fds/${id}`, { maturityDate: '2025-01-01' })).status, 400);

  r = await call('POST', '/fds', { bankName: 'Y', principal: 1000, interestRate: 6, startDate: '2026-01-01', maturityDate: '2060-01-01' });
  assert.equal(r.status, 201);
  const futureId = user.fds[1]._id.toString();
  r = await call('POST', `/fds/${futureId}/mature`, {});
  assert.equal(r.status, 409); assert.equal(r.json.code, 'NOT_MATURE_YET');
  r = await call('POST', `/fds/${futureId}/mature`, { early: true });
  assert.equal(r.status, 200); assert.equal(user.fds[1].status, 'broken');
  assert.equal(user.otherAssets.length, 1, 'no linked account → credited as a Cash asset, not lost');

  const before = bal(user, 0);
  r = await call('POST', `/fds/${id}/mature`, {});
  assert.equal(r.status, 200); assert.ok(bal(user, 0) > before);
  r = await call('POST', `/fds/${id}/mature`, {});
  assert.equal(r.status, 409, 'second click cannot credit twice');
});

test('recurring: first occurrence generated, balances adjusted, no duplicates on re-run', async (t) => {
  const { user, call, close, A } = await setup(); t.after(close);
  const today = todayStr();
  let r = await call('POST', '/recurring', { name: 'Rent', amount: 100, frequency: 'monthly', startDate: today, accountId: A, category: 'Rent' });
  assert.equal(r.status, 201);
  r = await call('POST', '/recurring/generate', {});
  assert.equal(r.json.generated.length, 1); assert.equal(bal(user, 0), 900);
  assert.equal(user.expenses[0].sourceId, String(user.recurring[0]._id));
  assert.ok(!user.expenses[0].description.includes('[recurring'), 'no ugly tag in the description');
  r = await call('POST', '/recurring/generate', {});
  assert.equal(r.json.generated.length, 0); assert.equal(bal(user, 0), 900);
  assert.equal((await call('POST', '/recurring', { name: 'x', amount: 1, frequency: 'monthly', startDate: today, endDate: '2000-01-01' })).status, 400);
});

test('assets: strict amounts, future snapshots refused, garbage dates cannot win', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  assert.equal((await call('POST', '/assets', { category: 'Cash', name: 'Wallet', amount: 'abc' })).status, 400);
  await call('POST', '/assets', { category: 'Real Estate', name: 'Plot No. 5', amount: 1000 });
  const id = user.otherAssets[0]._id.toString();
  assert.equal((await call('POST', `/assets/${id}/snapshots`, { date: 'zzzz', amount: 1 })).status, 400);
  assert.equal((await call('POST', `/assets/${id}/snapshots`, { date: '2099-01-01', amount: 1 })).status, 400);
  await call('POST', `/assets/${id}/snapshots`, { date: '2020-01-01', amount: 500 });
  assert.equal(user.otherAssets[0].amount, 1000, 'older snapshot does not replace the latest');
  assert.equal((await call('PATCH', `/assets/${id}`, {})).status, 200);
  assert.equal((await call('PATCH', `/assets/${id}`, { amount: 'x' })).status, 400);
  await call('PATCH', `/assets/${id}`, { amount: 1200 });
  assert.equal(user.otherAssets[0].amount, 1200);
});

test('snapshots: dotted category names work, one per date, net worth includes everything', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  await call('POST', '/assets', { category: 'Real Estate (Plot No. 5)', name: 'Land', amount: 1000 });
  let r = await call('POST', '/snapshots', {});
  assert.equal(r.status, 201, JSON.stringify(r.json));
  r = await call('POST', '/snapshots', {});
  assert.equal(user.netWorthSnapshots.length, 1, 'same date replaces');
  assert.equal(user.netWorthSnapshots[0].netWorth, 1000 + 1500, 'assets + bank balances (1000+500)');
  assert.equal((await call('POST', '/snapshots/manual', { date: '2099-01-01', netWorth: 1 })).status, 400);
  assert.equal((await call('POST', '/snapshots/manual', { date: '2020-01-01', netWorth: -50 })).status, 201);
});

test('goals use the same net worth as snapshots (bank + FDs included)', async (t) => {
  const { user, call, close, A } = await setup(); t.after(close);
  await call('POST', '/goals', { name: 'Car', targetAmount: 5000 });
  const id = user.goals[0]._id.toString();
  await call('POST', `/goals/${id}/achieve`, {});
  assert.equal(user.goals[0].achievedNetWorth, 1500);
});

test('targets & budgets: odd names, bounds, month validation', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  assert.equal((await call('PUT', `/targets/${encodeURIComponent('100%')}`, { value: 10 })).status, 200);
  assert.equal((await call('PUT', `/targets/${encodeURIComponent('Real. Estate')}`, { value: 10 })).status, 200);
  assert.equal((await call('PUT', '/targets/Gold', { value: 101 })).status, 400);
  assert.equal((await call('PUT', '/targets/Gold', { value: 'x' })).status, 400);
  assert.ok(user.targets.has('100%'));
  assert.equal((await call('PUT', '/budget/2026-13', { budget: {} })).status, 400);
  assert.equal((await call('PUT', '/budget/2026-11', { budget: { Food: 'Infinity' } })).status, 400);
  const r = await call('PUT', '/budget/2026-11', { budget: { Food: 500, 'A.B': 1, Zero: 0 } });
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.json.budget).sort(), ['A\u2024B', 'Food']);
});

test('insurance/liabilities: dates and numbers validated', async (t) => {
  const { user, call, close } = await setup(); t.after(close);
  assert.equal((await call('POST', '/insurance', { name: 'P', type: 'Life', dueDate: 'next March' })).status, 400);
  assert.equal((await call('POST', '/insurance', { name: 'P', type: 'Life', dueDate: '2027-01-05', premium: 'many' })).status, 400);
  assert.equal((await call('POST', '/insurance', { name: 'P', type: 'Life', dueDate: '2027-01-05', premium: 100 })).status, 201);
  user.insurance[0].lastReminderSentAt = new Date();
  await call('PATCH', `/insurance/${user.insurance[0]._id}`, { dueDate: '2028-01-05' });
  assert.equal(user.insurance[0].lastReminderSentAt, null, 'new due date resets the reminder');
  assert.equal((await call('POST', '/liabilities', { name: 'Loan', amount: 'abc' })).status, 400);
  assert.equal((await call('POST', '/liabilities', { name: 'Loan', amount: 500, type: 'Home Loan' })).status, 201);
});

test('array caps protect the 16 MB document limit', async (t) => {
  const { user, close } = await setup(); t.after(close);
  user.bankAccounts = Array.from({ length: 101 }, (_, i) => ({ name: `A${i}`, balance: 0 }));
  await assert.rejects(() => user.validate(), /Limit of 100 bank accounts/);
});

test('legacy "[recurring:id]" suffix is removed from old entries and kept as sourceId', async () => {
  const { stripRecurringTags } = require('../src/utils/legacy');
  const id = 'a'.repeat(24);
  const user = makeUser({ expenses: [
    { date: '2026-11-01', category: 'Rent', amount: 5, description: `House rent [recurring:${id}]` },
    { date: '2026-11-02', category: 'Food', amount: 5, description: 'Lunch' },
  ] });
  assert.equal(stripRecurringTags(user), 1);
  assert.equal(user.expenses[0].description, 'House rent');
  assert.equal(user.expenses[0].sourceId, id);
  assert.equal(user.expenses[1].description, 'Lunch');
  assert.equal(stripRecurringTags(user), 0, 'idempotent');
});
