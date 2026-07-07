'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, PageHead, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { fmtINR, monthKey, monthLabel, dueStatus } from '@/lib/utils';

export default function OverviewPage() {
  const { state, ready } = useFinance();
  const { user } = useAuth();

  if (!ready || !state) return null;

  const mk = monthKey(new Date());
  const monthExpenses = state.expenses.filter((e) => e.date.slice(0, 7) === mk);
  const total = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCat = {};
  monthExpenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)));
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const chartData = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  const dueSoon = state.insurance.filter((p) => {
    const s = dueStatus(p.dueDate);
    return s.cls === 'soon' || s.cls === 'late';
  });

  const firstName = (user?.name || '').split(' ')[0];

  return (
    <>
      <PageHead eyebrow="Overview" title={firstName ? `Hi, ${firstName}` : 'Overview'} />

      <p className="text-inkMuted text-[13.5px] max-w-xl mb-5">
        Your balances and holdings live under <b>Wealth</b> — kept off this screen on purpose. This page only shows day-to-day
        spending, which you said was fine to see up front.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label={`Spent in ${monthLabel(mk)}`} value={fmtINR(total)} />
        <StatCard label="Top category" value={topCat ? topCat[0] : '—'} delta={topCat ? fmtINR(topCat[1]) : ''} deltaClass="text-inkMuted" />
      </div>

      <SectionTitle
        action={
          <Link href="/money" className="text-brass text-[13px] font-semibold">
            Open Money →
          </Link>
        }
      >
        This month by category
      </SectionTitle>
      <Card>
        <div className="h-[220px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => '₹' + v} fontSize={11} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11.5} />
                <Tooltip formatter={(v) => fmtINR(v)} />
                <Bar dataKey="value" fill="#1C2430" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Nothing spent yet this month">Log a spend from the Money tab to see it here.</EmptyState>
          )}
        </div>
      </Card>

      {dueSoon.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href="/more" className="text-brass text-[13px] font-semibold">
                Open More →
              </Link>
            }
          >
            Upcoming renewals
          </SectionTitle>
          <Card>
            <ul className="text-[13.5px] space-y-2">
              {dueSoon.map((p) => {
                const s = dueStatus(p.dueDate);
                return (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name} <span className="text-inkMuted text-xs">({p.type})</span></span>
                    <span className={s.cls === 'late' ? 'text-clay' : 'text-warn'}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>Quick links</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link href="/wealth"><Card className="hover:border-brass transition-colors"><div className="font-display font-semibold">Wealth</div><div className="text-inkMuted text-xs mt-1">Net worth, holdings, transactions, liabilities, allocation, advisor</div></Card></Link>
        <Link href="/money"><Card className="hover:border-brass transition-colors"><div className="font-display font-semibold">Money</div><div className="text-inkMuted text-xs mt-1">Daily spends, kept separate from investments</div></Card></Link>
        <Link href="/more"><Card className="hover:border-brass transition-colors"><div className="font-display font-semibold">More</div><div className="text-inkMuted text-xs mt-1">Insurance, health check, goals, settings</div></Card></Link>
      </div>
    </>
  );
}
