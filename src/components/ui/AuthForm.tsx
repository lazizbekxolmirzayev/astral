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

  const input = `mt-1 w-full rounded border border-panel-border bg-background px-3 py-2 text-sm ${focusRing()}`;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-5 px-5 py-10">
      <h1 className="text-xl font-semibold">{t(isRegister ? 'registerTitle' : 'loginTitle')}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {isRegister ? (
          <label className="text-xs text-foreground/70">
            {t('name')}
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
          </label>
        ) : null}
        <label className="text-xs text-foreground/70">
          {t('email')}
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
        </label>
        <label className="text-xs text-foreground/70">
          {t('password')}
          <input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} />
          {isRegister ? <span className="mt-1 block text-[11px] text-foreground/50">{t('passwordHint', { min: MIN_PASSWORD_LENGTH })}</span> : null}
        </label>
        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy} className={`rounded bg-accent-cyan/20 px-3 py-2 text-sm text-accent-cyan disabled:opacity-50 ${focusRing()}`}>
          {t(isRegister ? 'registerSubmit' : 'loginSubmit')}
        </button>
      </form>
      <p className="text-xs text-foreground/60">
        {t(isRegister ? 'haveAccount' : 'noAccount')}{' '}
        <Link href={isRegister ? '/login' : '/register'} className="text-accent-cyan underline">
          {t(isRegister ? 'loginLink' : 'registerLink')}
        </Link>
      </p>
      <Link href="/" className="text-xs text-foreground/50 hover:text-accent-cyan">{t('back')}</Link>
    </main>
  );
}
