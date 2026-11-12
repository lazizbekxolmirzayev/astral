/** Number formatting for the game's HUD. Pure, so it is tested without a browser. */

const nf = (locale: string, digits: number) => new Intl.NumberFormat(locale === 'uz' ? 'uz-UZ' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(value: number, locale: string, digits = 0): string {
  return Number.isFinite(value) ? nf(locale, digits).format(value) : '—';
}

/** Metres as km (or m below 1 km, or millions of km above 10 million km). */
export function formatDistance(meters: number, locale: string): string {
  if (!Number.isFinite(meters)) return '—';
  const km = meters / 1000;
  if (km < 1) return `${formatNumber(meters, locale)} m`;
  if (km < 1000) return `${formatNumber(km, locale, 1)} km`;
  if (km < 1e7) return `${formatNumber(km, locale)} km`;
  return `${formatNumber(km / 1e6, locale, 1)} M km`;
}

export function formatSpeed(metersPerSecond: number, locale: string): string {
  if (!Number.isFinite(metersPerSecond)) return '—';
  return metersPerSecond < 1000 ? `${formatNumber(metersPerSecond, locale)} m/s` : `${formatNumber(metersPerSecond / 1000, locale, 2)} km/s`;
}

export function formatBits(bits: number, locale: string): string {
  if (!Number.isFinite(bits)) return '—';
  const bytes = bits / 8;
  if (bytes < 1e6) return `${formatNumber(bytes / 1e3, locale, 1)} kB`;
  if (bytes < 1e9) return `${formatNumber(bytes / 1e6, locale, 1)} MB`;
  return `${formatNumber(bytes / 1e9, locale, 2)} GB`;
}

export function formatMoney(usd: number, locale: string): string {
  if (!Number.isFinite(usd)) return '—';
  return Math.abs(usd) >= 1e6 ? `$${formatNumber(usd / 1e6, locale, 1)}M` : `$${formatNumber(usd / 1e3, locale, 0)}k`;
}

export function formatBitRate(bps: number, locale: string): string {
  if (!Number.isFinite(bps)) return '—';
  if (bps < 1e3) return `${formatNumber(bps, locale)} bit/s`;
  if (bps < 1e6) return `${formatNumber(bps / 1e3, locale, 1)} kbit/s`;
  return `${formatNumber(bps / 1e6, locale, 1)} Mbit/s`;
}

/** Mission elapsed time as `T+ 12d 03:04:05`. */
export function formatMissionTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(total / 86_400);
  const rest = total % 86_400;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}:${pad(rest % 60)}`;
  return days > 0 ? `T+ ${days}d ${clock}` : `T+ ${clock}`;
}
