// Calendar-date helpers. All dates are 'YYYY-MM-DD' strings and all arithmetic
// is done in UTC so results never depend on the server's timezone or DST.
const { isValidDateStr } = require('./validate');

const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// "Today" as a calendar date in the app timezone (not UTC).
function todayStr(tz = APP_TZ, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);

function addDays(s, n) { return fromUTC(toUTC(s) + n * 86400000); }
function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }

// Add months, clamping to the last day of the target month (Jan 31 + 1m = Feb 28/29).
function addMonthsClamped(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ty = Math.floor(total / 12);
  const tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const dd = Math.min(d, last);
  return `${String(ty).padStart(4, '0')}-${String(tm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

const FREQ = {
  daily: { days: 1 },
  weekly: { days: 7 },
  fortnightly: { days: 14 },
  monthly: { months: 1 },
  quarterly: { months: 3 },
  yearly: { months: 12 },
};

// k-th occurrence counted from the ORIGINAL start date - never from the
// previous occurrence - so month-end clamping does not accumulate drift.
function occurrence(startDate, frequency, k) {
  const f = FREQ[frequency];
  if (!f) throw new Error(`Unknown frequency ${frequency}`);
  return f.days ? addDays(startDate, f.days * k) : addMonthsClamped(startDate, f.months * k);
}

// All occurrences of a recurring template that are due: after
// lastGeneratedDate, on/after startDate, on/before today and endDate.
function dueOccurrences(t, today, cap = 400) {
  const out = [];
  if (!t || !isValidDateStr(t.startDate) || !FREQ[t.frequency]) return out;
  const last = isValidDateStr(t.lastGeneratedDate) ? t.lastGeneratedDate : '';
  const limit = t.endDate && isValidDateStr(t.endDate) && t.endDate < today ? t.endDate : today;
  for (let k = 0; k < 20000; k++) {
    const d = occurrence(t.startDate, t.frequency, k);
    if (d > limit) break;
    if (last && d <= last) continue;
    out.push(d);
    if (out.length >= cap) break;
  }
  return out;
}

// Next date a periodic bill falls on, on/after `today` (for reminders).
function nextDueOnOrAfter(dueDate, frequency, today) {
  if (!isValidDateStr(dueDate)) return null;
  if (dueDate >= today) return dueDate;
  const map = { Yearly: 'yearly', 'Half-yearly': 'half', Quarterly: 'quarterly', Monthly: 'monthly' };
  const f = map[frequency];
  if (!f) return null; // one-time: past is past
  const step = f === 'yearly' ? 12 : f === 'half' ? 6 : f === 'quarterly' ? 3 : 1;
  for (let k = 1; k < 2000; k++) {
    const d = addMonthsClamped(dueDate, step * k);
    if (d >= today) return d;
  }
  return null;
}

const monthKeyOf = (s) => s.slice(0, 7);

// Real ISO-8601 week key, e.g. 2026-W47.
function isoWeekKey(s) {
  const t = new Date(toUTC(s));
  const day = (t.getUTCDay() + 6) % 7; // Mon=0
  t.setUTCDate(t.getUTCDate() - day + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

module.exports = { APP_TZ, todayStr, addDays, daysBetween, addMonthsClamped, occurrence, dueOccurrences, nextDueOnOrAfter, monthKeyOf, isoWeekKey };
