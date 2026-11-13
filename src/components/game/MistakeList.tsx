'use client';

import { useLocale, useTranslations } from 'next-intl';
import { pickText } from '@/mission';
import { formatMoney, formatNumber } from '@/game/format';
import type { FlightRecord } from '@/game/gameStore';
import type { Mistake, MistakeText } from '@/game/mistakes';

/** Turns a mistake's text into a sentence in the current language (pure data in, translated string out). */
export function useMistakeText(record: Pick<FlightRecord, 'names'>) {
  const t = useTranslations('game');
  const kindT = useTranslations('mission.requirements.kind');
  const locale = useLocale();
  const format = (value: number, unit: string) => (unit === 'USD' ? formatMoney(value, locale) : unit === '1' ? `${formatNumber(value * 100, locale, 1)} %` : `${formatNumber(value, locale, unit === 'pt' ? 1 : 0)} ${unit}`);
  return (text: MistakeText, mistake: Mistake): string => {
    if ('loc' in text) return pickText(text.loc, locale);
    const params: Record<string, string | number> = { ...(text.params ?? {}) };
    if (mistake.task) params.task = t(`crew.tasks.${mistake.task}.name`);
    if (mistake.role) params.role = t(`crew.roles.${mistake.role}.name`);
    if (mistake.player !== undefined) params.who = record.names[mistake.player]?.trim() || t('crew.player', { n: mistake.player + 1 });
    if (text.key === 'mistakes.requirement') {
      const unit = String(params.unit);
      params.kind = kindT(String(params.kind));
      params.actual = format(Number(params.actual), unit);
      params.limit = format(Number(params.limit), unit);
    }
    return t(text.key, params);
  };
}

const SEVERITY = { error: 'border-red-300/35 bg-red-500/10', warning: 'border-amber-300/35 bg-amber-400/10' } as const;

/** The mistakes of a flight, each with who made it, why it matters and (when it is a moment of the flight) a jump to it in the video. */
export function MistakeList({ mistakes, record, onJump }: { mistakes: readonly Mistake[]; record: Pick<FlightRecord, 'names'>; onJump?: (mistake: Mistake) => void }) {
  const t = useTranslations('game.mistakes');
  const text = useMistakeText(record);
  if (mistakes.length === 0) return <p data-testid="no-mistakes" className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 p-3 text-center text-sm text-emerald-100">{t('none')}</p>;
  return (
    <ul data-testid="mistake-list" className="space-y-1.5">
      {mistakes.map((mistake) => (
        <li key={mistake.id} data-mistake={mistake.category} className={`rounded-xl border px-2.5 py-2 text-[12px] ${SEVERITY[mistake.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{t(`category.${mistake.category}`)}</p>
              <p className="mt-0.5 leading-snug text-white">{text(mistake.title, mistake)}</p>
              {mistake.detail ? <p className="mt-0.5 leading-snug text-white/60">{text(mistake.detail, mistake)}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {mistake.points !== 0 ? <span className="text-[12px] font-semibold text-red-300">{mistake.points}</span> : null}
              {onJump && mistake.missionT !== null ? <button type="button" data-action="jump-to-mistake" onClick={() => onJump(mistake)} className="rounded-md border border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-400/30">▶ {t('watch')}</button> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
