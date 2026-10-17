'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { focusRing } from './FocusRing';
import { useRadiogroup } from './useRadiogroup';
import { setLocaleAction } from '@/i18n/actions';
import { locales, localeLabels, type Locale } from '@/i18n/config';

export function SettingsPanel() {
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
    <section className="p-4">
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
        <Languages size={14} aria-hidden />
        {t('settings.title')}
      </h2>

      <p className="mt-3 text-xs text-foreground/75">{t('settings.language')}</p>
      <div
        role="radiogroup"
        aria-label={t('settings.language')}
        className="mt-1.5 flex gap-1 rounded-md border border-panel-border p-1"
      >
        {locales.map((locale, index) => {
          const isActive = locale === currentLocale;
          return (
            <button
              key={locale}
              type="button"
              {...optionProps(locale, index)}
              disabled={isPending}
              className={`flex-1 rounded px-2 py-1 font-mono text-xs uppercase transition-colors ${
                isActive
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'text-foreground/75 hover:bg-panel-border hover:text-foreground'
              } ${focusRing()}`}
            >
              {localeLabels[locale]}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-foreground/75">
        {t('settings.languageHint')}
      </p>
    </section>
  );
}
