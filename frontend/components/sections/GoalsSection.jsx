'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash } from '@/components/Icons';
import { fmtINR, netWorth } from '@/lib/utils';

export default function GoalsSection() {
  const { state, ready, addGoal, deleteGoal } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '', notes: '' });

  if (!ready || !state) return null;

  const nw = netWorth(state);

  function submit() {
    if (!form.name.trim()) return alert('Enter a goal name');
    if (!(Number(form.targetAmount) > 0)) return alert('Enter a target amount');
    addGoal({ name: form.name.trim(), targetAmount: Number(form.targetAmount), targetDate: form.targetDate, notes: form.notes.trim() });
    setForm({ name: '', targetAmount: '', targetDate: '', notes: '' });
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Tracked against your current net worth — simple progress, no separate account linking needed.
      </p>

      {state.goals.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.goals.map((g) => {
            const progress = g.targetAmount ? Math.min(100, (nw / g.targetAmount) * 100) : 0;
            const remaining = Math.max(0, g.targetAmount - nw);
            return (
              <Card key={g.id}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display font-semibold text-[16px]">{g.name}</div>
                    {g.targetDate && <div className="text-inkMuted text-xs">Target date: {g.targetDate}</div>}
                  </div>
                  <IconBtn onClick={() => deleteGoal(g.id)}>
                    <IconTrash />
                  </IconBtn>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-[#E4E5E9] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1.5">
                    <span className="text-inkMuted">{progress.toFixed(0)}% there</span>
                    <span className="font-mono">
                      <Amount>{fmtINR(nw)}</Amount> / <Amount>{fmtINR(g.targetAmount)}</Amount>
                    </span>
                  </div>
                  {remaining > 0 && (
                    <div className="text-inkMuted text-xs mt-1">
                      <Amount>{fmtINR(remaining)}</Amount> to go
                    </div>
                  )}
                </div>
                {g.notes && <p className="text-inkMuted text-xs mt-3">{g.notes}</p>}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No goals yet">Set a target — retirement, a home, an emergency fund — and track progress against your net worth.</EmptyState>
      )}

      <div className="mt-4">
        <Btn onClick={() => setModalOpen(true)}>
          <IconPlus /> Add goal
        </Btn>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add a goal">
        <Field label="Goal name">
          <input className={inputClass} placeholder="e.g. Emergency fund, House down payment" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Target amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
          </Field>
          <Field label="Target date (optional)">
            <input type="date" className={inputClass} value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes (optional)">
            <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>Add goal</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
