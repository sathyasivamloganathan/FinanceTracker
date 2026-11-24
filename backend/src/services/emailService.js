const nodemailer = require('nodemailer');
const { getConfig } = require('../config/env');
const { signPurposeToken } = require('../utils/jwt');
const { esc } = require('../utils/html');

let transporter;
function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      requireTLS: process.env.EMAIL_SECURE !== 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      pool: true, maxConnections: 3, maxMessages: 100,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    });
  }
  return transporter;
}

const isEmailEnabled = () => getConfig().emailConfigured;

// Throws on SMTP failure so callers can decide; returns {skipped:true} when
// SMTP isn't configured.
async function sendMail({ to, subject, html, text, headers }) {
  if (!isEmailEnabled()) {
    console.warn(`[email] skipped "${subject}" — SMTP not configured`);
    return { skipped: true };
  }
  return getTransport().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to, subject, html, text, headers,
  });
}

function unsubscribeUrl(user) {
  const base = (process.env.API_PUBLIC_URL || getConfig().frontendUrl).replace(/\/+$/, '');
  return `${base}/api/auth/unsubscribe?token=${encodeURIComponent(signPurposeToken(user._id, 'unsub', '365d'))}`;
}

// Footer + headers for every automated (non-transactional) e-mail.
function marketingParts(user) {
  const url = unsubscribeUrl(user);
  return {
    footerHtml: `<p style="color:#9CA3AF;font-size:11px;margin-top:24px">You get this because e-mail updates are on for your Vantage account. <a href="${esc(url)}">Unsubscribe from all</a> or change this in Settings.</p>`,
    footerText: `\n\nUnsubscribe from all: ${url}`,
    headers: { 'List-Unsubscribe': `<${url}>` },
  };
}

const wrap = (inner) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0B1220">${inner}</div>`;

async function sendVerificationEmail(user, token) {
  const link = `${getConfig().frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: user.email,
    subject: 'Verify your Vantage e-mail address',
    html: wrap(`<h2>Confirm your e-mail</h2><p>Hi ${esc(user.name)}, confirm this address to finish setting up your account. The link works for 24 hours.</p><p><a href="${esc(link)}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verify e-mail</a></p><p style="color:#6B7280;font-size:12px">If you didn't create an account, ignore this message.</p>`),
    text: `Confirm your e-mail: ${link}\n(valid for 24 hours)`,
  });
}

async function sendPasswordResetEmail(user, token) {
  const link = `${getConfig().frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: user.email,
    subject: 'Reset your Vantage password',
    html: wrap(`<h2>Reset your password</h2><p>We received a request to reset the password for this account. The link works for 1 hour.</p><p><a href="${esc(link)}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p><p style="color:#6B7280;font-size:12px">If you didn't ask for this, you can ignore the message — your password has not changed.</p>`),
    text: `Reset your password: ${link}\n(valid for 1 hour). If you didn't request this, ignore this message.`,
  });
}

// Connects and authenticates without sending anything — shows the REAL reason mail fails.
async function verifySmtp() {
  if (!isEmailEnabled()) return { ok: false, error: 'EMAIL_USER / EMAIL_PASS are not set' };
  try { await getTransport().verify(); return { ok: true }; }
  catch (e) { return { ok: false, error: `${e.code || ''} ${e.message}`.trim() }; }
}

module.exports = { verifySmtp, sendMail, isEmailEnabled, marketingParts, sendVerificationEmail, sendPasswordResetEmail, unsubscribeUrl, wrap };
