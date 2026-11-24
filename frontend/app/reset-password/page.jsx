'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Field, Btn } from '@/components/ui';
import AuthCard, { PasswordInput } from '@/components/AuthCard';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    // keep the token out of the address bar / history / referrers
    if (t) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (pw !== pw2) return setError('Passwords don’t match');
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: pw });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthCard subtitle="Choose a new password.">
      {done ? (
        <p className="text-[13px]" role="status">Password updated. <Link href="/login" className="text-accent font-semibold">Log in</Link> with your new password.</p>
      ) : !token ? (
        <p className="text-clay text-[13px]" role="alert">This reset link is incomplete. <Link href="/forgot-password" className="text-accent font-semibold">Request a new one</Link>.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="8–72 characters."><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
          {error && <p className="text-clay text-[12.5px]" role="alert">{error}</p>}
          <Btn type="submit" className="w-full justify-center">Update password</Btn>
        </form>
      )}
    </AuthCard>
  );
}
