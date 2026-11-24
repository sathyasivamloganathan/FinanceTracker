'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-2">Something went wrong</h1>
        <p className="text-inkMuted text-[13px] mb-5">The page hit an unexpected error. Your data is safe — try again.</p>
        <button type="button" onClick={() => reset()} className="px-4 py-2 rounded-md bg-ink text-white text-[13px] font-semibold">Try again</button>
      </div>
    </div>
  );
}
