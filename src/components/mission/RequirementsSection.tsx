'use client';

import { CheckCircle2, OctagonAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { setRequirement } from '@/mission/edit';
import type { Evaluation } from '@/mission/engine';
import { formatQuantity, unitLabel } from '@/mission/format';
import { REQUIREMENT_KINDS, type Mission, type RequirementKind } from '@/mission/models/mission';
import { convert, type UnitSymbol } from '@/mission/units';
import type { Editor } from './hooks';
import { EditNotice, NumberField, Panel, ProvenanceBadge, useText } from './primitives';
import { TONE_STYLES } from './tone';

const KINDS = Object.keys(REQUIREMENT_KINDS) as RequirementKind[];
/** Cost is easier to read and type in millions; every other kind uses the unit it is stored in. */
const EDIT_UNIT: Partial<Record<RequirementKind, UnitSymbol>> = { 'max-cost': 'MUSD' };

function displayUnit(kind: RequirementKind): UnitSymbol {
  return EDIT_UNIT[kind] ?? (REQUIREMENT_KINDS[kind].unit as UnitSymbol);
}
const toDisplay = (kind: RequirementKind, value: number) => convert(value, REQUIREMENT_KINDS[kind].unit, displayUnit(kind));
const fromDisplay = (kind: RequirementKind, value: number) => convert(value, displayUnit(kind), REQUIREMENT_KINDS[kind].unit);

function AddRow({ kind, locked, onAdd }: { kind: RequirementKind; locked: boolean; onAdd: (limit: number) => void }) {
  const t = useTranslations('mission.requirements');
  const [draft, setDraft] = useState('');
  const parsed = Number(draft.replace(',', '.'));
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && (kind !== 'min-launch-success' || parsed <= 1);
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (valid) { onAdd(fromDisplay(kind, parsed)); setDraft(''); } }}>
      <label className="sr-only" htmlFor={`req-${kind}`}>{t('valueFor', { name: t(`kind.${kind}`) })}</label>
      <input id={`req-${kind}`} value={draft} onChange={(event) => setDraft(event.target.value)} inputMode="decimal" disabled={locked} placeholder="0" className={cn('w-28 rounded-md border border-panel-border bg-background/70 px-2 py-1 font-mono text-sm', focusRing())} aria-invalid={draft !== '' && !valid} />
      <span className="font-mono text-xs text-foreground/60">{unitLabel(displayUnit(kind))}</span>
      <button type="submit" disabled={locked || !valid} className={cn('rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-3 py-1 text-xs text-accent-cyan disabled:opacity-40', focusRing())}>{t('set')}</button>
      {draft !== '' && !valid ? <span role="alert" className="text-xs text-red-200">{t('invalid')}</span> : null}
    </form>
  );
}

export function RequirementsSection({ mission, evaluation, editor }: { mission: Mission; evaluation: Evaluation; editor: Editor }) {
  const t = useTranslations('mission.requirements');
  const { locale } = useText();
  const locked = mission.status !== 'draft';
  const results = new Map(evaluation.requirements.map((result) => [result.kind, result]));

  return (
    <div className="flex flex-col gap-4">
      <EditNotice error={editor.error} />
      <Panel title={t('title')}>
        <p className="mb-3 text-sm text-foreground/70">{t('subtitle')}</p>
        {mission.objective.requirements.length === 0 ? <p className="mb-3 text-sm text-foreground/65">{t('none')}</p> : null}
        <ul className="flex flex-col gap-3">
          {KINDS.map((kind) => {
            const requirement = mission.objective.requirements.find((entry) => entry.kind === kind);
            const result = results.get(kind);
            const unit = displayUnit(kind);
            const style = result ? TONE_STYLES[result.met ? 'normal' : 'critical'] : null;
            return (
              <li key={kind} data-requirement={kind} data-met={result ? String(result.met) : undefined} className={cn('rounded-xl border p-3', style ? cn(style.border, style.surface) : 'border-panel-border bg-white/[0.02]')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(`kind.${kind}`)}</p>
                    <p className="text-xs text-foreground/65">{t(`kindHint.${kind}`)}</p>
                  </div>
                  {result ? (
                    <span className={cn('flex items-center gap-1 text-xs font-semibold', style?.text)}>
                      {result.met ? <CheckCircle2 size={14} aria-hidden /> : <OctagonAlert size={14} aria-hidden />}
                      {result.met ? t('met') : t('notMet')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {requirement ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-foreground/70">
                        <span>{t('limit')}</span>
                        <NumberField label={t('valueFor', { name: t(`kind.${kind}`) })} value={Math.round(toDisplay(kind, requirement.limit) * 1e4) / 1e4} min={0} onCommit={(value) => editor.apply((m) => setRequirement(m, kind, fromDisplay(kind, value)))} unit={unitLabel(unit)} />
                      </div>
                      {result ? (
                        <p className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
                          {t('actual')}: <span className="font-mono text-foreground">{formatQuantity(toDisplay(kind, result.actual), unit, locale)}</span>
                          {t('marginLabel')}: <span className="font-mono text-foreground">{(result.margin * 100).toFixed(0)} %</span>
                          <ProvenanceBadge provenance={result.provenance} />
                        </p>
                      ) : null}
                      <button type="button" disabled={locked} onClick={() => editor.apply((m) => setRequirement(m, kind, null))} className={cn('rounded-full border border-panel-border px-3 py-1 text-xs hover:border-red-400/50', focusRing())}>{t('remove')}</button>
                    </>
                  ) : (
                    <AddRow kind={kind} locked={locked} onAdd={(limit) => editor.apply((m) => setRequirement(m, kind, limit))} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
