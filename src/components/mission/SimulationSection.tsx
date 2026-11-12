'use client';

import { AlertTriangle, CheckCircle2, Circle, CircleDot, Info, MinusCircle, OctagonAlert, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { setSeed } from '@/mission/edit';
import { formatNumber } from '@/mission/format';
import { getModelCard } from '@/mission/modelCards';
import type { Mission } from '@/mission/models/mission';
import type { Evaluation } from '@/mission/engine';
import { SIM_ASSUMPTION_LIST, buildSimPlan, craftTrail, createSim, durationText, frameOf, readTelemetry, stageLength, stageTitle, type SimState, type StageResult, type TimelineSeverity } from '@/mission/sim';
import { SIM_SPEEDS, simStore, useSimStore, type SimStatus } from '@/stores/simStore';
import { CheckList } from './CheckList';
import type { Editor } from './hooks';
import { EditNotice, NumberField, Panel, ProvenanceBadge, useText } from './primitives';
import { SimulationPreview } from './SimulationPreview';
import { TONE_STYLES } from './tone';
import type { Tone } from '@/mission/view';

const STAGE_ICON: Record<StageResult, typeof Circle> = { pending: Circle, active: CircleDot, ok: CheckCircle2, degraded: AlertTriangle, failed: OctagonAlert, skipped: MinusCircle };
const STAGE_TONE: Partial<Record<StageResult, Tone>> = { ok: 'normal', degraded: 'warning', failed: 'critical' };
const SEVERITY_ICON: Record<TimelineSeverity, typeof Info> = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: OctagonAlert };
const SEVERITY_TONE: Record<TimelineSeverity, Tone | null> = { info: null, success: 'normal', warning: 'warning', error: 'critical' };
const OUTCOME_TONE: Record<'success' | 'partial' | 'failure', Tone> = { success: 'normal', partial: 'warning', failure: 'critical' };

const BIT_PER_GBIT = 1e9;

function Chip({ tone, icon: Icon, children, ...rest }: { tone: Tone | null; icon: typeof Info; children: React.ReactNode; 'data-sim-status'?: string }) {
  const style = tone ? TONE_STYLES[tone] : null;
  return (
    <span {...rest} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]', style ? cn(style.border, style.surface, style.text) : 'border-panel-border text-foreground/80')}>
      <Icon size={13} aria-hidden />
      {children}
    </span>
  );
}

export function SimulationSection({ mission, evaluation, editor }: { mission: Mission; evaluation: Evaluation; editor: Editor }) {
  const t = useTranslations('mission.sim');
  const { locale, text } = useText();
  const store = useSimStore((state) => state);

  // Until the store holds this mission's simulation (first render, server render), show the one a start would use.
  const fallback = useMemo(() => {
    const plan = buildSimPlan(mission);
    return { plan, sim: createSim(plan) };
  }, [mission]);
  const live = store.missionId === mission.id && store.plan !== null && store.sim !== null;
  const plan = live ? store.plan! : fallback.plan;
  const sim: SimState = live ? store.sim! : fallback.sim;
  const status: SimStatus = live ? store.status : sim.ended ? 'finished' : 'idle';
  const clockT = live ? store.clockT : 0;
  const stale = live && status !== 'idle' && store.missionRevision !== mission.revision;

  useEffect(() => { simStore.getState().prepare(mission); }, [mission]);

  // Playback: the frame clock only supplies elapsed real time; every number comes from the simulation.
  useEffect(() => {
    if (status !== 'running') return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const seconds = (now - last) / 1000;
      if (seconds >= 1 / 40) { last = now; simStore.getState().tick(seconds); }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const telemetry = useMemo(() => readTelemetry(plan, sim, clockT), [plan, sim, clockT]);
  const frame = useMemo(() => frameOf(plan, telemetry.frameKey), [plan, telemetry.frameKey]);
  const trail = useMemo(() => craftTrail(plan, sim, clockT), [plan, sim, clockT]);

  const met = (seconds: number) => {
    const whole = Math.floor(Math.max(0, seconds));
    const pad = (value: number) => String(value).padStart(2, '0');
    return t('metFormat', { d: Math.floor(whole / 86_400), h: pad(Math.floor((whole % 86_400) / 3_600)), m: pad(Math.floor((whole % 3_600) / 60)), s: pad(whole % 60) });
  };
  const gbit = (bits: number) => `${formatNumber(bits / BIT_PER_GBIT, locale)} Gbit`;
  const km = (meters: number) => `${formatNumber(meters / 1000, locale)} km`;
  const duration = (seconds: number) => text(durationText(seconds));
  const stageName = (id: (typeof plan.stageIds)[number]) => text(stageTitle(plan, id));
  const canStart = status === 'idle' && !plan.unresolvable;
  const locked = Boolean(plan.unresolvable);
  const lost = sim.ended && sim.outcome?.kind === 'failure';
  const timeline = sim.timeline.slice(-250).reverse();
  const risks = plan.evaluation.readiness.groups.flatMap((group) => group.checks).filter((check) => check.status !== 'pass');
  const model = getModelCard('mission-simulation');

  const button = 'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const primary = 'border-accent-cyan/50 bg-accent-cyan/12 text-accent-cyan';
  const neutral = 'border-panel-border text-foreground/80 hover:text-foreground';

  const telemetryRow = (key: string, value: React.ReactNode) => (
    <div key={key} data-telemetry={key} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 text-sm">
      <dt className="text-foreground/70">{t(`telemetry.${key}`)}</dt>
      <dd className="text-right font-mono">{value}</dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-4" data-simulation data-status={status}>
      <Panel title={t('title')} eyebrow={t('eyebrow')}>
        <p className="text-sm text-foreground/80">{t('intro')}</p>
        <p className="mt-1 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">{t('disclaimer')}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t('controls.label')}>
          <button type="button" data-action="start" disabled={!canStart} onClick={() => simStore.getState().start()} className={cn(button, primary, focusRing())}><Play size={14} aria-hidden />{t('controls.start')}</button>
          <button type="button" data-action="pause" disabled={status !== 'running'} onClick={() => simStore.getState().pause()} className={cn(button, neutral, focusRing())}><Pause size={14} aria-hidden />{t('controls.pause')}</button>
          <button type="button" data-action="resume" disabled={status !== 'paused'} onClick={() => simStore.getState().resume()} className={cn(button, neutral, focusRing())}><Play size={14} aria-hidden />{t('controls.resume')}</button>
          <button type="button" data-action="restart" disabled={locked} onClick={() => simStore.getState().restart(mission)} className={cn(button, neutral, focusRing())}><RotateCcw size={14} aria-hidden />{t('controls.restart')}</button>
          <button type="button" data-action="skip" disabled={status === 'idle' || status === 'finished'} onClick={() => simStore.getState().skipStage()} className={cn(button, neutral, focusRing())}><SkipForward size={14} aria-hidden />{t('controls.skip')}</button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <Chip tone={status === 'finished' ? (sim.outcome ? OUTCOME_TONE[sim.outcome.kind] : null) : status === 'running' ? 'normal' : status === 'paused' ? 'warning' : null} icon={status === 'running' ? Play : status === 'paused' ? Pause : status === 'finished' ? CheckCircle2 : Circle} data-sim-status={status}>{t(`status.${status}`)}</Chip>
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div role="radiogroup" aria-label={t('controls.speed')} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-foreground/70">{t('controls.speed')}:</span>
            {SIM_SPEEDS.map((entry) => (
              <button key={entry.id} type="button" role="radio" aria-checked={store.speed === entry.id} data-speed={entry.id} onClick={() => simStore.getState().setSpeed(entry.id)} className={cn('rounded-full border px-2.5 py-1 font-mono text-[11px]', store.speed === entry.id ? primary : neutral, focusRing())}>{t(`speed.${entry.id}`)}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-foreground/70">{t('controls.seed')}:</span>
            <NumberField label={t('controls.seed')} value={mission.seed} min={0} max={4_294_967_295} step={1} width="w-36" onCommit={(value) => editor.apply((m) => setSeed(m, Math.round(value)))} />
            <button type="button" data-action="new-seed" onClick={() => editor.apply((m) => setSeed(m, Math.floor(Math.random() * 4_294_967_296)))} className={cn(button, neutral, focusRing())}>{t('controls.newSeed')}</button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-foreground/60">{t('controls.seedHint')}</p>
        <div className="mt-2"><EditNotice error={editor.error} /></div>
        {stale ? <p role="status" data-stale className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100"><AlertTriangle size={14} aria-hidden className="mt-px shrink-0" />{t('stale')}</p> : null}
      </Panel>

      {plan.unresolvable ? (
        <Panel title={t('blocked.title')}>
          <ul className="list-disc pl-5 text-sm text-red-200" data-unresolvable>{plan.unresolvable.map((reason, index) => <li key={index}>{text(reason)}</li>)}</ul>
        </Panel>
      ) : null}

      {status === 'idle' && !plan.unresolvable ? (
        <Panel title={t('before.title')} eyebrow={t('before.eyebrow')}>
          <p className="text-sm text-foreground/80">{t('before.intro', { fail: evaluation.readiness.counts.fail, warning: evaluation.readiness.counts.warning })}</p>
          {plan.blockers.length > 0 ? (
            <div data-hold className="mt-2 rounded-lg border border-red-400/45 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <p className="flex items-center gap-1.5 font-semibold"><OctagonAlert size={14} aria-hidden />{t('before.hold')}</p>
              <ul className="mt-1 list-disc pl-5">{plan.blockers.map((reason, index) => <li key={index}>{text(reason)}</li>)}</ul>
            </div>
          ) : <p data-clear className="mt-2 flex items-center gap-1.5 text-sm text-emerald-200"><CheckCircle2 size={14} aria-hidden />{t('before.clear', { reliability: formatNumber(plan.launch.reliability * 100, locale) })}</p>}
          {risks.length > 0 ? <div className="mt-3"><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{t('before.risks')}</p><CheckList checks={risks} /></div> : null}
        </Panel>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SimulationPreview frame={frame} craft={telemetry.position} trail={trail} lost={lost} stageLabel={stageName(telemetry.stage)} timeLabel={`${t('telemetry.met')} ${met(telemetry.elapsedS)}`} />
        </div>
        <Panel title={t('stages.title')} eyebrow={t(`class.${plan.missionClass}`)}>
          <ol className="flex flex-col gap-1.5" data-stages>
            {sim.stages.map((record, index) => {
              const Icon = STAGE_ICON[record.result];
              const tone = STAGE_TONE[record.result] ?? null;
              const planned = stageLength(plan, record.id);
              const lengthText = record.endS !== null && record.startS !== null ? duration(record.endS - record.startS) : planned > 0 ? `${t('stages.planned')} ${duration(planned)}` : '—';
              return (
                <li key={record.id} data-stage={record.id} data-result={record.result} aria-current={index === sim.stageIndex && !sim.ended ? 'step' : undefined} className={cn('rounded-xl border px-3 py-2', tone ? TONE_STYLES[tone].border : 'border-panel-border', index === sim.stageIndex && !sim.ended ? 'bg-accent-cyan/8' : 'bg-white/[0.02]')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={tone} icon={Icon}>{t(`stages.result.${record.result}`)}</Chip>
                    <p className="text-sm font-semibold">{index + 1}. {stageName(record.id)}</p>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-foreground/65">
                    {record.startS !== null ? `${t('stages.started')} ${met(record.startS)}` : t('stages.notStarted')}
                    {record.endS !== null ? ` · ${t('stages.ended')} ${met(record.endS)}` : ''} · {lengthText}
                  </p>
                  {record.outcome ? <p className="mt-1 text-xs text-foreground/80">{text(record.outcome)}</p> : null}
                  {index === sim.stageIndex && !sim.ended && stageLength(plan, record.id) > 0 ? (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={t('stages.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(telemetry.stageProgress * 100)}>
                      <div className="h-full bg-accent-cyan" style={{ width: `${telemetry.stageProgress * 100}%` }} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      {sim.outcome ? (
        <Panel title={t('outcome.title')} eyebrow={t(`outcome.kind.${sim.outcome.kind}`)} className={cn('border', TONE_STYLES[OUTCOME_TONE[sim.outcome.kind]].border)}>
          <div data-outcome={sim.outcome.kind}>
            <Chip tone={OUTCOME_TONE[sim.outcome.kind]} icon={sim.outcome.kind === 'success' ? CheckCircle2 : sim.outcome.kind === 'partial' ? AlertTriangle : OctagonAlert}>{t(`outcome.kind.${sim.outcome.kind}`)}</Chip>
            <p className="mt-2 text-sm font-semibold">{text(sim.outcome.summary)}</p>
            <p className="mt-0.5 text-xs text-foreground/65">{t('outcome.endedIn', { stage: stageName(sim.outcome.endedIn) })}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{t('outcome.why')}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-foreground/85" data-reasons>{sim.outcome.reasons.map((reason, index) => <li key={index}>{text(reason)}</li>)}</ul>
            <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {[['ops', `${formatNumber(sim.outcome.operationsDays, locale)} ${t('outcome.days')}`], ['science', `${formatNumber(sim.outcome.sciencePoints, locale)} / ${formatNumber(sim.outcome.scienceNominal, locale)} ${t('outcome.points')}`], ['delivered', gbit(sim.outcome.deliveredBits)], ['lost', gbit(sim.outcome.lostBits)]].map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 text-sm"><dt className="text-foreground/70">{t(`outcome.${key}`)}</dt><dd className="font-mono">{value}</dd></div>
              ))}
            </dl>
            {sim.outcome.requirements.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5" data-requirements>
                {sim.outcome.requirements.map((requirement) => (
                  <li key={requirement.id} data-requirement={requirement.kind} data-met={requirement.met} className="flex flex-wrap items-center gap-2 text-sm">
                    <Chip tone={requirement.met ? 'normal' : 'critical'} icon={requirement.met ? CheckCircle2 : OctagonAlert}>{t(requirement.met ? 'outcome.met' : 'outcome.notMet')}</Chip>
                    <span>{t(`outcome.requirement.${requirement.kind}`)}</span>
                    <span className="font-mono text-foreground/70">{formatNumber(requirement.actual, locale)} / {formatNumber(requirement.limit, locale)} {requirement.unit}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title={t('telemetry.title')} eyebrow={t('telemetry.eyebrow')}>
        <dl className="grid gap-x-8 md:grid-cols-2" data-telemetry-grid>
          {telemetryRow('met', met(telemetry.elapsedS))}
          {telemetryRow('stage', stageName(telemetry.stage))}
          {telemetryRow('position', telemetry.altitudeM !== null ? `${km(telemetry.altitudeM)} ${t('telemetry.aboveSurface')}` : `${formatNumber(telemetry.distanceM / 149_597_870_700, locale)} AU ${t('telemetry.fromSun')}`)}
          {telemetryRow('velocity', `${formatNumber(telemetry.speedMps / 1000, locale)} km/s`)}
          {telemetryRow('generation', `${formatNumber(telemetry.powerGenerationW, locale)} W · ${t(telemetry.sunlit ? 'telemetry.sunlit' : 'telemetry.eclipse')}`)}
          {telemetryRow('load', `${formatNumber(telemetry.powerLoadW, locale)} W`)}
          {telemetryRow('battery', `${formatNumber(telemetry.batteryJ / 3_600, locale)} Wh (${formatNumber(telemetry.batteryFraction * 100, locale)} %)`)}
          {telemetryRow('powerMode', t(`powerMode.${telemetry.powerMode}`))}
          {telemetryRow('generated', gbit(telemetry.generatedBits))}
          {telemetryRow('backlog', gbit(telemetry.backlogBits))}
          {telemetryRow('delivered', gbit(telemetry.deliveredBits))}
          {telemetryRow('lost', gbit(telemetry.lostBits))}
          {telemetryRow('link', t(telemetry.inContact ? 'telemetry.inContact' : 'telemetry.noContact'))}
          {telemetryRow('health', `${formatNumber(telemetry.health * 100, locale)} %`)}
          {telemetryRow('dv', `${formatNumber(telemetry.dvRemaining, locale)} m/s`)}
          {telemetryRow('science', `${formatNumber(telemetry.sciencePoints, locale)} ${t('outcome.points')}`)}
        </dl>
        {telemetry.instruments.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{t('telemetry.instruments')}</p>
            <ul className="flex flex-col gap-1" data-instruments>
              {telemetry.instruments.map((instrument) => (
                <li key={instrument.instrumentId} data-instrument={instrument.instrumentId} data-status={instrument.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{text(instrument.name)}</span>
                  <Chip tone={instrument.status === 'observing' ? 'normal' : instrument.status === 'fault' ? 'critical' : instrument.status === 'unpowered' ? 'warning' : null} icon={instrument.status === 'observing' ? CircleDot : instrument.status === 'fault' ? OctagonAlert : instrument.status === 'unpowered' ? AlertTriangle : Circle}>{t(`instrumentStatus.${instrument.status}`)}</Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <Panel title={t('timeline.title')} eyebrow={t('timeline.eyebrow')}>
        {timeline.length === 0 ? <p className="text-sm text-foreground/65" data-timeline-empty>{t('timeline.empty')}</p> : (
          <ol className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1" data-timeline>
            {timeline.map((entry, index) => {
              const Icon = SEVERITY_ICON[entry.severity];
              const tone = SEVERITY_TONE[entry.severity];
              return (
                <li key={`${entry.t}-${index}`} data-severity={entry.severity} data-kind={entry.kind} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={tone} icon={Icon}>{t(`timeline.severity.${entry.severity}`)}</Chip>
                    <span className="font-mono text-[11px] text-foreground/65">{met(entry.t)}</span>
                    <span className="text-[11px] text-foreground/55">{stageName(entry.stage)}</span>
                  </div>
                  <p className="mt-1 text-sm">{text(entry.text)}</p>
                  {entry.cause ? <p className="mt-0.5 text-xs text-foreground/70">{t('timeline.because')} {text(entry.cause)}</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel title={t('events.title')} eyebrow={t('events.eyebrow')}>
        <p className="text-xs text-foreground/70">{t('events.hint', { seed: mission.seed })}</p>
        {plan.events.length === 0 ? <p className="mt-2 text-sm text-foreground/65" data-no-events>{t('events.none')}</p> : (
          <ul className="mt-2 flex flex-col gap-1" data-event-schedule>
            {plan.events.map((event) => {
              const started = sim.eventsStarted.includes(event.id);
              return (
                <li key={event.id} data-event={event.kind} data-started={started} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 py-1 text-sm">
                  <span>{t(`events.kind.${event.kind}`)}</span>
                  <span className="font-mono text-xs text-foreground/70">{met(event.startS)} · {event.endS === null ? t('events.permanent') : duration(event.endS - event.startS)} · {t(started ? 'events.happened' : 'events.upcoming')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={t('model.title')} eyebrow={t('model.eyebrow')}>
        <p className="text-sm text-foreground/80">{t('model.intro')}</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm" data-sim-assumptions>
          {SIM_ASSUMPTION_LIST.map((assumption) => (
            <li key={assumption.id} className="flex flex-wrap items-baseline gap-2"><ProvenanceBadge provenance={assumption.provenance} /><span className="font-mono text-xs text-foreground/70">{assumption.value}</span><span className="text-foreground/85">{text(assumption.label)}</span></li>
          ))}
        </ul>
        {model ? (
          <div className="mt-3" data-model="mission-simulation">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{text(model.title)}</p>
            <ul className="mt-1 list-disc pl-5 font-mono text-xs text-foreground/80">{model.equations.map((equation) => <li key={equation}>{equation}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{t('model.limitations')}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-foreground/80">{model.limitations.map((limitation, index) => <li key={index}>{text(limitation)}</li>)}</ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
