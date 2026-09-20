'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Field, inputClass, Btn } from '@/components/ui';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'google_auth_failed') {
      setError('Google sign-in failed — please try again, or use email and password.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-paperCard border border-line rounded-card shadow-card p-7">
        <div className="flex items-center gap-2.5 mb-1"><Logo size={30} /><span className="font-display font-bold text-[22px] text-ink">Vantage</span></div>
        <p className="text-inkMuted text-[13px] mb-6">Log in to your private finance desk.</p>
        <GoogleButton label="Continue with Google" />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input type="password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-clay text-[12.5px]">{error}</p>}
          <Btn className="w-full justify-center" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </Btn>
        </form>
        <p className="text-inkMuted text-[13px] mt-5 text-center">
          No account? <Link href="/register" className="text-accent font-semibold">Register</Link>
        </p>
      </div>
    </div>
  );
}
