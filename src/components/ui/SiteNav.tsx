'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AccountMenu } from './AccountMenu';

const LINKS = [
  { href: '/', key: 'universe' },
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
    <header className="sticky top-0 z-30 border-b border-panel-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="mr-3 flex items-center gap-2 text-sm font-semibold tracking-[0.2em]">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent-cyan shadow-[0_0_10px_2px_rgba(0,240,255,0.7)]" />
          NEXUS
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs transition-colors ${active ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-foreground/60 hover:text-foreground'}`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}
