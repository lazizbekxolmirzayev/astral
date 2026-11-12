'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { CheckStatus, ReadinessCheck } from '@/mission/engine';
import type { Tone } from '@/mission/view';
import { ToneIcon, useText } from './primitives';
import { TONE_STYLES } from './tone';

export const STATUS_TONE: Record<CheckStatus, Tone> = { pass: 'normal', warning: 'warning', fail: 'critical' };

/** PASS / WARNING / FAIL as an icon, a word and a colour; the word and icon carry the meaning, not the colour. */
export function StatusChip({ status }: { status: CheckStatus }) {
  const t = useTranslations('mission.checkStatus');
  const tone = STATUS_TONE[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]', TONE_STYLES[tone].border, TONE_STYLES[tone].surface, TONE_STYLES[tone].text)} data-status={status}>
      <ToneIcon tone={tone} />
      {t(status)}
    </span>
  );
}

/** The checks of the readiness report: status, what was checked, why, and how to fix it. */
export function CheckList({ checks }: { checks: readonly ReadinessCheck[] }) {
  const t = useTranslations('mission');
  const { text } = useText();
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => (
        <li key={check.id} data-check={check.id} data-status={check.status} className={cn('rounded-xl border px-3 py-2.5', TONE_STYLES[STATUS_TONE[check.status]].border, 'bg-white/[0.02]')}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={check.status} />
            <p className="text-sm font-semibold">{t(`check.${check.id}`)}</p>
          </div>
          <p className="mt-1.5 text-sm text-foreground/80">{text(check.reason)}</p>
          {check.fix ? (
            <p className="mt-1.5 text-xs text-foreground/75">
              <span className="font-semibold text-accent-cyan">{t('howToFix')}:</span> {text(check.fix)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
