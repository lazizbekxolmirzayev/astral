'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './config';

export async function setLocaleAction(input: unknown) {
  // Reached from a client component, so treat the argument as untrusted.
  const locale = typeof input === 'string' ? input : undefined;
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
  });
  revalidatePath('/');
}
