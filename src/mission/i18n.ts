/**
 * Bilingual text for the mission domain.
 *
 * The domain layer must not depend on next-intl, so catalog names, summaries and
 * model cards carry their own English and Uzbek text. The UI picks one with
 * `pickText`. Russian is intentionally not translated here; it falls back to
 * English (the `ru` message namespace keeps its keys, see src/messages/README.md).
 */

export type Localized = { readonly en: string; readonly uz: string };

export const L = (en: string, uz: string): Localized => ({ en, uz });

/** Uzbek for `uz`, English for everything else (including `ru`). */
export function pickText(text: Localized, locale: string): string {
  return locale === 'uz' ? text.uz : text.en;
}
