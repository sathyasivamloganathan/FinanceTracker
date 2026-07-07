'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import EditableNumber from '@/components/EditableNumber';
import { IconPlus, IconTrash } from '@/components/Icons';
import { fmtINR, totalLiabilities } from '@/lib/utils';
import { LIABILITY_TYPES } from '@/lib/constants';

export default function LiabilitiesSection() {
  const { state, ready, addLiability, updateLiability, deleteLiability } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Home Loan', amount: '', interestRate: '', notes: '' });

  if (!ready || !state) return null;

  function submit() {
    if (!form.name.trim()) return alert('Enter a name');
    addLiability({
      name: form.name.trim(),
      type: form.type,
      amount: Number(form.amount) || 0,
      interestRate: Number(form.interestRate) || 0,
      notes: form.notes.trim(),
    });
    setForm({ name: '', type: 'Home Loan', amount: '', interestRate: '', notes: '' });
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Loans and debts you owe — these subtract from your net worth under Wealth → Net Worth, and feed the debt ratio on the
        Health Check.
      </p>
      <Card className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-inkMuted mb-2">Total outstanding</div>
        <div className="font-display font-semibold text-[24px] text-clay">
          <Amount>{fmtINR(totalLiabilities(state))}</Amount>
        </div>
      </Card>

      {state.liabilities.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="num">Interest %</th>
                <th className="num">Outstanding</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.liabilities.map((l) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.name}</b>
                    {l.notes && <div className="text-inkMuted text-xs">{l.notes}</div>}
                  </td>
                  <td>
                    <Tag tone="sell">{l.type}</Tag>
                  </td>
                  <td className="num">{l.interestRate ? `${l.interestRate}%` : '—'}</td>
                  <td className="num">
                    <EditableNumber value={l.amount} onCommit={(val) => updateLiability(l.id, { amount: val })} className={`${inputClass} w-[110px] text-right`} />
                  </td>
                  <td>
                    <IconBtn onClick={() => deleteLiability(l.id)}>
                      <IconTrash />
                    </IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No liabilities tracked">Add a loan or debt if you have any — it's fine to leave this empty.</EmptyState>
      )}

      <div className="mt-4">
        <Btn onClick={() => setModalOpen(true)}>
          <IconPlus /> Add liability
        </Btn>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add a liability">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Name">
            <input className={inputClass} placeholder="e.g. Home Loan — SBI" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {LIABILITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Outstanding amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Interest rate % (optional)">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>Add liability</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
