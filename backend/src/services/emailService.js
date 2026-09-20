const nodemailer = require('nodemailer');

// CHANGE THIS: these all come from .env — see .env.example for where to put
// your real SMTP credentials. Nothing to edit in this file itself.
function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendMail({ to, subject, html, text }) {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER.startsWith('REPLACE_WITH')) {
    console.warn(`[email] Skipped sending "${subject}" to ${to} — EMAIL_USER/EMAIL_PASS still have placeholder values in .env`);
    return { skipped: true };
  }
  const transporter = buildTransport();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };
