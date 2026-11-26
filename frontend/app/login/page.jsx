'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Field, inputClass, Btn } from '@/components/ui';
import GoogleButton from '@/components/GoogleButton';
import AuthCard from '@/components/AuthCard';

const URL_ERRORS = {
  google_auth_failed: 'Google sign-in failed - please try again, or use email and password.',
  google_email_unverified: 'Your Google account’s e-mail address is not verified, so it can’t be used to sign in.',
};

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) {
      setError(URL_ERRORS[code] || 'Sign-in failed.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  }

  return (
    <AuthCard subtitle="Log in to your private finance desk.">
      <GoogleButton label="Continue with Google" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" required autoComplete="username" maxLength={254} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? 'text' : 'password'} required autoComplete="current-password" maxLength={72} className={`${inputClass} pr-14`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-inkMuted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        {error && <p className="text-clay text-[12.5px]" role="alert">{error}</p>}
        <Btn type="submit" className="w-full justify-center">Log in</Btn>
      </form>
      <p className="text-[13px] mt-4 text-center"><Link href="/forgot-password" className="text-accent font-semibold">Forgot your password?</Link></p>
      <p className="text-inkMuted text-[13px] mt-3 text-center">No account? <Link href="/register" className="text-accent font-semibold">Register</Link></p>
    </AuthCard>
  );
}
