const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const { dateOfBirth, monthlyIncome, name } = req.body || {};
    if (dateOfBirth !== undefined) req.user.financialProfile.dateOfBirth = dateOfBirth === '' ? null : dateOfBirth;
    if (monthlyIncome !== undefined) req.user.financialProfile.monthlyIncome = monthlyIncome === '' ? null : Number(monthlyIncome);
    if (name !== undefined && String(name).trim()) req.user.name = String(name).trim();
    await req.user.save();
    res.json({ financialProfile: req.user.financialProfile, name: req.user.name });
  })
);

module.exports = router;

// Test email endpoint - sends a test email to the logged-in user
router.post('/test-email', asyncHandler(async (req, res) => {
  const { sendMail } = require('../services/emailService');
  try {
    const result = await sendMail({
      to: req.user.email,
      subject: 'Vantage — test email',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><h2>Email is working ✓</h2><p>You'll receive weekly summaries every Monday and monthly summaries at month-end.</p><p style="color:#888;font-size:12px">Sent to: ${req.user.email}</p></div>`,
      text: 'Email is working. You will receive weekly and monthly summaries.',
    });
    if (result && result.skipped) {
      return res.status(400).json({ error: 'EMAIL_USER or EMAIL_PASS is still set to placeholder values in your backend .env file. Update them with real SMTP credentials and restart the server.' });
    }
    res.json({ ok: true, message: `Test email sent to ${req.user.email}` });
  } catch (err) {
    res.status(500).json({ error: `Email failed: ${err.message}. Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS in your .env file.` });
  }
}));
