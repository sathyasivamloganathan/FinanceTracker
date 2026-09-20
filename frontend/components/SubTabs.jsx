'use client';

export default function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 border-b border-line dark:border-gray-700 mb-6 overflow-x-auto scrollbar-hide">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.id
              ? 'border-accent text-ink dark:text-gray-100'
              : 'border-transparent text-inkMuted dark:text-gray-500 hover:text-ink dark:hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
