const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

export function IconGrid(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
export function IconCompass(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-4 2-2 4 4-2 2-4z" />
    </svg>
  );
}
export function IconLayers(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}
export function IconReceipt(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}
export function IconPie(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <path d="M12 3v9l7.5 4.3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
export function IconWallet(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1" />
    </svg>
  );
}
export function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}
export function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
export function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" {...common} {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IconDots(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...common} fill="currentColor" stroke="none" {...props}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
export function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...common} {...props}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function IconEyeOff(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...common} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0112 5c7 0 10.5 7 10.5 7a15.2 15.2 0 01-3.4 4.3M6.6 6.6C3.4 8.6 1.5 12 1.5 12S5 19 12 19c1.4 0 2.6-.2 3.7-.6" />
      <path d="M9.5 9.9a3 3 0 004.2 4.2" />
    </svg>
  );
}

export function IconEdit(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
export function IconRefresh({ spinning, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} className={spinning ? 'animate-spin' : ''} {...props}>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
export function IconDownload(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function IconChart(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 19V9" />
      <path d="M11 19V5" />
      <path d="M18 19v-7" />
      <path d="M3 19h18" />
    </svg>
  );
}

export function iconFor(name) {
  const map = {
    grid: IconGrid,
    compass: IconCompass,
    layers: IconLayers,
    receipt: IconReceipt,
    pie: IconPie,
    wallet: IconWallet,
    shield: IconShield,
    dots: IconDots,
    chart: IconChart,
  };
  return map[name] || IconGrid;
}
