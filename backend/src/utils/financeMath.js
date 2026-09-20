function holdingInvestedValue(h) {
  return (Number(h.qty) || 0) * (Number(h.avgRate) || 0);
}
function holdingCurrentValue(h) {
  return (Number(h.qty) || 0) * (Number(h.currentRate) || 0);
}

module.exports = { holdingInvestedValue, holdingCurrentValue };
