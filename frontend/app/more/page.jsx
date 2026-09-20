'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { PageHead } from '@/components/ui';
import SubTabs from '@/components/SubTabs';
import { MORE_TABS } from '@/lib/constants';
import InsightsSection from '@/components/sections/InsightsSection';
import SpendAnalysisSection from '@/components/sections/SpendAnalysisSection';
import InsuranceSection from '@/components/sections/InsuranceSection';
import HealthCheckSection from '@/components/sections/HealthCheckSection';
import GoalsSection from '@/components/sections/GoalsSection';
import SettingsSection from '@/components/sections/SettingsSection';

export default function MorePage() {
  const [tab, setTab] = useState('insights');

  return (
    <AppShell section="more">
      <PageHead eyebrow="Insights · Analysis · Policies" title="More" />
      <SubTabs tabs={MORE_TABS} active={tab} onChange={setTab} />
      {tab === 'insights'  && <InsightsSection />}
      {tab === 'analysis'  && <SpendAnalysisSection />}
      {tab === 'insurance' && <InsuranceSection />}
      {tab === 'health'    && <HealthCheckSection />}
      {tab === 'goals'     && <GoalsSection />}
      {tab === 'settings'  && <SettingsSection />}
    </AppShell>
  );
}
