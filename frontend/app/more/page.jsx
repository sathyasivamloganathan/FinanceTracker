'use client';

import { useState } from 'react';
import { PageHead } from '@/components/ui';
import SubTabs from '@/components/SubTabs';
import { MORE_TABS } from '@/lib/constants';
import InsuranceSection from '@/components/sections/InsuranceSection';
import HealthCheckSection from '@/components/sections/HealthCheckSection';
import GoalsSection from '@/components/sections/GoalsSection';
import SettingsSection from '@/components/sections/SettingsSection';

export default function MorePage() {
  const [tab, setTab] = useState('insurance');

  return (
    <>
      <PageHead eyebrow="Policies · Health Check · Account" title="More" />
      <SubTabs tabs={MORE_TABS} active={tab} onChange={setTab} />
      {tab === 'insurance' && <InsuranceSection />}
      {tab === 'health' && <HealthCheckSection />}
      {tab === 'goals' && <GoalsSection />}
      {tab === 'settings' && <SettingsSection />}
    </>
  );
}
