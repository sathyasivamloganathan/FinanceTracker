'use client';

import { PageHead } from '@/components/ui';
import ExpensesSection from '@/components/sections/ExpensesSection';

export default function MoneyPage() {
  return (
    <>
      <PageHead eyebrow="Daily Spends" title="Money" />
      <p className="text-inkMuted text-[13.5px] max-w-xl -mt-3 mb-5">
        Day-to-day cash spending, kept separate from your investments — those live under Wealth.
      </p>
      <ExpensesSection />
    </>
  );
}
