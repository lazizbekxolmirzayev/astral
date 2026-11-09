'use client';

import { AlertTriangle, OctagonAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Evaluation } from '@/mission/engine';
import { useText } from './primitives';
import { TONE_STYLES } from './tone';

/** Every problem the validator and the engine found, errors first. Nothing is filtered out. */
export function IssueList({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations('mission.overview');
  const ref = useTranslations('mission.refIssue');
  const { text } = useText();
  const errors = evaluation.issues.filter((issue) => issue.severity === 'error');
  const warnings = evaluation.issues.filter((issue) => issue.severity === 'warning');

  if (evaluation.referenceIssues.length === 0 && evaluation.issues.length === 0) {
    return <p className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{t('noIssues')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {evaluation.referenceIssues.length > 0 ? (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">{t('referenceIssues')}</h3>
          <ul className="flex flex-col gap-1.5">
            {evaluation.referenceIssues.map((issue, index) => (
              <li key={`${issue.code}-${issue.path}-${index}`} data-severity="error" className={cn('flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm', TONE_STYLES.critical.border, TONE_STYLES.critical.surface)}>
                <OctagonAlert size={15} className="mt-0.5 shrink-0 text-red-300" aria-label={t('errorLabel')} role="img" />
                <span>
                  {ref(issue.code)} <span className="font-mono text-[11px] text-foreground/55">{issue.path}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {errors.length + warnings.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {[...errors, ...warnings].map((issue, index) => {
            const critical = issue.severity === 'error';
            const style = TONE_STYLES[critical ? 'critical' : 'warning'];
            const Icon = critical ? OctagonAlert : AlertTriangle;
            return (
              <li key={`${issue.code}-${index}`} data-severity={issue.severity} data-code={issue.code} className={cn('flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm', style.border, style.surface)}>
                <Icon size={15} className={cn('mt-0.5 shrink-0', style.text)} aria-label={t(critical ? 'errorLabel' : 'warningLabel')} role="img" />
                <span>{text(issue.message)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
