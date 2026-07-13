'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '@/lib/constants';
import { iconFor } from './Icons';
import Logo from './Logo';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 bg-sidebar text-slate-300 py-7 pb-5 sticky top-0 h-screen hidden md:flex flex-col">
      <div className="px-6 pb-5 mb-2.5 border-b border-white/10 flex items-center gap-2.5">
        <Logo size={28} />
        <div>
          <div className="font-display font-bold text-[19px] text-white leading-tight tracking-tight">Vantage</div>
          <div className="font-mono text-[9.5px] text-slate-500 tracking-[0.1em] uppercase">Finance Desk</div>
        </div>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {NAV_SECTIONS.map((s) => {
          const Icon = iconFor(s.icon);
          const active = pathname === s.href;
          return (
            <Link
              key={s.id}
              href={s.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium tracking-wide transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Icon />
              <span>{s.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 pt-3.5 border-t border-white/10 font-mono text-[10px] text-slate-500 tracking-wide leading-relaxed">
        Your data lives only in your own MongoDB — nothing is shared with anyone else.
      </div>
    </aside>
  );
}
