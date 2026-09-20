'use client';

import AppShell from '@/components/AppShell';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { Amount } from '@/lib/PrivacyContext';
import { Card, PageHead, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { fmtINR, monthKey, monthLabel, netWorth, grossAssets, totalLiabilities, totalInvested, totalCurrentEquityValue, totalInvestedEquityValue, holdingCurrentValue, holdingInvestedValue, dueStatus } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/constants';
import Link from 'next/link';

export default function OverviewPage() {
  const { state, ready } = useFinance();
  const { user } = useAuth();

  if (!ready || !state) {
    return (
      <AppShell section="overview">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-line dark:bg-gray-700 rounded-md" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-line dark:bg-gray-700 rounded-xl" />)}
          </div>
          <div className="h-64 bg-line dark:bg-gray-700 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  const mk = monthKey(new Date());
  const allMonthExpenses = state.expenses.filter(e => e.date.slice(0, 7) === mk);
  const monthExpenses = allMonthExpenses.filter(e => e.expenseType === 'expense' || !e.expenseType);
  const monthIncome   = allMonthExpenses.filter(e => e.expenseType === 'income');

  const totalSpend  = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalIncome = monthIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
  const nw          = netWorth(state);
  const invested    = state.holdings.reduce((s, h) => s + (Number(h.qty) * Number(h.currentRate)), 0);
  const investedCost= state.holdings.reduce((s, h) => s + (Number(h.qty) * Number(h.avgRate)), 0);
  const pl          = invested - investedCost;

  const byCat = {};
  monthExpenses.forEach(e => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)));
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const chartData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const activeFDs = (state.fds || []).filter(f => f.status === 'active');
  const totalFD   = activeFDs.reduce((s, f) => s + Number(f.principal || 0), 0);
  const bankTotal = (state.bankAccounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);

  const dueSoon = state.insurance.filter(p => { const s = dueStatus(p.dueDate); return s.cls === 'soon' || s.cls === 'late'; });
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <AppShell section="overview">
      <PageHead eyebrow="Overview" title={firstName ? `Hi, ${firstName} 👋` : 'Overview'} />

      {/* Net worth + key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Net worth" value={<Amount>{fmtINR(nw)}</Amount>} />
        <StatCard label="Portfolio P/L"
          value={<Amount><span className={pl >= 0 ? 'text-emerald' : 'text-clay'}>{pl >= 0 ? '+' : ''}{fmtINR(pl)}</span></Amount>}
          delta={investedCost ? `${pl >= 0 ? '+' : ''}${((pl / investedCost) * 100).toFixed(1)}%` : ''}
          deltaClass={pl >= 0 ? 'text-emerald' : 'text-clay'} />
        <StatCard label={`Spent — ${monthLabel(mk).slice(0,3)}`} value={<Amount>{fmtINR(totalSpend)}</Amount>} />
        <StatCard label={`Income — ${monthLabel(mk).slice(0,3)}`} value={<Amount><span className="text-emerald">{fmtINR(totalIncome)}</span></Amount>} />
      </div>

      {/* Portfolio breakdown row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Bank accounts" value={<Amount>{fmtINR(bankTotal)}</Amount>} />
        <StatCard label="Fixed deposits" value={<Amount>{fmtINR(totalFD)}</Amount>} />
        <StatCard label="Top category" value={topCat ? topCat[0] : '—'} delta={topCat ? fmtINR(topCat[1]) : ''} deltaClass="text-inkMuted dark:text-gray-400" />
        {dueSoon.length > 0
          ? <StatCard label="Renewals due soon" value={String(dueSoon.length)} delta="View in More → Insurance" deltaClass="text-warn" />
          : <StatCard label="Holdings" value={String(state.holdings.length)} delta="View in Wealth" deltaClass="text-inkMuted dark:text-gray-400" />
        }
      </div>

      {/* Spend chart */}
      <SectionTitle action={<Link href="/money" className="text-[12px] text-accent hover:underline">View all →</Link>}>
        {monthLabel(mk)} spending
      </SectionTitle>
      {chartData.length > 0 ? (
        <Card className="mb-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={v => '₹' + (v >= 1000 ? Math.round(v/1000) + 'k' : v)} fontSize={10.5} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <EmptyState title="No spends logged this month">
          <Link href="/money" className="text-accent hover:underline text-[13px]">Add your first entry →</Link>
        </EmptyState>
      )}

      {/* Account balances */}
      {(state.bankAccounts || []).length > 0 && (
        <>
          <SectionTitle action={<Link href="/money" className="text-[12px] text-accent hover:underline">Manage →</Link>}>
            Account balances
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {state.bankAccounts.map(a => (
              <Card key={a.id} className="flex items-center gap-3 p-4">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                <div className="min-w-0">
                  <div className="text-[12px] text-inkMuted dark:text-gray-400 truncate">{a.name}</div>
                  <div className="font-semibold text-[15px] text-ink dark:text-gray-100 font-mono">
                    <Amount>{fmtINR(a.balance)}</Amount>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* FD summary */}
      {activeFDs.length > 0 && (
        <>
          <SectionTitle action={<Link href="/wealth" className="text-[12px] text-accent hover:underline">View all →</Link>}>
            Active Fixed Deposits
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {activeFDs.slice(0, 3).map(fd => {
              const days = Math.ceil((new Date(fd.maturityDate) - new Date()) / 86400000);
              return (
                <Card key={fd.id} className="p-4">
                  <div className="text-[12px] text-inkMuted dark:text-gray-400 mb-1">{fd.bankName}</div>
                  <div className="font-semibold text-[15px] text-ink dark:text-gray-100 font-mono"><Amount>{fmtINR(fd.principal)}</Amount></div>
                  <div className="text-[11px] text-inkMuted dark:text-gray-400 mt-1">{fd.interestRate}% · {days > 0 ? `${days}d left` : 'Matured'}</div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Insurance alerts */}
      {dueSoon.length > 0 && (
        <>
          <SectionTitle>Renewals due soon</SectionTitle>
          <Card className="mb-4 p-0 overflow-hidden">
            {dueSoon.map(p => {
              const s = dueStatus(p.dueDate);
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-line dark:border-gray-700 last:border-b-0">
                  <div>
                    <span className="text-[13.5px] font-medium text-ink dark:text-gray-100">{p.name}</span>
                    <span className="text-inkMuted dark:text-gray-400 text-xs ml-2">{p.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px]">{p.dueDate}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.cls === 'late' ? 'bg-clayBg text-clay' : 'bg-warnBg text-warn'}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </AppShell>
  );
}
