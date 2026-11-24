const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr, daysBetween } = require('../utils/dates');
const { calcMaturity } = require('../utils/financeMath');
const { closeFd } = require('../utils/fd');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const COMPOUNDING = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On maturity'];

const reply = (u) => ({ fds: serializeList(u.fds), bankAccounts: serializeList(u.bankAccounts), otherAssets: serializeList(u.otherAssets) });

function checkAccounts(user, ...ids) {
  for (const id of ids) if (id && !user.bankAccounts.id(id)) throw V.bad('Selected account not found');
}
function checkDates(start, end) {
  if (daysBetween(start, end) <= 0) throw V.bad('maturityDate must be after startDate');
  if (daysBetween(start, end) > 365 * 50) throw V.bad('Tenure cannot exceed 50 years');
}

router.get('/', asyncHandler(async (req, res) => res.json({ fds: serializeList(req.user.fds) })));

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const startDate = V.date(b.startDate, { field: 'startDate', required: true });
  const maturityDate = V.date(b.maturityDate, { field: 'maturityDate', required: true });
  checkDates(startDate, maturityDate);
  const principal = V.num(b.principal, { field: 'principal', min: 0.01, max: 1e11, required: true });
  const interestRate = V.num(b.interestRate, { field: 'interestRate', min: 0.01, max: 100, required: true });
  const compounding = V.oneOf(b.compounding, COMPOUNDING, { field: 'compounding', fallback: 'Quarterly' });
  const accountId = V.str(b.accountId, { field: 'accountId', max: 40 });
  const creditToAccountId = V.str(b.creditToAccountId, { field: 'creditToAccountId', max: 40 });
  checkAccounts(req.user, accountId, creditToAccountId);

  const manual = V.num(b.maturityAmount, { field: 'maturityAmount', min: 0, max: 1e12 });
  req.user.fds.push({
    bankName: V.str(b.bankName, { field: 'bankName', required: true, max: 120 }),
    accountId, principal, interestRate, startDate, maturityDate, compounding,
    maturityAmount: manual > 0 ? round2(manual) : calcMaturity(principal, interestRate, startDate, maturityDate, compounding),
    manualMaturity: manual > 0,
    autoRenew: V.bool(b.autoRenew, { field: 'autoRenew', fallback: false }),
    creditToAccountId, status: 'active', notes: V.str(b.notes, { field: 'notes', max: 300 }),
  });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const fd = req.user.fds.id(req.params.id);
  if (!fd) return res.status(404).json({ error: 'FD not found' });
  const b = V.body(req);
  let recompute = false;

  if (b.bankName !== undefined) fd.bankName = V.str(b.bankName, { field: 'bankName', required: true, max: 120 });
  if (b.accountId !== undefined) { const v = V.str(b.accountId, { field: 'accountId', max: 40 }); checkAccounts(req.user, v); fd.accountId = v; }
  if (b.creditToAccountId !== undefined) { const v = V.str(b.creditToAccountId, { field: 'creditToAccountId', max: 40 }); checkAccounts(req.user, v); fd.creditToAccountId = v; }
  if (b.principal !== undefined) { fd.principal = V.num(b.principal, { field: 'principal', min: 0.01, max: 1e11, required: true }); recompute = true; }
  if (b.interestRate !== undefined) { fd.interestRate = V.num(b.interestRate, { field: 'interestRate', min: 0.01, max: 100, required: true }); recompute = true; }
  if (b.startDate !== undefined) { fd.startDate = V.date(b.startDate, { field: 'startDate', required: true }); recompute = true; }
  if (b.maturityDate !== undefined) { fd.maturityDate = V.date(b.maturityDate, { field: 'maturityDate', required: true }); recompute = true; }
  if (b.compounding !== undefined) { fd.compounding = V.oneOf(b.compounding, COMPOUNDING, { field: 'compounding', required: true }); recompute = true; }
  if (b.autoRenew !== undefined) fd.autoRenew = V.bool(b.autoRenew, { field: 'autoRenew' });
  if (b.notes !== undefined) fd.notes = V.str(b.notes, { field: 'notes', max: 300 });
  // Status can only be moved by closing (POST /:id/close) — except undoing an early closure.
  if (b.status !== undefined) {
    const s = V.oneOf(b.status, ['active', 'broken'], { field: 'status', required: true });
    if (s !== fd.status) {
      if (!(fd.status === 'broken' || fd.status === 'active')) throw V.bad('A matured or renewed FD cannot be reopened');
      fd.status = s;
    }
  }
  checkDates(fd.startDate, fd.maturityDate);

  // A bank-quoted maturity value is preserved; only recompute when the user
  // did not supply one (or explicitly cleared it).
  if (b.maturityAmount !== undefined) {
    const m = V.num(b.maturityAmount, { field: 'maturityAmount', min: 0, max: 1e12 });
    if (m > 0) { fd.maturityAmount = round2(m); fd.manualMaturity = true; recompute = false; }
    else { fd.manualMaturity = false; recompute = true; }
  }
  if (recompute && !fd.manualMaturity) {
    fd.maturityAmount = calcMaturity(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate, fd.compounding);
  }
  await req.user.save();
  res.json(reply(req.user));
}));

// Mature (or renew) an FD. Before the maturity date this needs {early:true}
// and pays the accrued value instead of the maturity value.
router.post('/:id/mature', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const fd = req.user.fds.id(req.params.id);
  if (!fd) return res.status(404).json({ error: 'FD not found' });
  const b = V.body(req);
  const today = todayStr();
  const early = fd.maturityDate > today;
  if (early && b.early !== true) {
    return res.status(409).json({ error: `This FD matures on ${fd.maturityDate}. Confirm to close it early (you will be credited the accrued value).`, code: 'NOT_MATURE_YET' });
  }
  closeFd(req.user, fd, today, { early });
  await req.user.save(); // a concurrent second click hits a version conflict, retries, then sees status≠active → 409 (no double credit)
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.fds.id(req.params.id)) return res.status(404).json({ error: 'FD not found' });
  req.user.fds.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;
