'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Field, inputClass, Btn, EmptyState } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import { computeCategoryTotals, netWorth, fmtINR, fmtPct } from '@/lib/utils';
import { ASSET_TYPE_TO_CATEGORY, HOLDING_TYPES } from '@/lib/constants';

export default function AdvisorSection() {
  const { state, ready } = useFinance();
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('Stock');
  const [current, setCurrent] = useState('');
  const [avg, setAvg] = useState('');
  const [horizon, setHorizon] = useState('long');
  const [result, setResult] = useState(null);

  if (!ready || !state) return null;

  const category = ASSET_TYPE_TO_CATEGORY[assetType] || assetType;

  function prefill(id) {
    const h = state.holdings.find((x) => x.id === id);
    if (!h) return;
    setName(h.name);
    setAssetType(h.assetType);
    setCurrent(h.currentRate);
    setAvg(h.avgRate);
  }

  function runAdvisor() {
    const curNum = Number(current) || 0;
    const avgNum = Number(avg) || 0;
    const gainPct = avgNum ? ((curNum - avgNum) / avgNum) * 100 : 0;

    const totals = computeCategoryTotals(state);
    const nw = netWorth(state);
    const actualPct = nw ? ((totals[category] || 0) / nw) * 100 : 0;
    const targetPct = Number(state.targets[category] || 0);
    const drift = actualPct - targetPct;

    const rows = [];
    let allocScore = 0;
    let allocNote = `Close to your target allocation for ${category} — no rebalancing pressure either way.`;
    if (drift > 5) {
      allocScore = -2;
      allocNote = `You're already overweight ${category} by ${drift.toFixed(1)} points vs target — leans toward trimming or holding off on adding.`;
    } else if (drift < -5) {
      allocScore = 2;
      allocNote = `You're underweight ${category} by ${Math.abs(drift).toFixed(1)} points vs target — there's room to add here.`;
    }
    rows.push({ name: 'Allocation vs your target', score: allocScore, note: allocNote });

    let plScore = 0;
    let plNote = avgNum
      ? `Roughly flat vs the buy price you entered (${fmtPct(gainPct)}).`
      : "No buy price entered — you're evaluating this as a fresh potential purchase, so this factor is skipped.";
    if (avgNum > 0) {
      const damp = horizon === 'long' ? 0.6 : 1;
      if (gainPct <= -15) {
        plScore = Math.round(-1 * damp) || -1;
        plNote = `Down ${fmtPct(gainPct)} from that buy price — worth re-checking your thesis before adding more.${
          horizon === 'long' ? ' Weighted down a little since you flagged this as long-term.' : ''
        }`;
      } else if (gainPct >= 30) {
        plScore = -1;
        plNote = `Up ${fmtPct(gainPct)} — a reasonable point to consider booking some profit.`;
      }
    }
    rows.push({ name: 'Price vs your buy price', score: plScore, note: plNote });

    const total = rows.reduce((s, f) => s + f.score, 0);
    let verdict = 'HOLD';
    if (total >= 3) verdict = 'BUY';
    else if (total <= -3) verdict = 'SELL';

    setResult({ rows, total, verdict, name: name.trim() || 'This instrument' });
  }

  const verdictStyles = {
    BUY: { box: 'bg-emeraldBg', text: 'text-emerald' },
    SELL: { box: 'bg-clayBg', text: 'text-clay' },
    HOLD: { box: 'bg-warnBg', text: 'text-warn' },
  };

  return (
    <>
      <div className="border-l-[3px] border-accent bg-accentBg px-4 py-3 rounded-r-lg text-[12.5px] text-[#1E3A8A] mb-6 leading-relaxed">
        Works on anything, not just what you already hold — type a name and prices in yourself (or pick an existing holding to
        prefill). It weighs only two things: whether this category is over/under-weight against your allocation targets, and how
        the price compares to what you paid, if anything. No valuation/trend/fundamentals guessing — ask in chat if you want an
        actual researched take on a specific stock.
      </div>

      <Card>
        {state.holdings.length > 0 && (
          <Field label="Prefill from an existing holding (optional)">
            <select className={inputClass} onChange={(e) => prefill(e.target.value)} defaultValue="">
              <option value="">— None, I&apos;ll enter my own —</option>
              {state.holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.assetType})
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Name">
            <input
              className={inputClass}
              placeholder="e.g. Infosys, or any stock/fund you're considering"
              list="advisor-names"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="advisor-names">
              {[...new Set(state.holdings.map((h) => h.name))].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Type">
            <select className={inputClass} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
              {HOLDING_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label="Current price">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="Your buy price (leave blank if you don't own it yet)">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={avg} onChange={(e) => setAvg(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4">
          <label className="block font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-1.5">Investment horizon</label>
          <div className="flex gap-2 flex-wrap">
            {[
              ['long', 'Long-term (3y+)'],
              ['short', 'Short-term / tactical'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setHorizon(value)}
                className={`border rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                  horizon === value ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Btn className="mt-4" onClick={runAdvisor} disabled={!name.trim() || !current}>
          Get verdict
        </Btn>
      </Card>

      {result && (
        <div className="mt-6">
          <div className={`rounded-xl p-7 text-center mb-5 border border-line ${verdictStyles[result.verdict].box}`}>
            <div className="font-mono text-[11px] uppercase tracking-widest opacity-70">{result.name}</div>
            <div className={`font-display text-[38px] font-bold ${verdictStyles[result.verdict].text}`}>{result.verdict}</div>
            <div className="font-mono text-xs text-inkMuted mt-1.5">
              Composite score {result.total > 0 ? '+' : ''}
              {result.total} · based on the numbers you entered, not a market prediction
            </div>
          </div>
          <Card>
            {result.rows.map((f, i) => {
              const maxAbs = Math.max(2, ...result.rows.map((r) => Math.abs(r.score)));
              const pct = (Math.abs(f.score) / maxAbs) * 50;
              const color = f.score > 0 ? '#059669' : f.score < 0 ? '#DC2626' : '#6B7280';
              const left = f.score >= 0 ? 50 : 50 - pct;
              const width = f.score === 0 ? 1 : pct;
              return (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 ${i !== result.rows.length - 1 ? 'border-b border-[#E4E5E9]' : ''}`}>
                  <div className="sm:w-[190px] shrink-0 text-[13px] font-medium">{f.name}</div>
                  <div className="flex-1">
                    <div className="h-[7px] bg-[#E4E5E9] rounded-full relative">
                      <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
                    </div>
                    <div className="text-[11.5px] text-inkMuted mt-1">{f.note}</div>
                  </div>
                  <div className="sm:w-[70px] shrink-0 sm:text-right font-mono text-xs" style={{ color }}>
                    {f.score > 0 ? '+' : ''}
                    {f.score}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </>
  );
}
