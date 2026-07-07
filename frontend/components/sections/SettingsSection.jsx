'use client';

import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { usePrivacy } from '@/lib/PrivacyContext';
import { Card, SectionTitle, Btn } from '@/components/ui';

export default function SettingsSection() {
  const { state, ready } = useFinance();
  const { user, logout } = useAuth();
  const { hidden, toggle } = usePrivacy();

  if (!ready || !state) return null;

  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card>
        <div className="text-[13.5px]">
          <div className="mb-1"><span className="text-inkMuted">Name:</span> <b>{user?.name}</b></div>
          <div><span className="text-inkMuted">Email:</span> <b>{user?.email}</b></div>
        </div>
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[13.5px] font-medium">Hide amounts by default</div>
            <p className="text-inkMuted text-xs mt-1 max-w-sm">
              When on, money figures across Wealth, Holdings, Allocation, Transactions and Insurance are masked until you tap the
              eye icon in the top bar. Your daily spends on Overview are never masked — you asked to always see those.
            </p>
          </div>
          <Btn variant="secondary" onClick={toggle}>
            {hidden ? 'Currently hidden — show now' : 'Currently visible — hide now'}
          </Btn>
        </div>
      </Card>

      <SectionTitle>Session & security</SectionTitle>
      <Card>
        <ul className="text-[13px] text-inkMuted space-y-2 list-disc pl-4">
          <li>You&apos;re automatically logged out after 7 days and need to sign in again.</li>
          <li>Your session cookie is httpOnly, so page scripts (including any injected via a compromised extension) can&apos;t read it.</li>
          <li>Passwords are hashed, never stored or emailed in plain text.</li>
        </ul>
        <Btn variant="secondary" className="mt-4" onClick={logout}>
          Log out now
        </Btn>
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <p className="text-[13px] text-inkMuted">
          At month-end you&apos;ll get an email with your total spend and overall investment P/L (not a holdings breakdown, not your
          total balance). Insurance and other deadlines email you starting 60 days before they&apos;re due.
        </p>
      </Card>
    </>
  );
}
