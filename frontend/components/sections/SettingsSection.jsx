'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { usePrivacy } from '@/lib/PrivacyContext';
import { Card, SectionTitle, Btn, Field, inputClass } from '@/components/ui';

export default function SettingsSection() {
  const { state, ready } = useFinance();
  const { user, logout, changePassword } = useAuth();
  const { hidden, toggle } = usePrivacy();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  if (!ready || !state) return null;

  async function submitPasswordChange() {
    setPwError('');
    setPwSuccess('');
    if (newPw.length < 8) return setPwError('New password must be at least 8 characters');
    if (newPw !== confirmPw) return setPwError("New passwords don't match");
    setPwSaving(true);
    try {
      await changePassword(user.hasPassword ? currentPw : null, newPw);
      setPwSuccess('Password updated.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      setPwError(e.message || 'Could not update password');
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card>
        <div className="text-[13.5px] space-y-1">
          <div>
            <span className="text-inkMuted">Name:</span> <b>{user?.name}</b>
          </div>
          <div>
            <span className="text-inkMuted">Email:</span> <b>{user?.email}</b>
          </div>
          <div>
            <span className="text-inkMuted">Signed up via:</span> <b>{user?.authProvider === 'google' ? 'Google' : 'Email & password'}</b>
          </div>
        </div>
        <p className="text-inkMuted text-xs mt-3">
          Date of birth and monthly income are set under More → Health Check, since that's where they're used.
        </p>
      </Card>

      <SectionTitle>{user?.hasPassword ? 'Change password' : 'Set a password'}</SectionTitle>
      <Card>
        {!user?.hasPassword && (
          <p className="text-inkMuted text-[13px] mb-3">
            You signed in with Google and don&apos;t have a password yet — set one so you can also log in with email, or if you
            ever want to disconnect Google.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {user?.hasPassword && (
            <Field label="Current password">
              <input type="password" className={inputClass} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </Field>
          )}
          <Field label="New password" hint="At least 8 characters.">
            <input type="password" className={inputClass} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" className={inputClass} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </Field>
        </div>
        {pwError && <p className="text-clay text-[12.5px] mt-2">{pwError}</p>}
        {pwSuccess && <p className="text-emerald text-[12.5px] mt-2">{pwSuccess}</p>}
        <Btn variant="secondary" className="mt-3" onClick={submitPasswordChange} disabled={pwSaving}>
          {pwSaving ? 'Saving…' : user?.hasPassword ? 'Update password' : 'Set password'}
        </Btn>
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[13.5px] font-medium">Hide amounts by default</div>
            <p className="text-inkMuted text-xs mt-1 max-w-sm">
              When on, money figures across Wealth, Holdings, Allocation, Transactions, Insurance and Insights are masked — and
              editable amount fields switch to view-only — until you tap the eye icon in the top bar. Daily spends on Overview are
              never masked.
            </p>
          </div>
          <Btn variant="secondary" onClick={toggle}>
            {hidden ? 'Currently hidden — show now' : 'Currently visible — hide now'}
          </Btn>
        </div>
      </Card>

      <SectionTitle>Session & security</SectionTitle>
      <Card>
        <ul className="text-[13px] text-inkMuted space-y-2 list-disc pl-4">
          <li>You&apos;re automatically logged out after 7 days and need to sign in again — this is enforced by the backend, not just this browser.</li>
          <li>Your session cookie is httpOnly, so page scripts (including any injected via a compromised extension) can&apos;t read it.</li>
          <li>Passwords are hashed, never stored or emailed in plain text.</li>
        </ul>
        <Btn variant="secondary" className="mt-4" onClick={logout}>
          Log out now
        </Btn>
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <p className="text-[13px] text-inkMuted">
          At month-end you&apos;ll get an email with your total spend and overall investment P/L (not a holdings breakdown, not your
          total balance). Insurance and other deadlines email you starting 60 days before they&apos;re due.
        </p>
      </Card>
    </>
  );
}
