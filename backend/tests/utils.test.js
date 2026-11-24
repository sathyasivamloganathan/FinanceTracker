const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const V = require('../src/utils/validate');
const D = require('../src/utils/dates');
const { toCsv } = require('../src/utils/csv');
const F = require('../src/utils/financeMath');
const { applyTx, reverseTx } = require('../src/utils/holdingsLedger');
const { effectsOf } = require('../src/utils/ledger');
const { loadConfig } = require('../src/config/env');
const { esc } = require('../src/utils/html');

test('validators: numbers', () => {
  assert.equal(V.num('12.5', { min: 0 }), 12.5);
  assert.equal(V.num('', {}), undefined);
  for (const bad of ['abc', 'NaN', 'Infinity', '1e999', {}, [], true]) assert.throws(() => V.num(bad, { field: 'x' }), /must be a number/, String(bad));
  assert.throws(() => V.num(-1, { min: 0 }), /at least/);
  assert.throws(() => V.num(undefined, { required: true }), /required/);
});

test('validators: strings / dates / enums / keys', () => {
  assert.throws(() => V.str({}, { field: 'name' }), /must be text/);
  assert.throws(() => V.str('x'.repeat(5), { max: 3 }), /at most/);
  assert.equal(V.date('2026-02-28'), '2026-02-28');
  assert.throws(() => V.date('2026-02-30'), /valid date/);
  assert.throws(() => V.date('26-1-1'), /valid date/);
  assert.throws(() => V.oneOf('x', ['a']), /one of/);
  assert.throws(() => V.objectId('abc'), /Invalid/);
  assert.equal(V.safeKey('Plot No. 5'), 'Plot No\u2024 5');
  assert.equal(V.safeKey('$x'), '\uFF04x');
  assert.notEqual(V.safeKey('__proto__'), '__proto__');
});

test('dates: month-end clamping does not drift', () => {
  const t = { startDate: '2026-01-31', frequency: 'monthly', lastGeneratedDate: '' };
  assert.deepEqual(D.dueOccurrences(t, '2026-06-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
});

test('dates: the start date itself is generated, then only newer occurrences', () => {
  const t = { startDate: '2026-11-01', frequency: 'monthly', lastGeneratedDate: '' };
  assert.deepEqual(D.dueOccurrences(t, '2026-11-17'), ['2026-11-01']);
  t.lastGeneratedDate = '2026-11-01';
  assert.deepEqual(D.dueOccurrences(t, '2026-11-17'), []);
  assert.deepEqual(D.dueOccurrences(t, '2027-01-05'), ['2026-12-01', '2027-01-01']);
});

test('dates: endDate keeps unpaid occurrences before it', () => {
  const t = { startDate: '2026-01-01', frequency: 'monthly', lastGeneratedDate: '2026-01-01', endDate: '2026-03-15' };
  assert.deepEqual(D.dueOccurrences(t, '2026-09-01'), ['2026-02-01', '2026-03-01']);
});

test('dates: leap day, weekly, yearly', () => {
  assert.equal(D.addMonthsClamped('2024-02-29', 12), '2025-02-28');
  assert.equal(D.occurrence('2026-01-01', 'weekly', 3), '2026-01-22');
  assert.equal(D.occurrence('2024-02-29', 'yearly', 1), '2025-02-28');
});

test('dates: todayStr uses the app timezone, not UTC', () => {
  const t = new Date('2026-11-20T20:00:00Z'); // 01:30 IST on the 21st
  assert.equal(D.todayStr('Asia/Kolkata', t), '2026-11-21');
  assert.equal(D.todayStr('UTC', t), '2026-11-20');
});

test('dates: insurance due rolling + invalid dates', () => {
  assert.equal(D.nextDueOnOrAfter('2026-03-10', 'Yearly', '2026-11-21'), '2027-03-10');
  assert.equal(D.nextDueOnOrAfter('2026-12-01', 'Yearly', '2026-11-21'), '2026-12-01');
  assert.equal(D.nextDueOnOrAfter('2026-03-10', 'One-time', '2026-11-21'), null);
  assert.equal(D.nextDueOnOrAfter('next March', 'Yearly', '2026-11-21'), null);
});

test('dates: ISO week key', () => {
  assert.equal(D.isoWeekKey('2026-01-01'), '2026-W01');
  assert.equal(D.isoWeekKey('2025-12-29'), '2026-W01');
  assert.equal(D.isoWeekKey('2027-01-03'), '2026-W53');
  assert.equal(D.isoWeekKey('2026-11-21'), '2026-W47');
});

test('csv: formula injection neutralised, numbers untouched, BOM-ready', () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: -500, c: '+1', d: 'plain, text', e: '@x', f: '\tx' }],
    ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => ({ label: k, value: k })));
  const line = csv.split('\r\n')[1];
  assert.ok(line.startsWith(`"'=HYPERLINK(""x"")"`), line);
  assert.ok(line.includes(',-500,'), line);
  assert.ok(line.includes(`,'+1,`), line);
  assert.ok(line.includes('"plain, text"'), line);
  assert.ok(line.includes(`,'@x,`), line);
});

test('html escaping', () => assert.equal(esc('<img onerror="x">&\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;'));

test('financeMath: maturity, accrued value, net worth definition', () => {
  const m = F.calcMaturity(100000, 7, '2026-01-01', '2027-01-01', 'Yearly');
  assert.equal(m, 107000);
  const fd = { status: 'active', principal: 100000, interestRate: 7, startDate: '2026-01-01', maturityDate: '2027-01-01', compounding: 'Yearly', maturityAmount: 107000 };
  const half = F.fdAccruedValue(fd, '2026-07-02');
  assert.ok(half > 100000 && half < 107000);
  assert.equal(F.fdAccruedValue(fd, '2030-01-01'), 107000);
  const user = {
    holdings: [{ assetType: 'Stock', qty: 10, avgRate: 100, currentRate: 150 }],
    otherAssets: [{ category: 'Cash', amount: 500 }], fds: [fd],
    bankAccounts: [{ balance: 1000 }, { balance: -300 }], liabilities: [{ amount: 200 }],
  };
  const nw = F.computeNetWorth(user, '2026-01-01');
  assert.equal(nw.breakdown['Bank Accounts'], 700, 'overdraft reduces net worth');
  assert.equal(nw.breakdown['Fixed Deposits'], 100000);
  assert.equal(nw.netWorth, 1500 + 500 + 100000 + 700 - 200);
});

test('holdings ledger: buy / sell / oversell / reverse', () => {
  const user = { holdings: [] };
  const buy = (q, p) => ({ type: 'Buy', assetType: 'Stock', name: 'ACME', symbol: 'acme', qty: q, price: p, amount: q * p });
  applyTx(user, buy(10, 100), { today: '2026-01-01' });
  applyTx(user, buy(10, 200), { today: '2026-01-02' });
  const h = user.holdings[0];
  assert.equal(h.qty, 20); assert.equal(h.avgRate, 150); assert.equal(h.symbol, 'ACME');
  const sell = { type: 'Sell', assetType: 'Stock', name: 'acme', qty: 5, price: 300, amount: 1500 };
  applyTx(user, sell, { today: '2026-01-03' });
  assert.equal(h.qty, 15); assert.equal(h.avgRate, 150, 'sale keeps average cost');
  assert.throws(() => applyTx(user, { ...sell, qty: 99 }, {}), /only 15 held/);
  assert.throws(() => applyTx(user, { ...sell, name: 'NOPE' }, {}), /nothing to sell/);
  // removing the first buy would leave -10 + 15 … blocked only if qty goes negative
  reverseTx(user, buy(10, 100), { today: 'x' });
  assert.equal(h.qty, 5);
  assert.throws(() => reverseTx(user, buy(10, 200), {}), /later sells/);
  reverseTx(user, sell, {});
  assert.equal(h.qty, 10);
});

test('ledger effects per entry type', () => {
  assert.deepEqual(effectsOf({ expenseType: 'expense', accountId: 'a', amount: 5 }), [{ accountId: 'a', delta: -5 }]);
  assert.deepEqual(effectsOf({ expenseType: 'income', accountId: 'a', amount: 5 }), [{ accountId: 'a', delta: 5 }]);
  assert.deepEqual(effectsOf({ expenseType: 'transfer', accountId: 'a', transferToAccountId: 'b', amount: 5 }), [{ accountId: 'a', delta: -5 }, { accountId: 'b', delta: 5 }]);
  assert.deepEqual(effectsOf({ expenseType: 'atm_withdrawal', accountId: 'a', amount: 5 }), [{ accountId: 'a', delta: -5 }]);
  assert.deepEqual(effectsOf({ expenseType: 'expense', amount: 5 }), []);
});

test('config: weak secret, bad proxy and bad origins are refused', () => {
  const ok = { JWT_SECRET: 'z'.repeat(40), MONGODB_URI: 'mongodb://x', NODE_ENV: 'production', CLIENT_ORIGINS: 'https://app.example.com', FRONTEND_URL: 'https://app.example.com' };
  assert.equal(loadConfig(ok).trustProxy, 1);
  assert.throws(() => loadConfig({ ...ok, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...ok, TRUST_PROXY: 'true' }), /TRUST_PROXY/);
  assert.throws(() => loadConfig({ ...ok, CLIENT_ORIGINS: 'https://app.example.com/path' }), /origin only/);
  assert.throws(() => loadConfig({ ...ok, COOKIE_SAMESITE: 'none', NODE_ENV: 'development' }), /requires HTTPS/);
});
