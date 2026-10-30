'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { focusRing } from './FocusRing';
import { useRadiogroup } from './useRadiogroup';
import { setLocaleAction } from '@/i18n/actions';
import { locales, localeLabels, type Locale } from '@/i18n/config';

/** The language radio group, shared by the settings panel and the game header. */
export function LanguageSwitch() {
  const t = useTranslations();
  const locale = useLocale();
  const currentLocale = locales.includes(locale as Locale) ? locale as Locale : locales[0];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { optionProps } = useRadiogroup({
    value: currentLocale,
    options: locales,
    onChange: (next: Locale) => {
      if (next === currentLocale) return;
      startTransition(async () => {
        await setLocaleAction(next);
        router.refresh();
      });
    },
  });

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language')}
      className="mt-1.5 flex gap-1 rounded-full border border-panel-border bg-background/40 p-1"
    >
      {locales.map((locale, index) => {
        const isActive = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            {...optionProps(locale, index)}
            disabled={isPending}
            className={`flex-1 rounded-full px-2 py-1.5 font-mono text-xs uppercase transition-colors ${
              isActive
                ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_14px_rgba(0,240,255,0.18)]'
                : 'text-foreground/75 hover:bg-panel-border hover:text-foreground'
            } ${focusRing()}`}
          >
            {localeLabels[locale]}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPanel() {
  const t = useTranslations();

  return (
    <section className="p-4">
      <div className="rounded-[22px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.08),transparent_38%),linear-gradient(180deg,rgba(12,17,27,0.94),rgba(9,12,18,0.78))] p-3 shadow-[0_16px_32px_rgba(0,0,0,0.18)]">
        <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-foreground/60">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"><Languages size={12} aria-hidden /></span>
          {t('settings.title')}
        </h2>

        <p className="mt-3 text-xs text-foreground/75">{t('settings.language')}</p>
        <LanguageSwitch />

        <p className="mt-2 text-[11px] leading-relaxed text-foreground/75">
          {t('settings.languageHint')}
        </p>
      </div>
    </section>
  );
}
