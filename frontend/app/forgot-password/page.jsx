'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Field, inputClass, Btn } from '@/components/ui';
import AuthCard from '@/components/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post('/api/auth/forgot-password', { email });
      setMessage(r.message || 'If an account exists for that address, a reset link is on its way.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthCard subtitle="Enter your e-mail and we’ll send you a link to choose a new password.">
      {message ? (
        <p className="text-[13px] text-ink" role="status">{message}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input type="email" required autoComplete="username" maxLength={254} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {error && <p className="text-clay text-[12.5px]" role="alert">{error}</p>}
          <Btn type="submit" className="w-full justify-center">Send reset link</Btn>
        </form>
      )}
      <p className="text-[13px] mt-5 text-center"><Link href="/login" className="text-accent font-semibold">Back to log in</Link></p>
    </AuthCard>
  );
}
