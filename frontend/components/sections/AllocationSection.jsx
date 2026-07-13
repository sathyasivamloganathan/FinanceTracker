'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, Btn, Field, inputClass, EmptyState } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import EditableNumber from '@/components/EditableNumber';
import { IconPlus } from '@/components/Icons';
import { computeCategoryTotals, netWorth, categoryColor, fmtINR } from '@/lib/utils';

export default function AllocationSection() {
  const { state, ready, updateTarget, addTargetCategory } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', target: '' });

  if (!ready || !state) return null;

  const totals = computeCategoryTotals(state);
  const nw = netWorth(state);
  const cats = [...new Set([...Object.keys(totals), ...Object.keys(state.targets)])];
  const targetSum = Object.values(state.targets).reduce((a, b) => a + (Number(b) || 0), 0);

  const barData = cats.map((cat) => ({
    name: cat,
    Target: Number(state.targets[cat] || 0),
    Actual: nw ? ((totals[cat] || 0) / nw) * 100 : 0,
  }));
  const pieData = Object.entries(totals).map(([name, value]) => ({ name, value }));

  function submit() {
    if (!form.name.trim()) return alert('Enter a category name');
    addTargetCategory(form.name.trim(), form.target);
    setForm({ name: '', target: '' });
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-5">
        Set where you&apos;d ideally like your money split, then see how today&apos;s actual mix compares. Targets currently total{' '}
        <b className={Math.abs(targetSum - 100) < 0.5 ? 'text-emerald' : 'text-clay'}>{targetSum.toFixed(1)}%</b>
        {Math.abs(targetSum - 100) > 0.5 ? ' — aim for 100%.' : '.'}
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => v + '%'} fontSize={11} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11.5} />
                <Tooltip formatter={(v) => v.toFixed(1) + '%'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Target" fill="#BFDBFE" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Actual" fill="#1C2430" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Target %</th>
                <th className="num">Actual %</th>
                <th className="num">Drift</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => {
                const val = totals[cat] || 0;
                const actualPct = nw ? (val / nw) * 100 : 0;
                const target = Number(state.targets[cat] || 0);
                const drift = actualPct - target;
                const rebalanceAmt = (nw * (target - actualPct)) / 100;
                return (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className="num">
                      <EditableNumber value={target} step="0.5" maskable={false} onCommit={(val) => updateTarget(cat, val)} className={`${inputClass} w-[70px] text-right`} />
                    </td>
                    <td className="num">{actualPct.toFixed(1)}%</td>
                    <td className={`num ${Math.abs(drift) <= 3 ? '' : drift > 0 ? 'text-clay' : 'text-emerald'}`}>
                      {drift > 0 ? '+' : ''}
                      {drift.toFixed(1)}%
                      <div className="text-inkMuted text-xs">
                        <Amount>{rebalanceAmt >= 0 ? `Add ~${fmtINR(Math.abs(rebalanceAmt))}` : `Trim ~${fmtINR(Math.abs(rebalanceAmt))}`}</Amount>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-4">
        <Btn variant="secondary" onClick={() => setModalOpen(true)}>
          <IconPlus /> Add category
        </Btn>
      </div>

      <SectionTitle>Where money sits today</SectionTitle>
      <Card>
        <div className="h-[280px]">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="85%" paddingAngle={2}>
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={categoryColor(d.name)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Nothing to show yet">Add holdings or assets first.</EmptyState>
          )}
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add allocation category">
        <Field label="Category name">
          <input
            className={inputClass}
            placeholder="e.g. Real Estate, International Stocks, Crypto"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Target %">
            <input type="number" step="0.5" className={inputClass} placeholder="0" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          </Field>
        </div>
        <p className="text-[11.5px] text-inkMuted mt-2">
          This category will also be selectable when you add a net-worth asset (e.g. Cash, FD) under Wealth → Net Worth.
        </p>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>Add category</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
