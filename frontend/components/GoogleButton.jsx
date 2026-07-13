'use client';

import { useAuth } from '@/lib/AuthContext';

export default function GoogleButton({ label = 'Continue with Google' }) {
  const { googleEnabled, googleLoginUrl } = useAuth();
  if (!googleEnabled) return null;

  return (
    <>
      <a
        href={googleLoginUrl()}
        className="w-full flex items-center justify-center gap-2.5 border border-line rounded-md py-2.5 text-[13.5px] font-medium text-ink bg-white hover:bg-paper transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 009 18z" />
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
        </svg>
        {label}
      </a>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-line" />
        <span className="text-inkMuted text-[11px] uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-line" />
      </div>
    </>
  );
}
