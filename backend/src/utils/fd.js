// Fixed-deposit lifecycle shared by the API and the nightly job.
const { round2 } = require('./money');
const { addDays, daysBetween } = require('./dates');
const { calcMaturity, fdAccruedValue } = require('./financeMath');
const { HttpError } = require('./validate');

// Close an active FD.
//  • at/after maturity: pays maturityAmount (or renews it if autoRenew)
//  • before maturity ({ early: true }): pays the value accrued so far, status 'broken'
// Money always lands somewhere: the linked bank account, or — if none is
// linked — a "Cash" asset, so net worth never silently drops.
function closeFd(user, fd, today, { early = false } = {}) {
  if (fd.status !== 'active') throw new HttpError(409, 'Only active FDs can be closed');

  if (early) {
    const amount = fdAccruedValue(fd, today);
    fd.status = 'broken';
    credit(user, fd, amount, today, 'Closed early');
    return { kind: 'closed-early', amount };
  }

  const amount = round2(fd.maturityAmount > 0 ? fd.maturityAmount : calcMaturity(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate, fd.compounding));

  if (fd.autoRenew) {
    const tenure = Math.max(1, daysBetween(fd.startDate, fd.maturityDate));
    const newEnd = addDays(today, tenure);
    fd.status = 'renewed';
    user.fds.push({
      bankName: fd.bankName, accountId: fd.accountId, principal: amount, interestRate: fd.interestRate,
      startDate: today, maturityDate: newEnd, manualMaturity: false,
      maturityAmount: calcMaturity(amount, fd.interestRate, today, newEnd, fd.compounding),
      compounding: fd.compounding, autoRenew: true, creditToAccountId: fd.creditToAccountId,
      status: 'active', notes: `Renewed from ${fd.bankName} FD (matured ${fd.maturityDate})`,
    });
    return { kind: 'renewed', amount };
  }

  fd.status = 'matured';
  credit(user, fd, amount, today, 'Matured');
  return { kind: 'matured', amount };
}

function credit(user, fd, amount, today, label) {
  const acct = fd.creditToAccountId ? user.bankAccounts.id(fd.creditToAccountId) : null;
  if (acct) {
    acct.balance = round2((Number(acct.balance) || 0) + amount);
    acct.updatedAt = today;
  } else {
    user.otherAssets.push({
      category: 'Cash', name: `${label} FD — ${fd.bankName}`, amount, updatedAt: today,
      history: [{ date: today, amount }],
    });
  }
}

module.exports = { closeFd };
