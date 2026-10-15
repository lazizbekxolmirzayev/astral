import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { LocaleSync } from './LocaleSync';

type Props = {
  children: React.ReactNode;
};

/**
 * The locale comes from a cookie (see `src/i18n/request.ts`), which makes this
 * a per-request read. `cacheComponents` keeps the root layout prerendered, so
 * the provider lives here, inside the Suspense boundary declared by the layout.
 */
export async function AppProviders({ children }: Props) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleSync />
      {children}
    </NextIntlClientProvider>
  );
}
