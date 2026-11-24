'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '@/lib/constants';
import { iconFor } from './Icons';

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-line dark:border-gray-700 flex z-40 pb-[env(safe-area-inset-bottom)]">
      {NAV_SECTIONS.map((s) => {
        const Icon = iconFor(s.icon);
        const active = pathname === s.href;
        return (
          <Link
            key={s.id}
            href={s.href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? 'text-accent' : 'text-inkMuted dark:text-gray-400'}`}
          >
            <Icon />
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
