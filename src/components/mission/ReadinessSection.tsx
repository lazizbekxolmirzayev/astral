'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Evaluation } from '@/mission/engine';
import { CheckList, StatusChip, STATUS_TONE } from './CheckList';
import { Panel, ToneIcon } from './primitives';
import { TONE_STYLES } from './tone';

/** The single mission readiness report: every check from every group, nothing hidden. */
export function ReadinessSection({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations('mission.report');
  const group = useTranslations('mission.group');
  const { readiness } = evaluation;
  const tone = STATUS_TONE[readiness.overall];
  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t('overall')} data-overall={readiness.overall} data-launch-ready={readiness.launchReady} className={cn('rounded-[18px] border px-5 py-4', TONE_STYLES[tone].border, TONE_STYLES[tone].surface)}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/65">{t('overall')}</p>
        <p className={cn('mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight', TONE_STYLES[tone].text)} role="status">
          <ToneIcon tone={tone} className="h-6 w-6" />
          {readiness.launchReady ? (readiness.overall === 'pass' ? t('ready') : t('readyWithWarnings')) : t('notReady')}
        </p>
        <p className="mt-1 text-sm text-foreground/80">{readiness.launchReady ? t('readyHint') : t('notReadyHint')}</p>
        <p className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-foreground/80">
          <span data-count="pass">{t('countPass', { count: readiness.counts.pass })}</span>
          <span data-count="warning">{t('countWarning', { count: readiness.counts.warning })}</span>
          <span data-count="fail">{t('countFail', { count: readiness.counts.fail })}</span>
        </p>
        {readiness.unresolvable ? <p className="mt-2 text-xs text-amber-200">{t('unresolvable')}</p> : null}
      </section>

      {readiness.groups.map((entry) => (
        <Panel key={entry.group} title={group(entry.group)} actions={<StatusChip status={entry.status} />} className="scroll-mt-24">
          <div data-group={entry.group} data-status={entry.status}>
            <CheckList checks={entry.checks} />
          </div>
        </Panel>
      ))}
    </div>
  );
}
