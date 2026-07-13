'use client';

import { useState, useEffect } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, Field, inputClass, Btn } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import {
  netWorth,
  grossAssets,
  totalLiabilities,
  debtRatio,
  liquidCash,
  avgMonthlyExpense,
  emergencyFundMonths,
  yearsToFI,
  recommendedTermCover,
  ageFromDOB,
  yearsToRetirement,
  fmtINR,
} from '@/lib/utils';

function riskBadge(level) {
  const map = {
    good: 'bg-emeraldBg text-emerald',
    warn: 'bg-warnBg text-warn',
    risk: 'bg-clayBg text-clay',
  };
  const label = { good: 'Good', warn: 'Getting there', risk: 'Needs attention' }[level];
  return <span className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full ${map[level]}`}>{label}</span>;
}

export default function HealthCheckSection() {
  const { state, ready, updateFinancialProfile } = useFinance();
  const [dob, setDob] = useState('');
  const [income, setIncome] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (ready && state && !profileLoaded) {
      setDob(state.financialProfile?.dateOfBirth ?? '');
      setIncome(state.financialProfile?.monthlyIncome ?? '');
      setProfileLoaded(true);
    }
  }, [ready, state, profileLoaded]);

  if (!ready || !state) return null;

  const expense = avgMonthlyExpense(state);
  const cash = liquidCash(state);
  const efMonths = emergencyFundMonths(state);
  const nw = netWorth(state);
  const assets = grossAssets(state);
  const liabilities = totalLiabilities(state);
  const ratio = debtRatio(state);
  const monthlyIncome = Number(income) || 0;
  const savingsRatePct = monthlyIncome ? Math.max(0, ((monthlyIncome - expense) / monthlyIncome) * 100) : null;
  const years = savingsRatePct !== null ? yearsToFI(savingsRatePct) : null;
  const annualExpense = expense * 12;
  const idealTermCover = recommendedTermCover(annualExpense, nw);
  const age = ageFromDOB(dob);
  const retirementYears = yearsToRetirement(dob);

  function efLevel() {
    if (efMonths >= 6) return 'good';
    if (efMonths >= 3) return 'warn';
    return 'risk';
  }
  function savingsLevel() {
    if (savingsRatePct === null) return 'warn';
    if (savingsRatePct >= 30) return 'good';
    if (savingsRatePct >= 15) return 'warn';
    return 'risk';
  }
  function debtLevel() {
    if (ratio === 0) return 'good';
    if (ratio <= 30) return 'good';
    if (ratio <= 50) return 'warn';
    return 'risk';
  }

  function saveProfile() {
    updateFinancialProfile({ dateOfBirth: dob || '', monthlyIncome: income === '' ? '' : Number(income) });
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Pulled from what you've already tracked — your average monthly spend (months with something logged), liquid cash, and net
        worth. Date of birth and income are the only two things you enter here.
      </p>

      <Card className="mb-5">
        <div className="font-display font-semibold text-[15px] mb-3">Financial profile</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date of birth (optional)">
            <input type="date" className={inputClass} value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Monthly income (optional)">
            <input type="number" className={inputClass} placeholder="e.g. 80000" value={income} onChange={(e) => setIncome(e.target.value)} />
          </Field>
        </div>
        {age !== null && (
          <p className="text-inkMuted text-xs mt-2">
            Age {age}
            {retirementYears !== null ? ` · ${retirementYears} year${retirementYears === 1 ? '' : 's'} to a typical retirement age of 60` : ''}
          </p>
        )}
        <Btn className="mt-3" variant="secondary" onClick={saveProfile}>
          Save
        </Btn>
      </Card>

      <SectionTitle>Emergency fund</SectionTitle>
      <Card className="mb-5">
        <div className="flex justify-between items-start mb-2">
          <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted">Liquid cash ÷ avg. monthly spend</div>
          {riskBadge(efLevel())}
        </div>
        <div className="font-display font-semibold text-[26px]">{efMonths.toFixed(1)} months</div>
        <div className="text-inkMuted text-xs mt-1">
          <Amount>{fmtINR(cash)}</Amount> liquid cash · <Amount>{fmtINR(expense)}</Amount>/mo average spend
        </div>
        <p className="text-inkMuted text-xs mt-3">Aim for at least 3–6 months of expenses in cash you can access immediately.</p>
      </Card>

      <SectionTitle>Savings rate & time to financial independence</SectionTitle>
      <Card className="mb-5">
        {monthlyIncome ? (
          <>
            <div className="flex justify-between items-start mb-2">
              <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted">Of income saved</div>
              {riskBadge(savingsLevel())}
            </div>
            <div className="font-display font-semibold text-[26px]">{savingsRatePct.toFixed(0)}%</div>
            <div className="text-inkMuted text-xs mt-1">
              <Amount>{fmtINR(monthlyIncome)}</Amount> income · <Amount>{fmtINR(expense)}</Amount> average spend
            </div>
            {years !== null && (
              <div className="mt-3 bg-paper rounded-md p-3 text-[13px]">
                At this rate, roughly <b>{years}</b> years to financial independence (25× annual expenses, common FIRE rule of thumb).
              </div>
            )}
            <p className="text-inkMuted text-xs mt-3">Try to save at least 20% of income — cut discretionary spending first if you're below that.</p>
          </>
        ) : (
          <p className="text-inkMuted text-[13px]">Enter your monthly income above to see this.</p>
        )}
      </Card>

      <SectionTitle>Recommended insurance cover</SectionTitle>
      <Card className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-1">Term life — rule of thumb</div>
        <div className="font-display font-semibold text-[22px]">
          <Amount>{fmtINR(idealTermCover)}</Amount>
        </div>
        <div className="text-inkMuted text-xs mt-1">Formula: 25 × annual expenses − current net worth</div>
        <div className="mt-4 pt-4 border-t border-line">
          <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-1">Health cover — general guidance</div>
          <div className="text-[13px]">Minimum ₹5L, ideally ₹10L+ per person, more in metro cities or with dependents.</div>
        </div>
        <p className="text-inkMuted text-xs mt-3">
          Check what you actually have under More → Insurance and compare — these are generic rules of thumb, not personalised
          advice.
        </p>
      </Card>

      <SectionTitle>Debt ratio</SectionTitle>
      <Card>
        <div className="flex justify-between items-start mb-2">
          <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted">Liabilities ÷ gross assets</div>
          {riskBadge(debtLevel())}
        </div>
        <div className="font-display font-semibold text-[26px]">{ratio.toFixed(0)}%</div>
        <div className="text-inkMuted text-xs mt-1">
          <Amount>{fmtINR(liabilities)}</Amount> owed vs <Amount>{fmtINR(assets)}</Amount> in assets
        </div>
        <p className="text-inkMuted text-xs mt-3">
          {liabilities === 0 ? 'No liabilities tracked — nothing to worry about here.' : 'Generally, under 30% is comfortable; above 50% is worth a closer look.'}
        </p>
      </Card>
    </>
  );
}
