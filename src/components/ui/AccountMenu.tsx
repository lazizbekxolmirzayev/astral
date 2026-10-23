'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { focusRing } from './FocusRing';

type Me = { email: string; name?: string | null; role?: string } | null;

/** Header account state: login/register links, or the signed-in email with a sign-out button. */
export function AccountMenu() {
  const t = useTranslations('auth');
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (response) => (response.ok ? ((await response.json()) as { user: Me }).user : null))
      .catch(() => null)
      .then((user) => { if (!cancelled) setMe(user); });
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setMe(null);
  }

  if (me === undefined) return null;
  const link = `text-xs text-foreground/60 transition-colors hover:text-accent-cyan ${focusRing()}`;
  if (!me) {
    return (
      <span className="flex items-center gap-3">
        <Link href="/login" className={link}>{t('loginLink')}</Link>
        <Link href="/register" className={link}>{t('registerLink')}</Link>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-3">
      {me.role === 'admin' ? <Link href="/admin" className={link}>{t('admin')}</Link> : null}
      <span className="max-w-[160px] truncate text-xs text-foreground/70" title={me.email}>{me.name || me.email}</span>
      <button type="button" onClick={signOut} className={link}>{t('logout')}</button>
    </span>
  );
}
