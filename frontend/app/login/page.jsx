'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Field, inputClass, Btn } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <div className="w-full max-w-sm bg-paperCard border border-line rounded-card p-7">
        <div className="font-display font-semibold text-[24px] text-ink mb-1">Finance Tracker</div>
        <p className="text-inkMuted text-[13px] mb-6">Log in to your private finance desk.</p>
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
          No account? <Link href="/register" className="text-brass font-semibold">Register</Link>
        </p>
      </div>
    </div>
  );
}
