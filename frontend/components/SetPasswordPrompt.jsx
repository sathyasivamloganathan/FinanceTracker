'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Modal, { ModalActions } from './Modal';
import { Field, inputClass, Btn } from './ui';

export default function SetPasswordPrompt() {
  const { showSetPassword, setShowSetPassword, changePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPw) return setError('Passwords don\'t match');
    try {
      await changePassword(null, password);
      setShowSetPassword(false);
    } catch (e) {
      setError(e.message || 'Could not set password');
    }
  }

  return (
    <Modal open={showSetPassword} onClose={() => setShowSetPassword(false)} title="Set a password">
      <p className="text-[13px] text-inkMuted mb-4">
        You signed in with Google — set a password too so you can also log in directly with your email, or if you ever want to
        disconnect Google. You can skip this and do it later from Settings.
      </p>
      <div className="space-y-3">
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" maxLength={72} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <input type="password" autoComplete="new-password" maxLength={72} className={inputClass} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-clay text-[12.5px] mt-2">{error}</p>}
      <ModalActions>
        <Btn variant="secondary" onClick={() => setShowSetPassword(false)}>
          Skip for now
        </Btn>
        <Btn onClick={submit}>Set password</Btn>
      </ModalActions>
    </Modal>
  );
}
