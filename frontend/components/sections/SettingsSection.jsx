'use client';

import { useState, useEffect } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { usePrivacy } from '@/lib/PrivacyContext';
import { Card, SectionTitle, Btn, Field, inputClass } from '@/components/ui';
import { api } from '@/lib/api';

export default function SettingsSection() {
  const { state, ready, updateSettings } = useFinance();
  const { user, logout, changePassword } = useAuth();
  const { hidden, toggle } = usePrivacy();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [emailTesting, setEmailTesting] = useState(false);

  useEffect(() => {
    if (state?.darkModeDefault !== undefined) {
      setDarkMode(state.darkModeDefault);
      if (state.darkModeDefault) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }, [state?.darkModeDefault]);

  async function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try { await updateSettings({ darkModeDefault: next }); } catch {
      setDarkMode(!next);
      if (!next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }

  async function sendTestEmail() {
    setEmailTesting(true);
    setEmailStatus('');
    try {
      const r = await api.post('/api/profile/test-email', {});
      setEmailStatus(r.message || 'Test email sent! Check your inbox.');
    } catch (e) {
      setEmailStatus('Error: ' + (e.message || 'Unknown error'));
    } finally { setEmailTesting(false); }
  }

  if (!ready || !state) return <SectionLoader />;

  async function submitPasswordChange() {
    setPwError(''); setPwSuccess('');
    if (newPw.length < 8) return setPwError('New password must be at least 8 characters');
    if (newPw !== confirmPw) return setPwError("New passwords don't match");
    setPwSaving(true);
    try {
      await changePassword(user.hasPassword ? currentPw : null, newPw);
      setPwSuccess('Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { setPwError(e.message || 'Could not update password'); }
    finally { setPwSaving(false); }
  }

  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <div className="text-[13.5px] space-y-1.5 dark:text-gray-200">
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Name</span><b>{user?.name}</b></div>
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Email</span><b>{user?.email}</b></div>
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Signed in via</span><b>{user?.authProvider === 'google' ? 'Google' : 'Email & password'}</b></div>
        </div>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-medium dark:text-gray-100">Dark mode</div>
            <p className="text-inkMuted dark:text-gray-400 text-xs mt-1">Saved across sessions.</p>
          </div>
          <button onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-medium dark:text-gray-100">Amount visibility</div>
            <p className="text-inkMuted dark:text-gray-400 text-xs mt-1">When hidden, all monetary values show as ••••. Toggle in the top bar on any page.</p>
          </div>
          <button onClick={toggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!hidden ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!hidden ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="text-xs text-inkMuted dark:text-gray-500 mt-2">Currently: <b>{hidden ? 'Hidden' : 'Visible'}</b></p>
      </Card>

      <SectionTitle>{user?.hasPassword ? 'Change password' : 'Set a password'}</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        {!user?.hasPassword && <p className="text-inkMuted dark:text-gray-400 text-[13px] mb-3">You signed in with Google. Set a password to also log in with email.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {user?.hasPassword && (
            <Field label="Current password"><input type="password" className={inputClass} value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></Field>
          )}
          <Field label="New password" hint="At least 8 characters."><input type="password" className={inputClass} value={newPw} onChange={e => setNewPw(e.target.value)} /></Field>
          <Field label="Confirm new password"><input type="password" className={inputClass} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></Field>
        </div>
        {pwError && <p className="text-clay text-[12.5px] mt-2">{pwError}</p>}
        {pwSuccess && <p className="text-emerald text-[12.5px] mt-2">{pwSuccess}</p>}
        <Btn variant="secondary" className="mt-3" onClick={submitPasswordChange} disabled={pwSaving}>
          {pwSaving ? 'Saving…' : user?.hasPassword ? 'Update password' : 'Set password'}
        </Btn>
      </Card>

      <SectionTitle>Email notifications</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <div className="text-[13px] dark:text-gray-300 space-y-2 mb-4">
          <div className="flex items-start gap-2"><span>📅</span><div><b>Weekly</b> — Every Monday: last 7 days spend + investment P/L.</div></div>
          <div className="flex items-start gap-2"><span>📆</span><div><b>Monthly</b> — End of month: total spend + P/L by category.</div></div>
          <div className="flex items-start gap-2"><span>🏦</span><div><b>FD maturity</b> — Notified when an FD matures or auto-renews.</div></div>
          <div className="flex items-start gap-2"><span>🔔</span><div><b>Insurance</b> — Renewal reminder 60 days before due date.</div></div>
        </div>

        <div className="bg-accentBg dark:bg-gray-700 rounded-lg p-3 mb-4 text-[12.5px]">
          <div className="font-semibold text-ink dark:text-gray-100 mb-2">Setup required in backend .env</div>
          <div className="font-mono text-[11px] space-y-1 text-ink dark:text-gray-200">
            <div>EMAIL_HOST=smtp.gmail.com</div>
            <div>EMAIL_PORT=587</div>
            <div>EMAIL_SECURE=false</div>
            <div>EMAIL_USER=<span className="text-accent">your@gmail.com</span></div>
            <div>EMAIL_PASS=<span className="text-accent">your-16-char-app-password</span></div>
            <div>EMAIL_FROM=<span className="text-accent">your@gmail.com</span></div>
          </div>
          <p className="text-inkMuted dark:text-gray-400 text-[11px] mt-2">
            For Gmail: Google Account → Security → 2-Step Verification → App passwords → generate one for "Mail". Use that 16-character password as EMAIL_PASS, not your regular Gmail password. Then restart the backend server.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Btn variant="secondary" onClick={sendTestEmail} disabled={emailTesting}>
            {emailTesting ? 'Sending…' : 'Send test email'}
          </Btn>
          {emailStatus && (
            <span className={`text-[12.5px] ${emailStatus.startsWith('Error') ? 'text-clay' : 'text-emerald'}`}>
              {emailStatus}
            </span>
          )}
        </div>
        <p className="text-inkMuted dark:text-gray-500 text-[11px] mt-2">Test email will be sent to <b>{user?.email}</b>.</p>
      </Card>

      <SectionTitle>Session</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <ul className="text-[13px] text-inkMuted dark:text-gray-400 space-y-1.5 list-disc pl-4 mb-4">
          <li>Session expires after 7 days — enforced server-side.</li>
          <li>httpOnly cookie — browser scripts cannot access the session token.</li>
          <li>Passwords are bcrypt-hashed, never stored in plain text.</li>
        </ul>
        <Btn variant="secondary" onClick={logout}>Log out</Btn>
      </Card>
    </>
  );
}
