'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import AuthCard from '@/components/AuthCard';

export default function VerifyEmailPage() {
  const { refresh } = useAuth();
  const [status, setStatus] = useState('working'); // working | ok | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (token) window.history.replaceState({}, '', window.location.pathname);
    if (!token) { setStatus('error'); setMessage('This verification link is incomplete.'); return; }
    api.post('/api/auth/verify-email', { token })
      .then(() => { setStatus('ok'); refresh(); })
      .catch((e) => { setStatus('error'); setMessage(e.message); });
  }, [refresh]);

  return (
    <AuthCard>
      {status === 'working' && <p className="text-[13px] text-inkMuted" role="status">Verifying your e-mail…</p>}
      {status === 'ok' && <p className="text-[13px]" role="status">Your e-mail address is verified. <Link href="/" className="text-accent font-semibold">Continue to FinanceTracer</Link></p>}
      {status === 'error' && <p className="text-clay text-[13px]" role="alert">{message} <Link href="/" className="text-accent font-semibold">Go to FinanceTracer</Link> and use “Resend verification” in the banner.</p>}
    </AuthCard>
  );
}
