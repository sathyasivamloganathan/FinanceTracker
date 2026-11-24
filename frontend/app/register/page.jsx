'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Field, inputClass, Btn } from '@/components/ui';
import GoogleButton from '@/components/GoogleButton';
import AuthCard from '@/components/AuthCard';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (new TextEncoder().encode(password).length > 72) return setError('Password must be at most 72 bytes');
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  }

  return (
    <AuthCard subtitle="Create your private finance desk. Your data isn’t shared with anyone.">
      <GoogleButton label="Sign up with Google" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input required autoComplete="name" maxLength={100} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email">
          <input type="email" required autoComplete="username" maxLength={254} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="8–72 characters. We’ll e-mail you a link to confirm your address.">
          <div className="relative">
            <input type={show ? 'text' : 'password'} required minLength={8} maxLength={72} autoComplete="new-password" className={`${inputClass} pr-14`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-inkMuted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        {error && <p className="text-clay text-[12.5px]" role="alert">{error}</p>}
        <Btn type="submit" className="w-full justify-center">Create account</Btn>
      </form>
      <p className="text-inkMuted text-[13px] mt-5 text-center">Already registered? <Link href="/login" className="text-accent font-semibold">Log in</Link></p>
    </AuthCard>
  );
}
