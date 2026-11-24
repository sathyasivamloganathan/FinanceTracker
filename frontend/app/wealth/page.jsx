'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { PageHead } from '@/components/ui';
import SubTabs from '@/components/SubTabs';
import { WEALTH_TABS } from '@/lib/constants';
import NetWorthSection from '@/components/sections/NetWorthSection';
import HoldingsSection from '@/components/sections/HoldingsSection';
import TransactionsSection from '@/components/sections/TransactionsSection';
import FDSection from '@/components/sections/FDSection';
import LiabilitiesSection from '@/components/sections/LiabilitiesSection';
import AllocationSection from '@/components/sections/AllocationSection';
import AdvisorSection from '@/components/sections/AdvisorSection';

export default function WealthPage() {
  const [tab, setTab] = useState('networth');

  return (
    <AppShell section="wealth">
      <PageHead eyebrow="Assets · Liabilities · Allocation" title="Wealth" />
      <SubTabs tabs={WEALTH_TABS} active={tab} onChange={setTab} />
      {tab === 'networth'     && <NetWorthSection />}
      {tab === 'holdings'     && <HoldingsSection />}
      {tab === 'transactions' && <TransactionsSection />}
      {tab === 'fds'          && <FDSection />}
      {tab === 'liabilities'  && <LiabilitiesSection />}
      {tab === 'allocation'   && <AllocationSection />}
      {tab === 'advisor'      && <AdvisorSection />}
    </AppShell>
  );
}
