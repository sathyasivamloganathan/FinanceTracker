const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

const VALID_COMPOUNDING = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On maturity'];
const VALID_STATUS = ['active', 'matured', 'renewed', 'broken'];

function calcMaturity(principal, rate, startDate, maturityDate, compounding) {
  const start = new Date(startDate);
  const end   = new Date(maturityDate);
  if (isNaN(start) || isNaN(end) || end <= start) return principal;
  const years = (end - start) / (365.25 * 24 * 3600 * 1000);
  const r = rate / 100;
  const n = { Monthly: 12, Quarterly: 4, 'Half-yearly': 2, Yearly: 1, 'On maturity': 1 }[compounding] || 4;
  const result = compounding === 'On maturity'
    ? principal * (1 + r * years)
    : principal * Math.pow(1 + r / n, n * years);
  return Math.round(result * 100) / 100;
}

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

router.get('/', asyncHandler(async (req, res) => {
  res.json({ fds: serializeList(req.user.fds) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { bankName, accountId, principal, interestRate, startDate, maturityDate, compounding, autoRenew, creditToAccountId, notes } = req.body || {};

  if (!bankName || typeof bankName !== 'string' || !bankName.trim())
    return res.status(400).json({ error: 'bankName is required' });
  if (!(Number(principal) > 0))
    return res.status(400).json({ error: 'principal must be a positive number' });
  if (!(Number(interestRate) > 0) || Number(interestRate) > 100)
    return res.status(400).json({ error: 'interestRate must be between 0 and 100' });
  if (!isDate(startDate) || !isDate(maturityDate))
    return res.status(400).json({ error: 'startDate and maturityDate must be YYYY-MM-DD' });
  if (new Date(maturityDate) <= new Date(startDate))
    return res.status(400).json({ error: 'maturityDate must be after startDate' });
  if (compounding && !VALID_COMPOUNDING.includes(compounding))
    return res.status(400).json({ error: 'Invalid compounding frequency' });

  const principalNum = Number(principal);
  const rateNum = Number(interestRate);
  const comp = VALID_COMPOUNDING.includes(compounding) ? compounding : 'Quarterly';
  const calculatedMaturity = calcMaturity(principalNum, rateNum, startDate, maturityDate, comp);
  const maturityAmount = (req.body.maturityAmount && Number(req.body.maturityAmount) > 0) ? Number(req.body.maturityAmount) : calculatedMaturity;

  // Validate linked account IDs belong to this user
  if (accountId && !req.user.bankAccounts.id(accountId))
    return res.status(400).json({ error: 'accountId references an account that does not exist' });
  if (creditToAccountId && !req.user.bankAccounts.id(creditToAccountId))
    return res.status(400).json({ error: 'creditToAccountId references an account that does not exist' });

  req.user.fds.push({
    bankName: String(bankName).trim().slice(0, 120),
    accountId: accountId || '',
    principal: principalNum,
    interestRate: rateNum,
    startDate, maturityDate, maturityAmount, compounding: comp,
    autoRenew: !!autoRenew,
    creditToAccountId: creditToAccountId || '',
    status: 'active',
    notes: notes ? String(notes).trim().slice(0, 300) : '',
  });
  await req.user.save();
  res.status(201).json({ fds: serializeList(req.user.fds) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fd = req.user.fds.id(req.params.id);
  if (!fd) return res.status(404).json({ error: 'FD not found' });

  const { bankName, accountId, principal, interestRate, startDate, maturityDate, compounding, autoRenew, creditToAccountId, status, notes } = req.body || {};

  if (bankName !== undefined) {
    if (!bankName.trim()) return res.status(400).json({ error: 'bankName cannot be empty' });
    fd.bankName = String(bankName).trim().slice(0, 120);
  }
  if (accountId !== undefined) fd.accountId = accountId;
  if (principal !== undefined) {
    if (!(Number(principal) > 0)) return res.status(400).json({ error: 'principal must be positive' });
    fd.principal = Number(principal);
  }
  if (interestRate !== undefined) {
    if (!(Number(interestRate) > 0) || Number(interestRate) > 100) return res.status(400).json({ error: 'interestRate must be 0–100' });
    fd.interestRate = Number(interestRate);
  }
  if (startDate !== undefined) {
    if (!isDate(startDate)) return res.status(400).json({ error: 'startDate must be YYYY-MM-DD' });
    fd.startDate = startDate;
  }
  if (maturityDate !== undefined) {
    if (!isDate(maturityDate)) return res.status(400).json({ error: 'maturityDate must be YYYY-MM-DD' });
    fd.maturityDate = maturityDate;
  }
  if (compounding !== undefined) {
    if (!VALID_COMPOUNDING.includes(compounding)) return res.status(400).json({ error: 'Invalid compounding' });
    fd.compounding = compounding;
  }
  if (autoRenew !== undefined) fd.autoRenew = !!autoRenew;
  if (creditToAccountId !== undefined) {
    if (creditToAccountId && !req.user.bankAccounts.id(creditToAccountId))
      return res.status(400).json({ error: 'creditToAccountId not found' });
    fd.creditToAccountId = creditToAccountId;
  }
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    fd.status = status;
  }
  if (notes !== undefined) fd.notes = String(notes).trim().slice(0, 300);

  if (new Date(fd.maturityDate) <= new Date(fd.startDate))
    return res.status(400).json({ error: 'maturityDate must be after startDate' });

  fd.maturityAmount = calcMaturity(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate, fd.compounding);
  await req.user.save();
  res.json({ fds: serializeList(req.user.fds) });
}));

router.post('/:id/mature', asyncHandler(async (req, res) => {
  const fd = req.user.fds.id(req.params.id);
  if (!fd) return res.status(404).json({ error: 'FD not found' });
  if (fd.status !== 'active') return res.status(400).json({ error: 'Only active FDs can be matured' });

  const today = new Date().toISOString().slice(0, 10);

  if (fd.autoRenew) {
    const tenureDays = Math.round((new Date(fd.maturityDate) - new Date(fd.startDate)) / 86400000);
    const newStart = today;
    const newEnd   = new Date(Date.now() + tenureDays * 86400000).toISOString().slice(0, 10);
    const newAmt   = calcMaturity(fd.maturityAmount, fd.interestRate, newStart, newEnd, fd.compounding);
    fd.status = 'renewed';
    req.user.fds.push({
      bankName: fd.bankName, accountId: fd.accountId,
      principal: fd.maturityAmount, interestRate: fd.interestRate,
      startDate: newStart, maturityDate: newEnd, maturityAmount: newAmt,
      compounding: fd.compounding, autoRenew: fd.autoRenew,
      creditToAccountId: fd.creditToAccountId, status: 'active',
      notes: `Renewed from: ${fd.bankName}`,
    });
  } else {
    fd.status = 'matured';
    if (fd.creditToAccountId) {
      const acct = req.user.bankAccounts.id(fd.creditToAccountId);
      if (acct) { acct.balance += fd.maturityAmount; acct.updatedAt = today; }
    }
  }

  await req.user.save();
  res.json({ fds: serializeList(req.user.fds), bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const fd = req.user.fds.id(req.params.id);
  if (!fd) return res.status(404).json({ error: 'FD not found' });
  req.user.fds.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ fds: serializeList(req.user.fds) });
}));

module.exports = router;
