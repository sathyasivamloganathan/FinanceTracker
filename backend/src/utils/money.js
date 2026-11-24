// Money helpers. Amounts are stored as JS numbers; every mutation is rounded
// to 2 decimals (paise) so repeated additions never drift (0.1 + 0.2).
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const EPS = 1e-9;
module.exports = { round2, EPS };
