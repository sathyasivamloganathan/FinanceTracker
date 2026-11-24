// Small, dependency-free input validation helpers.
// Every route validates its inputs through these so that bad types / values
// become a clean 400 instead of a 500 or silently-coerced `0`.
const mongoose = require('mongoose');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = true;
    if (details) this.details = details;
  }
}

const bad = (msg) => new HttpError(400, msg);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function body(req) {
  const b = req.body === undefined ? {} : req.body;
  if (!isPlainObject(b)) throw bad('Request body must be a JSON object');
  return b;
}

// String. undefined/null -> '' (or error when required). Non-strings rejected.
function str(v, { field = 'value', min = 0, max = 200, required = false, trim = true } = {}) {
  if (v === undefined || v === null) {
    if (required) throw bad(`${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const s = trim ? v.trim() : v;
  if (required && !s) throw bad(`${field} is required`);
  if (s.length < min) throw bad(`${field} must be at least ${min} characters`);
  if (s.length > max) throw bad(`${field} must be at most ${max} characters`);
  return s;
}

// Finite number. Accepts numbers or numeric strings. '' / null / undefined ->
// undefined (or error if required). NaN/Infinity/garbage always rejected.
function num(v, { field = 'value', min = -Infinity, max = Infinity, required = false, int = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return undefined;
  }
  let n = v;
  if (typeof v === 'string') {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v.trim())) throw bad(`${field} must be a number`);
    n = Number(v);
  }
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`${field} must be a number`);
  if (int && !Number.isInteger(n)) throw bad(`${field} must be a whole number`);
  if (n < min) throw bad(`${field} must be at least ${min}`);
  if (n > max) throw bad(`${field} must be at most ${max}`);
  return n;
}

function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function date(v, { field = 'date', required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return '';
  }
  if (!isValidDateStr(v)) throw bad(`${field} must be a valid date (YYYY-MM-DD)`);
  return v;
}

function monthKey(v, field = 'month') {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw bad(`${field} must be YYYY-MM`);
  return v;
}

function oneOf(v, list, { field = 'value', required = false, fallback } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return fallback;
  }
  if (!list.includes(v)) throw bad(`${field} must be one of: ${list.join(', ')}`);
  return v;
}

function bool(v, { field = 'value', fallback } = {}) {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw bad(`${field} must be true or false`);
  return v;
}

function objectId(v, field = 'id') {
  if (typeof v !== 'string' || !/^[a-f\d]{24}$/i.test(v)) throw bad(`Invalid ${field}`);
  return v;
}

// Mongoose Map keys / Mixed keys may not contain '.' or start with '$'.
// Replace with visually-similar safe characters so user labels survive.
function safeKey(k, max = 60) {
  let s = String(k ?? '').trim().slice(0, max);
  if (!s) throw bad('Name is required');
  s = s.replace(/\./g, '\u2024').replace(/^\$/, '\uFF04');
  if (['__proto__', 'constructor', 'prototype'].includes(s)) s = `${s}_`;
  return s;
}

// Mongoose wraps cast failures; this re-exports the check used by routes.
const isObjectId = (v) => mongoose.isValidObjectId(v) && /^[a-f\d]{24}$/i.test(String(v));

module.exports = { HttpError, bad, body, str, num, date, monthKey, oneOf, bool, objectId, safeKey, isValidDateStr, isPlainObject, isObjectId };
