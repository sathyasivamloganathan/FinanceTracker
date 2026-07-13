'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit } from '@/components/Icons';
import { fmtINR, netWorth, confirmDelete } from '@/lib/utils';

const BLANK = { name: '', targetAmount: '', targetDate: '', notes: '' };

export default function GoalsSection() {
  const { state, ready, addGoal, updateGoal, deleteGoal, achieveGoal, reopenGoal } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [form, setForm] = useState(BLANK);

  if (!ready || !state) return null;

  const nw = netWorth(state);
  const active = state.goals.filter((g) => !g.achieved);
  const completed = state.goals.filter((g) => g.achieved).sort((a, b) => (b.achievedDate || '').localeCompare(a.achievedDate || ''));

  function openAdd() {
    setEditingId(null);
    setForm(BLANK);
    setModalOpen(true);
  }
  function openEdit(g) {
    setEditingId(g.id);
    setForm({ name: g.name, targetAmount: String(g.targetAmount), targetDate: g.targetDate || '', notes: g.notes || '' });
    setModalOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return alert('Enter a goal name');
    if (!(Number(form.targetAmount) > 0)) return alert('Enter a target amount');
    const payload = { name: form.name.trim(), targetAmount: Number(form.targetAmount), targetDate: form.targetDate, notes: form.notes.trim() };
    if (editingId) updateGoal(editingId, payload);
    else addGoal(payload);
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Progress is tracked against your current net worth. Mark a goal achieved once you hit it — that locks in the date and the
        net worth you reached it at, so it stays on record even if net worth moves around afterward.
      </p>

      {active.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {active.map((g) => {
            const progress = g.targetAmount ? Math.min(100, (nw / g.targetAmount) * 100) : 0;
            const remaining = Math.max(0, g.targetAmount - nw);
            const reached = nw >= g.targetAmount;
            return (
              <Card key={g.id}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-[16px] truncate">{g.name}</div>
                    {g.targetDate && <div className="text-inkMuted text-xs">Target date: {g.targetDate}</div>}
                  </div>
                  <div className="flex items-center shrink-0">
                    <IconBtn danger={false} onClick={() => openEdit(g)} title="Edit">
                      <IconEdit />
                    </IconBtn>
                    <IconBtn onClick={() => confirmDelete(`Delete the goal "${g.name}"?`) && deleteGoal(g.id)} title="Delete">
                      <IconTrash />
                    </IconBtn>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-line rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${reached ? 'bg-emerald' : 'bg-accent'}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1.5">
                    <span className="text-inkMuted">{progress.toFixed(0)}% there</span>
                    <span className="font-mono">
                      <Amount>{fmtINR(nw)}</Amount> / <Amount>{fmtINR(g.targetAmount)}</Amount>
                    </span>
                  </div>
                  {!reached && (
                    <div className="text-inkMuted text-xs mt-1">
                      <Amount>{fmtINR(remaining)}</Amount> to go
                    </div>
                  )}
                </div>
                {g.notes && <p className="text-inkMuted text-xs mt-3">{g.notes}</p>}
                {reached && (
                  <Btn variant="secondary" className="mt-3 w-full justify-center" onClick={() => achieveGoal(g.id)}>
                    Mark as achieved
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No active goals">Set a target — retirement, a home, an emergency fund — and track progress against your net worth.</EmptyState>
      )}

      <div className="mt-4">
        <Btn onClick={openAdd}>
          <IconPlus /> Add goal
        </Btn>
      </div>

      <SectionTitle
        action={
          completed.length ? (
            <Btn variant="ghost" onClick={() => setShowCompleted((s) => !s)}>
              {showCompleted ? 'Hide' : `Show ${completed.length}`}
            </Btn>
          ) : null
        }
      >
        Completed goals
      </SectionTitle>
      {completed.length === 0 ? (
        <p className="text-inkMuted text-[13px]">Nothing here yet — goals you mark as achieved will show up as a record.</p>
      ) : showCompleted ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {completed.map((g) => (
            <Card key={g.id} className="opacity-80">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-display font-semibold text-[16px] truncate flex items-center gap-2">
                    {g.name}
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emeraldBg text-emerald">Achieved</span>
                  </div>
                  <div className="text-inkMuted text-xs">Reached {g.achievedDate}</div>
                </div>
                <IconBtn onClick={() => confirmDelete(`Delete the completed goal "${g.name}"?`) && deleteGoal(g.id)} title="Delete">
                  <IconTrash />
                </IconBtn>
              </div>
              <div className="text-[13px] mt-3">
                Target was <Amount>{fmtINR(g.targetAmount)}</Amount>
                {g.achievedNetWorth !== null && g.achievedNetWorth !== undefined && (
                  <>
                    {' '}
                    · net worth was <Amount>{fmtINR(g.achievedNetWorth)}</Amount> at the time
                  </>
                )}
              </div>
              {g.notes && <p className="text-inkMuted text-xs mt-2">{g.notes}</p>}
              <Btn variant="secondary" className="mt-3" onClick={() => reopenGoal(g.id)}>
                Reopen
              </Btn>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-inkMuted text-[13px]">
          {completed.length} goal{completed.length === 1 ? '' : 's'} completed — tap &quot;Show&quot; above to see them.
        </p>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit goal' : 'Add a goal'}>
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
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Add goal'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
