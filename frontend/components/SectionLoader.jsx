'use client';

import { useFinance } from '@/lib/FinanceContext';

export default function SectionLoader() {
  const { error, reload } = useFinance();

  if (error) {
    return (
      <div className="rounded-xl border border-clayBg bg-clayBg/30 p-6 text-center">
        <div className="text-clay font-medium mb-2">Could not load data</div>
        <div className="text-inkMuted dark:text-gray-400 text-[13px] mb-4">{error}</div>
        <button onClick={reload}
          className="px-4 py-2 bg-ink text-white text-sm rounded-md hover:bg-ink/90">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-[88px] bg-line dark:bg-gray-700 rounded-xl" />)}
      </div>
      <div className="h-[240px] bg-line dark:bg-gray-700 rounded-xl" />
      <div className="h-[180px] bg-line dark:bg-gray-700 rounded-xl" />
    </div>
  );
}
