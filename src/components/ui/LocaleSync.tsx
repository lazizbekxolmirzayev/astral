'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

/**
 * `cacheComponents` keeps the root layout prerendered, so it cannot read the
 * locale cookie. This syncs the document language and title after hydration.
 */
export function LocaleSync() {
  const locale = useLocale();
  const t = useTranslations('app');

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('title');
  }, [locale, t]);

  return null;
}
