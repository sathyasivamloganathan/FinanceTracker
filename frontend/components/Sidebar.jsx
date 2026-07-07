'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '@/lib/constants';
import { iconFor } from './Icons';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[210px] shrink-0 bg-sidebar text-[#A9B0BE] py-7 pb-5 sticky top-0 h-screen hidden md:flex flex-col">
      <div className="px-6 pb-5 mb-2.5 border-b border-dashed border-white/15">
        <div className="font-display font-semibold text-[22px] text-[#CCFBF1] tracking-wide">Finance Tracker</div>
        <div className="font-mono text-[10.5px] text-[#8890A0] tracking-[0.12em] uppercase mt-1">Personal Finance Desk</div>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {NAV_SECTIONS.map((s) => {
          const Icon = iconFor(s.icon);
          const active = pathname === s.href;
          return (
            <Link
              key={s.id}
              href={s.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13.5px] font-medium tracking-wide transition-colors ${
                active ? 'bg-brassBg text-ink' : 'text-[#A9B0BE] hover:bg-white/[0.05] hover:text-[#CCFBF1]'
              }`}
            >
              <Icon />
              <span>{s.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
