'use client';

import { useState } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import {
  Card,
  SectionTitle,
  StatCard,
  Btn,
  IconBtn,
  Field,
  inputClass,
  EmptyState,
  Tag,
} from "@/components/ui";
import { Amount } from "@/lib/PrivacyContext";
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit } from '@/components/Icons';
import { fmtINR, todayStr, confirmDelete } from '@/lib/utils';
import { FD_COMPOUNDING } from '@/lib/constants';

function calcMaturity(principal, rate, startDate, maturityDate, compounding) {
  const start = new Date(startDate);
  const end = new Date(maturityDate);
  const years = (end - start) / (365.25 * 24 * 3600 * 1000);
  const r = rate / 100;
  const n = { 'Monthly': 12, 'Quarterly': 4, 'Half-yearly': 2, 'Yearly': 1, 'On maturity': 1 }[compounding] || 4;
  if (compounding === 'On maturity') return principal * (1 + r * years);
  return principal * Math.pow(1 + r / n, n * years);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function statusColor(status) {
  if (status === 'active') return 'bg-emeraldBg text-emerald';
  if (status === 'matured') return 'bg-accentBg text-accent';
  if (status === 'renewed') return 'bg-warnBg text-warn';
  if (status === 'broken') return 'bg-clayBg text-clay';
  return 'bg-[#EDEEF0] text-inkMuted';
}

const blank = {
  bankName: '', accountId: '', principal: '', interestRate: '', startDate: todayStr(),
  maturityDate: '', compounding: 'Quarterly', autoRenew: false, creditToAccountId: '', notes: '', manualMaturity: '',
};

export default function FDSection() {
  const { state, ready, addFD, updateFD, deleteFD, matureFD } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank);
  const [filterStatus, setFilterStatus] = useState('active');

  if (!ready || !state) return <SectionLoader />;

  const fds = state.fds || [];
  const accounts = state.bankAccounts || [];

  const activeFDs = fds.filter((f) => f.status === 'active');
  const totalPrincipal = activeFDs.reduce((s, f) => s + Number(f.principal || 0), 0);
  const totalMaturity = activeFDs.reduce((s, f) => s + Number(f.maturityAmount || 0), 0);
  const totalInterest = totalMaturity - totalPrincipal;

  // Preview maturity amount when form changes
  const previewMaturity = form.principal && form.interestRate && form.startDate && form.maturityDate
    ? calcMaturity(Number(form.principal), Number(form.interestRate), form.startDate, form.maturityDate, form.compounding)
    : null;

  function openAdd() {
    setEditingId(null);
    setForm(blank);
    setModalOpen(true);
  }
  function openEdit(fd) {
    setEditingId(fd.id);
    setForm({
      bankName: fd.bankName, accountId: fd.accountId || '', principal: String(fd.principal),
      interestRate: String(fd.interestRate), startDate: fd.startDate, maturityDate: fd.maturityDate,
      compounding: fd.compounding, autoRenew: fd.autoRenew, creditToAccountId: fd.creditToAccountId || '',
      notes: fd.notes || '',
    });
    setModalOpen(true);
  }

  function submit() {
    if (!form.bankName.trim()) return alert('Enter bank/institution name');
    if (!form.principal || Number(form.principal) <= 0) return alert('Enter principal amount');
    if (!form.interestRate || Number(form.interestRate) <= 0) return alert('Enter interest rate');
    if (!form.startDate || !form.maturityDate) return alert('Enter start and maturity dates');
    const payload = {
      bankName: form.bankName.trim(), accountId: form.accountId,
      principal: Number(form.principal), interestRate: Number(form.interestRate),
      startDate: form.startDate, maturityDate: form.maturityDate,
      compounding: form.compounding, autoRenew: form.autoRenew,
      creditToAccountId: form.creditToAccountId, notes: form.notes.trim(),
      ...(form.manualMaturity && Number(form.manualMaturity) > 0 ? { maturityAmount: Number(form.manualMaturity) } : {}),
    };
    if (editingId) updateFD(editingId, payload);
    else addFD(payload);
    setModalOpen(false);
  }

  const displayed = fds.filter((f) => filterStatus === 'all' || f.status === filterStatus);

  return (
    <>
      <p className="text-inkMuted dark:text-gray-400 text-[13.5px] max-w-xl mb-5">
        Track Fixed Deposits, get notified on maturity, and optionally
        auto-renew or credit to a linked account.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active FDs" value={String(activeFDs.length)} />
        <StatCard
          label="Total principal"
          value={<Amount>{fmtINR(totalPrincipal)}</Amount>}
        />
        <StatCard
          label="Maturity value"
          value={<Amount>{fmtINR(totalMaturity)}</Amount>}
        />
        <StatCard
          label="Total interest earned"
          value={<Amount>{fmtINR(totalInterest)}</Amount>}
          deltaClass="text-emerald"
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="inline-flex border border-line dark:border-gray-600 rounded-lg overflow-hidden">
          {[
            ["active", "Active"],
            ["matured", "Matured"],
            ["renewed", "Renewed"],
            ["broken", "Broken"],
            ["all", "All"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3.5 py-1.5 text-xs font-medium border-r border-line dark:border-gray-600 last:border-r-0 ${filterStatus === key ? "bg-ink text-white dark:bg-gray-700" : "bg-white dark:bg-gray-800 text-inkMuted dark:text-gray-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Btn onClick={openAdd}>
          <IconPlus /> Add FD
        </Btn>
      </div>

      {displayed.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayed.map((fd) => {
            const days = daysUntil(fd.maturityDate);
            const interest =
              Number(fd.maturityAmount || 0) - Number(fd.principal || 0);
            const isMaturingSoon =
              fd.status === "active" && days !== null && days <= 30;
            const isOverdue =
              fd.status === "active" && days !== null && days < 0;
            const linkedAccount = accounts.find(
              (a) => a.id === fd.creditToAccountId,
            );
            return (
              <Card
                key={fd.id}
                className={`dark:bg-gray-800 dark:border-gray-700 ${isMaturingSoon ? "border-warn" : isOverdue ? "border-clay" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-semibold text-[15px] dark:text-gray-100">
                      {fd.bankName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${statusColor(fd.status)}`}
                      >
                        {fd.status.toUpperCase()}
                      </span>
                      {fd.autoRenew && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accentBg text-accent">
                          AUTO-RENEW
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {fd.status === "active" && (
                      <Btn
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() =>
                          confirmDelete(
                            `Mark FD as matured/renewed? This cannot be undone.`,
                          ) && matureFD(fd.id)
                        }
                      >
                        {fd.autoRenew ? "Renew now" : "Mark matured"}
                      </Btn>
                    )}
                    <IconBtn
                      danger={false}
                      onClick={() => openEdit(fd)}
                      title="Edit"
                    >
                      <IconEdit />
                    </IconBtn>
                    <IconBtn
                      onClick={() =>
                        confirmDelete(`Delete FD at ${fd.bankName}?`) &&
                        deleteFD(fd.id)
                      }
                      title="Delete"
                    >
                      <IconTrash />
                    </IconBtn>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[13px] mb-3">
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Principal
                    </div>
                    <div className="font-semibold dark:text-gray-100">
                      <Amount>{fmtINR(fd.principal)}</Amount>
                    </div>
                  </div>
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Maturity value
                    </div>
                    <div className="font-semibold text-emerald">
                      <Amount>{fmtINR(fd.maturityAmount)}</Amount>
                    </div>
                  </div>
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Interest rate
                    </div>
                    <div className="dark:text-gray-200">
                      {fd.interestRate}% p.a. ({fd.compounding})
                    </div>
                  </div>
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Interest earned
                    </div>
                    <div className="text-emerald">
                      + <Amount>{fmtINR(interest)}</Amount>
                    </div>
                  </div>
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Start date
                    </div>
                    <div className="mono dark:text-gray-300">
                      {fd.startDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-inkMuted dark:text-gray-400 text-xs">
                      Maturity date
                    </div>
                    <div
                      className={`mono ${isOverdue ? "text-clay" : isMaturingSoon ? "text-warn" : "dark:text-gray-300"}`}
                    >
                      {fd.maturityDate}
                      {fd.status === "active" && days !== null && (
                        <span className="ml-1 text-[10px]">
                          (
                          {isOverdue
                            ? `${Math.abs(days)}d overdue`
                            : `${days}d left`}
                          )
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {linkedAccount && (
                  <div className="text-xs text-inkMuted dark:text-gray-400 border-t dark:border-gray-700 pt-2">
                    On maturity → <b>{linkedAccount.name}</b>
                  </div>
                )}
                {fd.notes && (
                  <div className="text-xs text-inkMuted dark:text-gray-500 mt-1">
                    {fd.notes}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No FDs here">
          {filterStatus === "all"
            ? "Add your first Fixed Deposit to start tracking."
            : `No ${filterStatus} FDs.`}
        </EmptyState>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit FD" : "Add Fixed Deposit"}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Bank / Institution name">
            <input
              className={inputClass}
              placeholder="e.g. SBI, HDFC Bank"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </Field>
          <Field label="Compounding frequency">
            <select
              className={inputClass}
              value={form.compounding}
              onChange={(e) =>
                setForm({ ...form, compounding: e.target.value })
              }
            >
              {FD_COMPOUNDING.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Principal amount (₹)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              placeholder="0"
              value={form.principal}
              onChange={(e) => setForm({ ...form, principal: e.target.value })}
            />
          </Field>
          <Field label="Interest rate (% per annum)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              placeholder="e.g. 7.5"
              value={form.interestRate}
              onChange={(e) =>
                setForm({ ...form, interestRate: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Start date">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Maturity date">
            <input
              type="date"
              className={inputClass}
              value={form.maturityDate}
              onChange={(e) =>
                setForm({ ...form, maturityDate: e.target.value })
              }
            />
          </Field>
        </div>

        {/* Maturity amount - auto-calculated but editable */}
        <div className="bg-emeraldBg dark:bg-gray-700 border border-emerald/20 rounded-lg p-3 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-inkMuted dark:text-gray-400 text-xs mb-1">
                Maturity amount
              </div>
              {previewMaturity && !form.manualMaturity && (
                <div className="font-semibold text-emerald text-lg">
                  <Amount>{fmtINR(previewMaturity)}</Amount>
                </div>
              )}
              {previewMaturity && !form.manualMaturity && (
                <div className="text-inkMuted dark:text-gray-500 text-xs">
                  Interest:{" "}
                  <Amount>
                    {fmtINR(previewMaturity - Number(form.principal))}
                  </Amount>
                </div>
              )}
            </div>
            <div className="flex-1 max-w-[180px]">
              <Field label="Override maturity amount (optional)">
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  placeholder={
                    previewMaturity
                      ? fmtINR(previewMaturity)
                      : "Auto-calculated"
                  }
                  value={form.manualMaturity}
                  onChange={(e) =>
                    setForm({ ...form, manualMaturity: e.target.value })
                  }
                />
              </Field>
              {form.manualMaturity && Number(form.principal) > 0 && (
                <div className="text-xs text-emerald mt-1">
                  Interest:{" "}
                  {fmtINR(Number(form.manualMaturity) - Number(form.principal))}
                </div>
              )}
            </div>
          </div>
          <button
            className="text-[11px] text-accent underline mt-1"
            onClick={() => setForm({ ...form, manualMaturity: "" })}
          >
            Reset to auto-calculated
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Credit to account on maturity (optional)">
            <select
              className={inputClass}
              value={form.creditToAccountId}
              onChange={(e) =>
                setForm({ ...form, creditToAccountId: e.target.value })
              }
            >
              <option value="">— Don't auto-credit —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Auto-renew on maturity?">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoRenew}
                onChange={(e) =>
                  setForm({ ...form, autoRenew: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-[13.5px] dark:text-gray-200">
                Yes, auto-renew for same tenure
              </span>
            </label>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input
            className={inputClass}
            placeholder="Branch, FD number, etc."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>{editingId ? "Save changes" : "Add FD"}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
