'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { setLocaleAction } from '@/i18n/actions';
import { locales, type Locale } from '@/i18n/config';

const SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };
const NAME: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

/** The game's own language switch (the text, the labels and the voices all follow it). */
export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label="Language" data-testid="lang-switch" className={`flex items-center rounded-full border border-white/15 bg-black/40 p-0.5 backdrop-blur-md ${pending ? 'opacity-60' : ''}`}>
      {locales.map((value) => (
        <button key={value} type="button" data-action={`lang-${value}`} aria-pressed={locale === value} title={NAME[value]} disabled={pending} onClick={() => { if (value !== locale) startTransition(async () => { await setLocaleAction(value); router.refresh(); }); }} className={`rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.08em] transition ${locale === value ? 'bg-cyan-400/25 text-cyan-50' : 'text-white/60 hover:text-white'}`}>{SHORT[value]}</button>
      ))}
    </div>
  );
}
