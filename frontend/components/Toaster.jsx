'use client';

import { useFinance } from '@/lib/FinanceContext';

export default function Toaster() {
  const { toasts, dismissToast } = useFinance();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[60] flex flex-col gap-2 max-w-[360px]" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg shadow-lg border px-4 py-3 text-[13px] flex items-start gap-3 ${
            t.kind === 'error'
              ? 'bg-clayBg text-clay border-clay/30 dark:bg-red-950 dark:text-red-200'
              : 'bg-emeraldBg text-emerald border-emerald/30 dark:bg-emerald-950 dark:text-emerald-200'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}
