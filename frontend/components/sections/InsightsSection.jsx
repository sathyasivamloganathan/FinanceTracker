'use client';

import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Tag, EmptyState } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import {
  netWorth,
  computeCategoryTotals,
  holdingInvestedValue,
  holdingCurrentValue,
  totalCurrentEquityValue,
  totalInvestedEquityValue,
  monthTotal,
  monthKey,
  monthLabel,
  shiftMonthKey,
  fmtINR,
  fmtPct,
  dueStatus,
} from '@/lib/utils';

export default function InsightsSection() {
  const { state, ready } = useFinance();

  const computed = useMemo(() => {
    if (!state) return null;

    const holdingsWithPL = state.holdings
      .map((h) => {
        const inv = holdingInvestedValue(h);
        const cur = holdingCurrentValue(h);
        const pl = cur - inv;
        const plPct = inv ? (pl / inv) * 100 : 0;
        return { ...h, inv, cur, pl, plPct };
      })
      .filter((h) => h.inv > 0);
    const gainers = [...holdingsWithPL].sort((a, b) => b.plPct - a.plPct).slice(0, 3);
    const losers = [...holdingsWithPL].sort((a, b) => a.plPct - b.plPct).slice(0, 3);

    const thisMonth = monthKey(new Date());
    const lastMonth = shiftMonthKey(thisMonth, -1);
    const thisMonthSpend = monthTotal(state.expenses, thisMonth);
    const lastMonthSpend = monthTotal(state.expenses, lastMonth);
    const spendChange = lastMonthSpend ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : null;

    const months6 = [];
    for (let i = 5; i >= 0; i--) months6.push(shiftMonthKey(thisMonth, -i));
    const spendTrend = months6.map((mk) => ({ name: monthLabel(mk).split(' ')[0], value: monthTotal(state.expenses, mk) }));

    const thisMonthExpenses = state.expenses.filter((e) => e.date.slice(0, 7) === thisMonth);
    const byCat = {};
    thisMonthExpenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)));
    const topCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const biggestExpenses = [...thisMonthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

    const totals = computeCategoryTotals(state);
    const nw = netWorth(state);
    const drift = Object.keys({ ...totals, ...state.targets })
      .map((cat) => {
        const actualPct = nw ? ((totals[cat] || 0) / nw) * 100 : 0;
        const targetPct = Number(state.targets[cat] || 0);
        return { cat, drift: actualPct - targetPct };
      })
      .filter((d) => Math.abs(d.drift) > 3)
      .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    const snapshots = [...state.netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const nwTrend = snapshots.map((s) => ({ name: s.date, value: s.netWorth }));

    const dueSoon = state.insurance.filter((p) => {
      const s = dueStatus(p.dueDate);
      return s.cls === 'soon' || s.cls === 'late';
    });

    const eqCur = totalCurrentEquityValue(state);
    const eqInv = totalInvestedEquityValue(state);

    return { gainers, losers, thisMonthSpend, lastMonthSpend, spendChange, spendTrend, topCategories, biggestExpenses, drift, nwTrend, dueSoon, eqCur, eqInv };
  }, [state]);

  if (!ready || !state || !computed) return null;

  const { gainers, losers, thisMonthSpend, lastMonthSpend, spendChange, spendTrend, topCategories, biggestExpenses, drift, nwTrend, dueSoon, eqCur, eqInv } = computed;
  const eqPl = eqCur - eqInv;
  const eqPlPct = eqInv ? (eqPl / eqInv) * 100 : 0;

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-5">
        A single view across everything you've tracked — portfolio performance, spending trends, and where your allocation has
        drifted.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Portfolio P/L"
          value={
            <Amount>
              <span className={eqPl >= 0 ? 'text-emerald' : 'text-clay'}>{fmtINR(eqPl)}</span>
            </Amount>
          }
          delta={fmtPct(eqPlPct)}
          deltaClass={eqPl >= 0 ? 'text-emerald' : 'text-clay'}
        />
        <StatCard
          label="Spend this month"
          value={<Amount>{fmtINR(thisMonthSpend)}</Amount>}
          delta={spendChange === null ? 'no prior month to compare' : `${fmtPct(spendChange)} vs last month`}
          deltaClass={spendChange === null ? 'text-inkMuted' : spendChange > 0 ? 'text-clay' : 'text-emerald'}
        />
        <StatCard label="Renewals due soon" value={String(dueSoon.length)} delta={dueSoon.length ? 'within 60 days' : 'none upcoming'} deltaClass="text-inkMuted" />
      </div>

      <SectionTitle>Net worth trend</SectionTitle>
      <Card>
        <div className="h-[200px]">
          {nwTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nwTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis tickFormatter={(v) => '₹' + v} fontSize={10} width={55} />
                <Tooltip formatter={(v) => fmtINR(v)} />
                <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Not enough snapshots yet">Take a couple of net worth snapshots (Wealth → Net Worth) to see a trend here.</EmptyState>
          )}
        </div>
      </Card>

      <SectionTitle>Best & worst performing holdings</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-3">Top gainers</div>
          {gainers.length ? (
            <ul className="space-y-2.5">
              {gainers.map((h) => (
                <li key={h.id} className="flex justify-between items-center text-[13px]">
                  <span>{h.name}</span>
                  <span className="text-emerald font-mono">{fmtPct(h.plPct)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-inkMuted text-[13px]">No holdings with a purchase cost yet.</p>
          )}
        </Card>
        <Card>
          <div className="font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-3">Biggest laggards</div>
          {losers.length ? (
            <ul className="space-y-2.5">
              {losers.map((h) => (
                <li key={h.id} className="flex justify-between items-center text-[13px]">
                  <span>{h.name}</span>
                  <span className="text-clay font-mono">{fmtPct(h.plPct)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-inkMuted text-[13px]">No holdings with a purchase cost yet.</p>
          )}
        </Card>
      </div>

      <SectionTitle>Spend trend (6 months)</SectionTitle>
      <Card>
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10.5} />
              <YAxis tickFormatter={(v) => '₹' + v} fontSize={10} />
              <Tooltip formatter={(v) => fmtINR(v)} />
              <Bar dataKey="value" fill="#101828" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <SectionTitle>This month's top categories</SectionTitle>
      {topCategories.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map(([cat, amt]) => (
                <tr key={cat}>
                  <td>
                    <Tag>{cat}</Tag>
                  </td>
                  <td className="num">
                    <Amount>{fmtINR(amt)}</Amount>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Nothing logged this month yet" />
      )}

      <SectionTitle>Biggest single expenses this month</SectionTitle>
      {biggestExpenses.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {biggestExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>
                    <Tag>{e.category}</Tag>
                  </td>
                  <td>{e.description || '—'}</td>
                  <td className="num">
                    <Amount>{fmtINR(e.amount)}</Amount>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Nothing logged this month yet" />
      )}

      <SectionTitle>Allocation drift</SectionTitle>
      {drift.length ? (
        <Card>
          <ul className="space-y-2.5">
            {drift.map((d) => (
              <li key={d.cat} className="flex justify-between items-center text-[13px]">
                <span>{d.cat}</span>
                <span className={d.drift > 0 ? 'text-clay font-mono' : 'text-emerald font-mono'}>
                  {d.drift > 0 ? 'Overweight' : 'Underweight'} by {Math.abs(d.drift).toFixed(1)} pts
                </span>
              </li>
            ))}
          </ul>
          <p className="text-inkMuted text-xs mt-3">See Wealth → Allocation to rebalance.</p>
        </Card>
      ) : (
        <EmptyState title="Everything's within 3 points of target">No rebalancing needed right now.</EmptyState>
      )}
    </>
  );
}
