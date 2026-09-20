'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import SubTabs from '@/components/SubTabs';
import { PageHead } from '@/components/ui';
import { MONEY_TABS } from '@/lib/constants';
import ExpensesSection from '@/components/sections/ExpensesSection';
import BudgetSection from '@/components/sections/BudgetSection';
import RecurringSection from '@/components/sections/RecurringSection';
import BankAccountsSection from '@/components/sections/BankAccountsSection';

export default function MoneyPage() {
  const [tab, setTab] = useState('expenses');

  return (
    <AppShell section="money">
      <PageHead eyebrow="Money" title="Daily Spends & Accounts" />
      <SubTabs tabs={MONEY_TABS} active={tab} onChange={setTab} />
      {tab === 'expenses'  && <ExpensesSection />}
      {tab === 'budget'    && <BudgetSection />}
      {tab === 'recurring' && <RecurringSection />}
      {tab === 'accounts'  && <BankAccountsSection />}
    </AppShell>
  );
}
