import { RU_TEXT } from './ru';
/**
 * Bilingual text for the mission domain.
 *
 * The domain layer must not depend on next-intl, so catalog names, summaries and
 * model cards carry their own English and Uzbek text. The UI picks one with
 * `pickText`. Russian comes from a small dictionary (`ru.ts`: names, summaries and stage titles) and falls back to
 * English for everything else.
 */

export type Localized = { readonly en: string; readonly uz: string };

export const L = (en: string, uz: string): Localized => ({ en, uz });

/** Uzbek for `uz`, Russian for `ru` where `RU_TEXT` has it, English otherwise. */
export function pickText(text: Localized, locale: string): string {
  if (locale === 'uz') return text.uz;
  if (locale === 'ru') return RU_TEXT[text.en] ?? text.en;
  return text.en;
}
