export const locales = ['uz', 'ru', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'uz';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

/**
 * Language names stay in their own language (endonyms) on purpose: a Russian
 * speaker reads "Русский" correctly in any UI language, so these are not
 * translatable strings.
 */
export const localeLabels: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

export const LOCALE_COOKIE = 'nexus_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
