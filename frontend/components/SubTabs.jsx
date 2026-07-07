'use client';

export default function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2.5 text-[13.5px] font-medium whitespace-nowrap border-b-2 -mb-px ${
            active === t.id ? 'border-brass text-ink' : 'border-transparent text-inkMuted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
