'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Field, inputClass, Btn } from '@/components/ui';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-paperCard border border-line rounded-card shadow-card p-7">
        <div className="flex items-center gap-2.5 mb-1"><Logo size={30} /><span className="font-display font-bold text-[22px] text-ink">Vantage</span></div>
        <p className="text-inkMuted text-[13px] mb-6">Create your private finance desk. Your data isn&apos;t shared with anyone.</p>
        <GoogleButton label="Sign up with Google" />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input type="password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-clay text-[12.5px]">{error}</p>}
          <Btn className="w-full justify-center" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Btn>
        </form>
        <p className="text-inkMuted text-[13px] mt-5 text-center">
          Already registered? <Link href="/login" className="text-accent font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
}
