'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { focusRing } from './FocusRing';

const MIN_PASSWORD_LENGTH = 12;

/** Email/password form shared by /login and /register. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(t('passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(isRegister ? { email, password, ...(name.trim() ? { name: name.trim() } : {}) } : { email, password }),
      });
      if (response.ok) {
        router.push('/');
        router.refresh();
        return;
      }
      setError(
        response.status === 401 ? t('invalidCredentials')
        : response.status === 409 ? t('emailTaken')
        : response.status === 429 ? t('tooMany')
        : response.status === 400 ? t('invalidInput')
        : t('failed'),
      );
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  const input = `mt-1 w-full rounded-2xl border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 ${focusRing()}`;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(108,92,231,0.18),transparent_28%),linear-gradient(180deg,#0a0d14,#0b0e14_30%,#090d15)] px-5 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full border border-cyan-400/15" />
        <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full border border-violet-400/10" style={{ transform: 'translateX(-50%) rotate(22deg)' }} />
      </div>

      <section className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-panel-border bg-[linear-gradient(135deg,rgba(11,17,28,0.97),rgba(9,12,18,0.9))] p-6 shadow-[0_30px_90px_rgba(2,5,12,0.8)]">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.18),transparent_45%)]" />

        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">NEXUS</span>
            <Link href="/universe" className="text-[10px] uppercase tracking-[0.18em] text-foreground/55 hover:text-accent-cyan">{t('back')}</Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t(isRegister ? 'registerTitle' : 'loginTitle')}</h1>
          <p className="mt-2 text-sm text-foreground/60">{isRegister ? t('registerTitle') : t('loginTitle')}</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            {isRegister ? (
              <label className="text-xs uppercase tracking-[0.18em] text-foreground/65">
                {t('name')}
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
              </label>
            ) : null}
            <label className="text-xs uppercase tracking-[0.18em] text-foreground/65">
              {t('email')}
              <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
            </label>
            <label className="text-xs uppercase tracking-[0.18em] text-foreground/65">
              {t('password')}
              <input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} />
              {isRegister ? <span className="mt-1 block text-[11px] normal-case tracking-normal text-foreground/50">{t('passwordHint', { min: MIN_PASSWORD_LENGTH })}</span> : null}
            </label>
            {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
            <button type="submit" disabled={busy} className={`rounded-full border border-accent-cyan/40 bg-accent-cyan/15 px-4 py-2.5 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-50 ${focusRing()}`}>
              {t(isRegister ? 'registerSubmit' : 'loginSubmit')}
            </button>
          </form>

          <p className="mt-5 text-xs text-foreground/60">
            {t(isRegister ? 'haveAccount' : 'noAccount')}{' '}
            <Link href={isRegister ? '/login' : '/register'} className="text-accent-cyan underline">
              {t(isRegister ? 'loginLink' : 'registerLink')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
