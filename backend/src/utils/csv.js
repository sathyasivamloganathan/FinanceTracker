// CSV export helpers.
//  • Cells that a spreadsheet would execute as a formula (= + - @ TAB CR) are
//    neutralised by a leading apostrophe (OWASP "CSV injection").
//  • Real numbers are written untouched so negative amounts stay numeric.
//  • A UTF-8 BOM is prepended so Excel shows ₹ and other non-ASCII correctly.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '';
  let s = val instanceof Date ? val.toISOString() : String(val);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
  return [header, ...lines].join('\r\n');
}

// filename must be a server-built, already-safe string.
function sendCsv(res, filename, csv) {
  const safe = String(filename).replace(/[^A-Za-z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send('\uFEFF' + csv);
}

module.exports = { toCsv, sendCsv, escapeCell };
