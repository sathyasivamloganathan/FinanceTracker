// Minimal HTML escaping for anything interpolated into e-mail HTML.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
module.exports = { esc };
