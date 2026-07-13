'use client';

import { useState } from 'react';
import { PageHead } from '@/components/ui';
import SubTabs from '@/components/SubTabs';
import { MORE_TABS } from '@/lib/constants';
import InsightsSection from '@/components/sections/InsightsSection';
import InsuranceSection from '@/components/sections/InsuranceSection';
import HealthCheckSection from '@/components/sections/HealthCheckSection';
import GoalsSection from '@/components/sections/GoalsSection';
import SettingsSection from '@/components/sections/SettingsSection';

export default function MorePage() {
  const [tab, setTab] = useState('insights');

  return (
    <>
      <PageHead eyebrow="Insights · Policies · Account" title="More" />
      <SubTabs tabs={MORE_TABS} active={tab} onChange={setTab} />
      {tab === 'insights' && <InsightsSection />}
      {tab === 'insurance' && <InsuranceSection />}
      {tab === 'health' && <HealthCheckSection />}
      {tab === 'goals' && <GoalsSection />}
      {tab === 'settings' && <SettingsSection />}
    </>
  );
}
