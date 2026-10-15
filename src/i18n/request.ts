import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

export default getRequestConfig(async () => {
  const store = await cookies();
  const stored = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(stored) ? stored : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
