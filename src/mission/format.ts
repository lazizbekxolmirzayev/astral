import type { UnitSymbol } from './units';

/** Display helpers: numbers with a unit, never a bare number. Pure, locale-aware, no React. */

const SUPERSCRIPT: Record<string, string> = { '^2': '²', '^3': '³' };

export function unitLabel(unit: UnitSymbol): string {
  if (unit === '1') return '';
  return unit.replace(/\^[23]/g, (match) => SUPERSCRIPT[match] ?? match);
}

const INTL_LOCALE: Record<string, string> = { uz: 'uz', ru: 'ru', en: 'en' };

function numberFormat(locale: string, maximumFractionDigits: number): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'en', { maximumFractionDigits, useGrouping: true });
  } catch {
    return new Intl.NumberFormat('en', { maximumFractionDigits });
  }
}

/** About three significant digits: 1 234, 123, 12.3, 1.23, 0.123. */
export function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : magnitude === 0 ? 0 : 3;
  return numberFormat(locale, digits).format(value);
}

export function formatQuantity(value: number | null, unit: UnitSymbol, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const label = unitLabel(unit);
  return label ? `${formatNumber(value, locale)} ${label}` : formatNumber(value, locale);
}

export function formatPercent(fraction: number | null, locale: string): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  return `${numberFormat(locale, Math.abs(fraction) >= 0.1 ? 0 : 1).format(fraction * 100)} %`;
}
