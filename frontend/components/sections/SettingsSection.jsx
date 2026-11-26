'use client';

import { useState } from 'react';
import SectionLoader from '@/components/SectionLoader';
import Modal, { ModalActions } from '@/components/Modal';
import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { usePrivacy } from '@/lib/PrivacyContext';
import { Card, SectionTitle, Btn, Field, inputClass } from '@/components/ui';
import { api, API_BASE } from '@/lib/api';
import { applyTheme } from '@/lib/theme';

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${on ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Row({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-[13.5px] font-medium dark:text-gray-100">{title}</div>
        {hint && <p className="text-inkMuted dark:text-gray-400 text-xs mt-1">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsSection() {
  const { state, ready, updateSettings, notify } = useFinance();
  const { user, logout, logoutEverywhere, changePassword, updateUser } = useAuth();
  const { hidden, toggle } = usePrivacy();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [delError, setDelError] = useState('');

  if (!ready || !state) return <SectionLoader />;

  const darkMode = !!state.darkModeDefault;
  const prefs = user?.emailPrefs || { weekly: true, monthly: true, reminders: true };

  async function toggleDarkMode() {
    const next = !darkMode;
    applyTheme(next);
    const ok = await updateSettings({ darkModeDefault: next });
    if (!ok) applyTheme(darkMode);
  }

  async function togglePrivacyDefault() {
    await updateSettings({ privacyModeDefault: state.privacyModeDefault === false });
  }

  async function togglePref(key) {
    try {
      const r = await api.patch('/api/profile/email-preferences', { [key]: !prefs[key] });
      updateUser({ emailPrefs: r.emailPrefs });
    } catch (e) { notify(e.message); }
  }

  async function sendTestEmail() {
    try {
      const r = await api.post('/api/profile/test-email', {});
      notify(r.message || 'Test e-mail sent.', 'info');
    } catch (e) { notify(e.message); }
  }

  async function submitPasswordChange() {
    setPwError(''); setPwSuccess('');
    if (newPw.length < 8) return setPwError('New password must be at least 8 characters');
    if (new TextEncoder().encode(newPw).length > 72) return setPwError('New password must be at most 72 bytes');
    if (newPw !== confirmPw) return setPwError("New passwords don't match");
    try {
      await changePassword(user.hasPassword ? currentPw : null, newPw);
      setPwSuccess('Password updated. Your other devices have been signed out.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { setPwError(e.message || 'Could not update password'); }
  }

  async function deleteAccount() {
    setDelError('');
    try {
      await api.delete('/api/profile/account', { confirm: delConfirm, password: delPw });
      await logout();
    } catch (e) { setDelError(e.message); }
  }

  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <div className="text-[13.5px] space-y-1.5 dark:text-gray-200">
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Name</span><b>{user?.name}</b></div>
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Email</span><b>{user?.email}</b> {user?.emailVerified ? <span className="text-emerald text-xs">verified</span> : <span className="text-warn text-xs">not verified</span>}</div>
          <div><span className="text-inkMuted dark:text-gray-400 w-28 inline-block">Signed in via</span><b>{user?.authProvider === 'google' ? 'Google' : 'Email & password'}</b></div>
        </div>
      </Card>

      <SectionTitle>Appearance & privacy</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700 divide-y divide-line dark:divide-gray-700">
        <Row title="Dark mode" hint="Saved across sessions."><Toggle on={darkMode} onChange={toggleDarkMode} label="Dark mode" /></Row>
        <Row title="Amounts visible right now" hint="When hidden, all monetary values show as ••••. Also available in the top bar."><Toggle on={!hidden} onChange={toggle} label="Show amounts" /></Row>
        <Row title="Hide amounts when I open the app" hint="Protects against shoulder-surfing. This is your saved default."><Toggle on={state.privacyModeDefault !== false} onChange={togglePrivacyDefault} label="Hide amounts by default" /></Row>
      </Card>

      <SectionTitle>{user?.hasPassword ? 'Change password' : 'Set a password'}</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        {!user?.hasPassword && <p className="text-inkMuted dark:text-gray-400 text-[13px] mb-3">You signed in with Google. Set a password to also log in with email (needs a recent Google sign-in).</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {user?.hasPassword && (
            <Field label="Current password"><input type="password" autoComplete="current-password" maxLength={72} className={inputClass} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></Field>
          )}
          <Field label="New password" hint="8–72 characters."><input type="password" autoComplete="new-password" maxLength={72} className={inputClass} value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
          <Field label="Confirm new password"><input type="password" autoComplete="new-password" maxLength={72} className={inputClass} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></Field>
        </div>
        {pwError && <p className="text-clay text-[12.5px] mt-2" role="alert">{pwError}</p>}
        {pwSuccess && <p className="text-emerald text-[12.5px] mt-2" role="status">{pwSuccess}</p>}
        <Btn variant="secondary" className="mt-3" onClick={submitPasswordChange}>{user?.hasPassword ? 'Update password' : 'Set password'}</Btn>
      </Card>

      <SectionTitle>E-mail notifications</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700 divide-y divide-line dark:divide-gray-700">
        <Row title="Weekly summary" hint="Mondays: last 7 days of spending."><Toggle on={prefs.weekly} onChange={() => togglePref('weekly')} label="Weekly summary" /></Row>
        <Row title="Monthly summary" hint="Start of month: last month's spending, portfolio and net worth."><Toggle on={prefs.monthly} onChange={() => togglePref('monthly')} label="Monthly summary" /></Row>
        <Row title="Reminders" hint="FD maturity and insurance premium due dates."><Toggle on={prefs.reminders} onChange={() => togglePref('reminders')} label="Reminders" /></Row>
        <div className="pt-3 flex items-center gap-3 flex-wrap">
          <Btn variant="secondary" onClick={sendTestEmail}>Send test e-mail</Btn>
          <span className="text-inkMuted dark:text-gray-500 text-[11px]">Goes to <b>{user?.email}</b>. E-mails are only sent to verified addresses.</span>
        </div>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <p className="text-[13px] text-inkMuted dark:text-gray-400 mb-3">Download everything we hold about you, or delete your account and all of its data permanently.</p>
        <div className="flex gap-2 flex-wrap">
          <a href={`${API_BASE}/api/export/all.json`} className="inline-flex"><Btn variant="secondary" type="button">Export all data (JSON)</Btn></a>
          <Btn variant="danger" onClick={() => { setDelError(''); setDelPw(''); setDelConfirm(''); setDelOpen(true); }}>Delete account…</Btn>
        </div>
      </Card>

      <SectionTitle>Session</SectionTitle>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <ul className="text-[13px] text-inkMuted dark:text-gray-400 space-y-1.5 list-disc pl-4 mb-4">
          <li>Sessions last 7 days and can be revoked at any time.</li>
          <li>The session cookie is httpOnly - page scripts cannot read it.</li>
          <li>Passwords are bcrypt-hashed and never stored in plain text.</li>
        </ul>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={logout}>Log out</Btn>
          <Btn variant="secondary" onClick={logoutEverywhere}>Log out everywhere</Btn>
        </div>
      </Card>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account">
        <p className="text-[13px] text-inkMuted mb-3">This permanently erases your account and every record in it. It cannot be undone - export your data first if you want a copy.</p>
        <div className="space-y-3">
          {user?.hasPassword && <Field label="Your password"><input type="password" autoComplete="current-password" className={inputClass} value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field>}
          <Field label="Type DELETE to confirm"><input className={inputClass} value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} autoComplete="off" /></Field>
        </div>
        {delError && <p className="text-clay text-[12.5px] mt-2" role="alert">{delError}</p>}
        <ModalActions>
          <Btn variant="secondary" onClick={() => setDelOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={deleteAccount} disabled={delConfirm !== 'DELETE'}>Delete everything</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
