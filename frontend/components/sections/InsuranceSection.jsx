'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit } from '@/components/Icons';
import { fmtINR, dueStatus, confirmDelete } from '@/lib/utils';
import { INSURANCE_TYPES, PREMIUM_FREQUENCIES } from '@/lib/constants';

const BLANK_FORM = { name: '', type: 'Life', insurer: '', policyNumber: '', premium: '', frequency: 'Yearly', coverage: '', dueDate: '', notes: '' };

export default function InsuranceSection() {
  const { state, ready, addInsurance, updateInsurance, deleteInsurance } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);

  if (!ready || !state) return null;

  const rows = [...state.insurance].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  const badgeClass = {
    ok: 'bg-emeraldBg text-emerald',
    soon: 'bg-warnBg text-warn',
    late: 'bg-clayBg text-clay',
  };

  function openAdd() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  }
  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      insurer: p.insurer || '',
      policyNumber: p.policyNumber || '',
      premium: String(p.premium || ''),
      frequency: p.frequency,
      coverage: String(p.coverage || ''),
      dueDate: p.dueDate || '',
      notes: p.notes || '',
    });
    setModalOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return alert('Enter a policy name');
    const payload = {
      name: form.name.trim(),
      type: form.type,
      insurer: form.insurer.trim(),
      policyNumber: form.policyNumber.trim(),
      premium: Number(form.premium) || 0,
      frequency: form.frequency,
      coverage: Number(form.coverage) || 0,
      dueDate: form.dueDate,
      notes: form.notes.trim(),
    };
    if (editingId) updateInsurance(editingId, payload);
    else addInsurance(payload);
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Premiums and coverage change at renewal — use the pencil icon to update an existing policy instead of adding a duplicate.
      </p>
      {rows.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rows.map((p) => {
            const status = dueStatus(p.dueDate);
            return (
              <Card key={p.id}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-[17px] font-semibold truncate">{p.name}</div>
                    <div className="text-inkMuted text-xs truncate">
                      {p.insurer || '—'} {p.policyNumber ? `· ${p.policyNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <IconBtn danger={false} onClick={() => openEdit(p)} title="Edit">
                      <IconEdit />
                    </IconBtn>
                    <IconBtn onClick={() => confirmDelete(`Delete the policy "${p.name}"?`) && deleteInsurance(p.id)} title="Delete">
                      <IconTrash />
                    </IconBtn>
                  </div>
                </div>
                <div className="my-3.5 flex gap-2 items-center flex-wrap">
                  <Tag>{p.type}</Tag>
                  <span className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full ${badgeClass[status.cls]}`}>{status.label}</span>
                </div>
                <table className="text-[12.5px] w-full">
                  <tbody>
                    <tr>
                      <td className="text-inkMuted py-1">Premium</td>
                      <td className="num mono">
                        <Amount>{fmtINR(p.premium)}</Amount> / {p.frequency}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-inkMuted py-1">Coverage</td>
                      <td className="num mono">
                        <Amount>{fmtINR(p.coverage)}</Amount>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-inkMuted py-1">Renewal date</td>
                      <td className="num mono">{p.dueDate || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                {p.notes && <div className="text-inkMuted text-xs mt-2">{p.notes}</div>}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No policies added">Add a life, health, vehicle, or other policy to track renewals.</EmptyState>
      )}

      <div className="mt-4">
        <Btn onClick={openAdd}>
          <IconPlus /> Add policy
        </Btn>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit policy' : 'Add insurance policy'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Policy name">
            <input className={inputClass} placeholder="e.g. HDFC Life Term Plan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {INSURANCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Insurer">
            <input className={inputClass} placeholder="e.g. HDFC Life" value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
          </Field>
          <Field label="Policy number">
            <input className={inputClass} placeholder="Optional" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Premium amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} />
          </Field>
          <Field label="Frequency">
            <select className={inputClass} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {PREMIUM_FREQUENCIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Coverage / sum assured">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
          </Field>
          <Field label="Renewal / due date">
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputClass} placeholder="Nominee, riders, agent contact, etc." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Add policy'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
