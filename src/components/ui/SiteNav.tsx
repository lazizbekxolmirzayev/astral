'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AccountMenu } from './AccountMenu';

const LINKS = [
  { href: '/', key: 'mission' },
  { href: '/universe', key: 'universe' },
  { href: '/gallery', key: 'gallery' },
  { href: '/lab', key: 'lab' },
  { href: '/catalog', key: 'catalog' },
  { href: '/sandbox', key: 'sandbox' },
  { href: '/saved', key: 'saved' },
] as const;

/** Top bar shared by every subpage, so the sections feel like one product. */
export function SiteNav() {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '/';

  return (
    <header className="sticky top-0 z-30 border-b border-panel-border bg-[linear-gradient(90deg,rgba(10,14,22,0.96),rgba(13,18,28,0.9),rgba(9,12,18,0.96))] backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-0">
        <Link href="/" className="mr-2 flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-foreground">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent-cyan shadow-[0_0_10px_2px_rgba(0,240,255,0.7)]" />
          NEXUS
        </Link>

        <nav aria-label="Main" className="order-last flex w-full min-w-0 items-center gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all ${active ? 'border-accent-cyan/40 bg-accent-cyan/12 text-accent-cyan shadow-[0_0_14px_rgba(0,240,255,0.12)]' : 'border-transparent bg-white/[0.02] text-foreground/65 hover:border-panel-border hover:text-foreground'}`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-cyan-200 md:inline-flex">Realtime</span>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
