export function Card({ children, className = '', padded = true }) {
  return (
    <div className={`bg-paperCard border border-line rounded-card shadow-card ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function PageHead({ eyebrow, title, action }) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
      <div>
        <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-accent mb-1">{eyebrow}</span>
        <h1 className="font-display font-semibold text-[28px] text-ink m-0">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-9 mb-3.5 first:mt-0">
      <span className="font-display font-semibold text-[17px] text-ink whitespace-nowrap">{children}</span>
      <div className="flex-1 min-w-[16px] h-px bg-line" />
      {action}
    </div>
  );
}

export function StatCard({ label, value, delta, deltaClass = '' }) {
  return (
    <Card className="min-w-0">
      <div className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.1em] text-inkMuted mb-2 truncate">{label}</div>
      <div className="font-display font-semibold text-[19px] sm:text-[24px] text-ink font-mono leading-tight break-words">{value}</div>
      {delta && <div className={`font-mono text-[11px] sm:text-xs mt-1.5 break-words ${deltaClass}`}>{delta}</div>}
    </Card>
  );
}

export function Tag({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-accentBg text-accent',
    buy: 'bg-emeraldBg text-emerald',
    stock: 'bg-emeraldBg text-emerald',
    sell: 'bg-clayBg text-clay',
    mf: 'bg-accentBg text-accent',
    gold: 'bg-warnBg text-warn',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wide ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="text-center py-10 px-5 text-inkMuted text-[13px] border border-dashed border-line rounded-card bg-black/[0.01]">
      <span className="block font-display text-base text-ink mb-1">{title}</span>
      {children}
    </div>
  );
}

export function Btn({ children, variant = 'primary', className = '', ...rest }) {
  const base = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer border';
  const variants = {
    primary: 'bg-ink text-white border-ink hover:bg-[#0d1319]',
    secondary: 'bg-transparent text-ink border-line hover:border-ink',
    ghost: 'bg-transparent text-accent border-transparent px-2 py-1.5',
    danger: 'bg-transparent text-clay border-clayBg hover:bg-clayBg',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconBtn({ children, danger = true, ...rest }) {
  const hoverClass = danger ? 'hover:text-clay' : 'hover:text-accent';
  return (
    <button className={`bg-transparent border-none cursor-pointer p-1 text-inkMuted ${hoverClass}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block font-mono text-[10.5px] uppercase tracking-wide text-inkMuted mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11.5px] text-inkMuted mt-1">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full px-2.5 py-2 border border-line rounded-md bg-white text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accentLight focus:border-accent';
