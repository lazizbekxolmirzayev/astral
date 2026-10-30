'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { analyzeDesign, hasBlockers, instrumentScience } from '@/mission/analysis';
import {
  ADCS_SYSTEMS,
  BATTERIES,
  BUSES,
  COMMS_SYSTEMS,
  COMPUTERS,
  INSTRUMENTS,
  LAUNCHERS,
  objectiveById,
  OBJECTIVES,
  orbitById,
  orbitsFor,
  POWER_SOURCES,
  PROPULSION_SYSTEMS,
} from '@/mission/data';
import { scoreMission } from '@/mission/score';
import { decodeDesign, encodeDesign, SHARE_PARAM } from '@/mission/share';
import type { Analysis, FlightEvent, Issue, MissionDesign, RoleId } from '@/mission/types';
import { MISSION_STEPS, ROLES, STEP_OWNER, useMissionStore, type MissionStep } from '@/stores/missionStore';
import { LanguageSwitch } from '@/components/ui/SettingsPanel';
import { ResourcePanel } from './ResourcePanel';

const MissionScene = dynamic(() => import('./MissionScene'), { ssr: false });

type Translate = ReturnType<typeof useTranslations<'mission'>>;

const FRAME_MS = 90;
const SPEEDS = [1, 4] as const;
const LIFETIME_EXTRA_MONTHS = 36;
const DESIGN_STEPS: readonly MissionStep[] = ['spacecraft', 'payload', 'orbit', 'review'];

const BUTTON = 'rounded-full bg-accent-cyan px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';
const GHOST_BUTTON = 'rounded-full border border-panel-border px-5 py-2 text-sm text-foreground/85 transition hover:border-accent-cyan/50 hover:text-accent-cyan';

/** Issue and event params carry ids; show them as translated names. */
function localized(t: Translate, params: Record<string, number | string>) {
  const out = { ...params };
  if (typeof out.missing === 'string') out.missing = out.missing.split(', ').map((id) => t(`capabilities.${id}`)).join(', ');
  if (typeof out.instrument === 'string') out.instrument = t(`parts.${out.instrument}.name`);
  return out;
}

export function MissionGame() {
  const t = useTranslations('mission');
  const step = useMissionStore((state) => state.step);
  const design = useMissionStore((state) => state.design);
  const teamPlay = useMissionStore((state) => state.teamPlay);
  const players = useMissionStore((state) => state.players);
  const goTo = useMissionStore((state) => state.goTo);
  const analysis = useMemo(() => (design ? analyzeDesign(design) : null), [design]);

  useEffect(() => {
    void Promise.resolve(useMissionStore.persist.rehydrate()).then(() => {
      const shared = decodeDesign(new URLSearchParams(window.location.search).get(SHARE_PARAM));
      if (shared) useMissionStore.getState().loadDesign(shared);
    });
  }, []);

  const owner = STEP_OWNER[step];
  const active = MISSION_STEPS.indexOf(step);
  const canVisit = (target: MissionStep) => (target === 'objective' || (design !== null && DESIGN_STEPS.includes(target))) && step !== 'flight';

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t('intro')}</p>
        </div>
        <div className="w-full max-w-72 sm:w-72"><LanguageSwitch /></div>
      </header>

      <nav aria-label={t('stepsLabel')} className="mt-5 overflow-x-auto">
        <ol className="flex min-w-max gap-1.5">
          {MISSION_STEPS.map((item, index) => (
            <li key={item}>
              <button
                type="button"
                disabled={!canVisit(item)}
                aria-current={item === step ? 'step' : undefined}
                onClick={() => goTo(item)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${item === step ? 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan' : index < active ? 'border-panel-border text-foreground/85' : 'border-transparent text-foreground/55'} disabled:cursor-not-allowed`}
              >
                {index + 1}. {t(`steps.${item}`)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {teamPlay && owner ? (
        <p data-testid="turn-banner" className="mt-4 rounded-xl border border-nebula-purple/40 bg-nebula-purple/10 px-3 py-2 text-sm">
          {t('team.turn', { name: players[owner] || t(`roles.${owner}.name`), role: t(`roles.${owner}.name`) })} {t(`roles.${owner}.duty`)}
        </p>
      ) : null}

      <div className={`mt-5 grid gap-5 ${analysis && step !== 'objective' ? 'lg:grid-cols-[minmax(0,1fr)_19rem]' : ''}`}>
        <div className="min-w-0">
          {step === 'objective' ? <ObjectiveStep /> : null}
          {design && analysis && step === 'spacecraft' ? <SpacecraftStep design={design} /> : null}
          {design && analysis && step === 'payload' ? <PayloadStep design={design} /> : null}
          {design && analysis && step === 'orbit' ? <OrbitStep design={design} analysis={analysis} /> : null}
          {design && analysis && step === 'review' ? <ReviewStep analysis={analysis} /> : null}
          {design && step === 'flight' ? <FlightStep design={design} /> : null}
          {design && analysis && step === 'report' ? <ReportStep analysis={analysis} /> : null}
        </div>
        {analysis && step !== 'objective' ? <ResourcePanel analysis={analysis} /> : null}
      </div>
    </main>
  );
}

function ObjectiveStep() {
  const t = useTranslations('mission');
  const chooseObjective = useMissionStore((state) => state.chooseObjective);
  const teamPlay = useMissionStore((state) => state.teamPlay);
  const setTeamPlay = useMissionStore((state) => state.setTeamPlay);
  const players = useMissionStore((state) => state.players);
  const setPlayer = useMissionStore((state) => state.setPlayer);
  const sandbox = useMissionStore((state) => state.sandbox);
  const setSandbox = useMissionStore((state) => state.setSandbox);
  const bestScores = useMissionStore((state) => state.bestScores);
  const tutorialDone = useMissionStore((state) => state.tutorialDone);
  const finishTutorial = useMissionStore((state) => state.finishTutorial);

  return (
    <section aria-labelledby="objective-title">
      {tutorialDone ? null : (
        <aside data-testid="tutorial" className="mb-5 rounded-2xl border border-accent-cyan/30 bg-accent-cyan/5 p-4">
          <h2 className="font-semibold">{t('tutorial.title')}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground/80">
            {(['one', 'two', 'three', 'four'] as const).map((item) => <li key={item}>{t(`tutorial.${item}`)}</li>)}
          </ol>
          <button type="button" data-testid="tutorial-done" className={`mt-3 ${BUTTON}`} onClick={finishTutorial}>{t('tutorial.done')}</button>
        </aside>
      )}
      <h2 id="objective-title" className="text-lg font-semibold">{t('objective.title')}</h2>
      <p className="mt-1 text-sm text-foreground/70">{t('objective.help')}</p>

      <fieldset className="mt-4 rounded-2xl border border-panel-border p-4">
        <legend className="px-1 text-xs uppercase tracking-[0.16em] text-foreground/70">{t('team.title')}</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!teamPlay} onClick={() => setTeamPlay(false)} className={!teamPlay ? BUTTON : GHOST_BUTTON}>{t('team.solo')}</button>
          <button type="button" aria-pressed={teamPlay} onClick={() => setTeamPlay(true)} className={teamPlay ? BUTTON : GHOST_BUTTON}>{t('team.together')}</button>
        </div>
        {teamPlay ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ROLES.map((role) => (
              <label key={role} className="text-sm">
                <span className="font-medium">{t(`roles.${role}.name`)}</span>
                <span className="block text-xs text-foreground/65">{t(`roles.${role}.goal`)}</span>
                <input value={players[role]} maxLength={24} onChange={(event) => setPlayer(role, event.target.value)} placeholder={t('team.namePlaceholder')} className="mt-1 w-full rounded-lg border border-panel-border bg-white/[0.04] px-3 py-1.5 text-sm" />
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" data-testid="sandbox" checked={sandbox} onChange={(event) => setSandbox(event.target.checked)} className="mt-0.5" />
        <span><span className="font-medium">{t('sandbox.label')}</span><span className="block text-xs text-foreground/65">{t('sandbox.help')}</span></span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OBJECTIVES.map((objective) => (
          <button key={objective.id} type="button" data-testid={`objective-${objective.id}`} onClick={() => chooseObjective(objective.id)} className="rounded-2xl border border-panel-border bg-white/[0.03] p-4 text-left transition hover:border-accent-cyan/50">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t(`objectives.${objective.id}.name`)}</span>
              <span className="whitespace-nowrap text-xs text-star-gold">{t(`difficulty.${objective.difficulty}`)}</span>
            </span>
            <span className="mt-1 block text-sm text-foreground/70">{t(`objectives.${objective.id}.brief`)}</span>
            <span className="mt-2 block font-mono text-xs text-foreground/60">
              {t('objective.facts', { budget: objective.budgetM, months: objective.minLifetimeMonths, deadline: objective.launchDeadlineMonths })}
            </span>
            {bestScores[objective.id] ? <span data-testid={`best-${objective.id}`} className="mt-1 block font-mono text-xs text-star-gold">{t('objective.best', { score: bestScores[objective.id]! })}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

type Option = { id: string; massKg: number; powerW: number; costM: number };

function PartPicker({ legend, options, selected, onSelect, extra }: { legend: string; options: readonly Option[]; selected: string; onSelect: (id: string) => void; extra?: (id: string) => string }) {
  const t = useTranslations('mission');
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <PartCard key={option.id} option={option} checked={option.id === selected} onChange={() => onSelect(option.id)} type="radio" name={legend} extra={extra?.(option.id)} t={t} />
        ))}
      </div>
    </fieldset>
  );
}

function PartCard({ option, checked, onChange, type, name, extra, t }: { option: Option; checked: boolean; onChange: () => void; type: 'radio' | 'checkbox'; name: string; extra?: string; t: Translate }) {
  return (
    <label data-testid={`part-${option.id}`} className={`block cursor-pointer rounded-xl border p-3 transition ${checked ? 'border-accent-cyan/60 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02] hover:border-white/25'}`}>
      <span className="flex items-start gap-2">
        <input type={type} name={name} checked={checked} onChange={onChange} className="mt-1 accent-[var(--color-accent-cyan)]" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t(`parts.${option.id}.name`)}</span>
          <span className="block text-xs text-foreground/65">{t(`parts.${option.id}.desc`)}</span>
          <span className="mt-1 block font-mono text-[11px] text-foreground/70">{t('partStats', { mass: option.massKg, power: option.powerW, cost: option.costM })}</span>
          {extra ? <span className="block font-mono text-[11px] text-accent-cyan/85">{extra}</span> : null}
        </span>
      </span>
    </label>
  );
}

function StepFooter({ back, next, nextLabel, disabled }: { back?: MissionStep; next?: MissionStep; nextLabel?: string; disabled?: boolean }) {
  const t = useTranslations('mission');
  const goTo = useMissionStore((state) => state.goTo);
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {back ? <button type="button" className={GHOST_BUTTON} onClick={() => goTo(back)}>{t('back')}</button> : null}
      {next ? <button type="button" data-testid="next-step" className={BUTTON} disabled={disabled} onClick={() => goTo(next)}>{nextLabel ?? t('next')}</button> : null}
    </div>
  );
}

function SpacecraftStep({ design }: { design: MissionDesign }) {
  const t = useTranslations('mission');
  const update = useMissionStore((state) => state.updateDesign);
  const source = (id: string) => {
    const part = POWER_SOURCES.find((item) => item.id === id);
    return part?.rtgW ? t('extras.rtg', { watts: part.rtgW }) : t('extras.solar', { area: part?.arrayAreaM2 ?? 0 });
  };
  return (
    <section>
      <h2 className="text-lg font-semibold">{t('spacecraft.title')}</h2>
      <p className="mt-1 text-sm text-foreground/70">{t('spacecraft.help')}</p>
      <PartPicker legend={t('spacecraft.bus')} options={BUSES} selected={design.busId} onSelect={(busId) => update({ busId })} extra={(id) => { const bus = BUSES.find((item) => item.id === id)!; return t('extras.bus', { payload: bus.payloadCapacityKg, tank: bus.tankCapacityKg }); }} />
      <PartPicker legend={t('spacecraft.power')} options={POWER_SOURCES} selected={design.powerId} onSelect={(powerId) => update({ powerId })} extra={source} />
      <PartPicker legend={t('spacecraft.battery')} options={BATTERIES} selected={design.batteryId} onSelect={(batteryId) => update({ batteryId })} extra={(id) => t('extras.battery', { capacity: BATTERIES.find((item) => item.id === id)!.capacityWh })} />
      <PartPicker legend={t('spacecraft.comms')} options={COMMS_SYSTEMS} selected={design.commsId} onSelect={(commsId) => update({ commsId })} extra={(id) => { const comms = COMMS_SYSTEMS.find((item) => item.id === id)!; return t('extras.comms', { dish: comms.dishDiameterM, transmit: comms.transmitW }); }} />
      <PartPicker legend={t('spacecraft.computer')} options={COMPUTERS} selected={design.computerId} onSelect={(computerId) => update({ computerId })} extra={(id) => { const computer = COMPUTERS.find((item) => item.id === id)!; return t('extras.computer', { tolerance: Math.round(computer.radiationTolerance * 100), storage: computer.storageGb }); }} />
      <PartPicker legend={t('spacecraft.adcs')} options={ADCS_SYSTEMS} selected={design.adcsId} onSelect={(adcsId) => update({ adcsId })} />
      <PartPicker legend={t('spacecraft.propulsion')} options={PROPULSION_SYSTEMS} selected={design.propulsionId} onSelect={(propulsionId) => update({ propulsionId })} extra={(id) => t('extras.isp', { isp: PROPULSION_SYSTEMS.find((item) => item.id === id)!.ispS })} />
      <StepFooter back="objective" next="payload" />
    </section>
  );
}

function PayloadStep({ design }: { design: MissionDesign }) {
  const t = useTranslations('mission');
  const toggle = useMissionStore((state) => state.toggleInstrument);
  const objective = objectiveById(design.objectiveId);
  const orbit = orbitById(design.orbitId);
  return (
    <section>
      <h2 className="text-lg font-semibold">{t('payload.title')}</h2>
      <p className="mt-1 text-sm text-foreground/70">{t('payload.help')}</p>
      <p className="mt-2 text-sm">{t('payload.required', { list: objective.required.map((id) => t(`capabilities.${id}`)).join(', ') })}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {INSTRUMENTS.map((instrument) => (
          <PartCard
            key={instrument.id}
            option={instrument}
            type="checkbox"
            name="instruments"
            checked={design.instrumentIds.includes(instrument.id)}
            onChange={() => toggle(instrument.id)}
            extra={t('extras.instrument', { science: Math.round(instrumentScience(instrument, orbit, objective.priorities)), data: instrument.dataGbPerDay })}
            t={t}
          />
        ))}
      </div>
      <StepFooter back="spacecraft" next="orbit" />
    </section>
  );
}

function OrbitStep({ design, analysis }: { design: MissionDesign; analysis: Analysis }) {
  const t = useTranslations('mission');
  const update = useMissionStore((state) => state.updateDesign);
  const objective = objectiveById(design.objectiveId);
  const launchClass = orbitById(design.orbitId).launchClass;
  return (
    <section>
      <h2 className="text-lg font-semibold">{t('orbit.title')}</h2>
      <p className="mt-1 text-sm text-foreground/70">{t('orbit.help')}</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{t('orbit.choose')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {orbitsFor(objective.target).map((orbit) => (
            <label key={orbit.id} data-testid={`orbit-${orbit.id}`} className={`block cursor-pointer rounded-xl border p-3 ${orbit.id === design.orbitId ? 'border-accent-cyan/60 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02]'}`}>
              <span className="flex items-start gap-2">
                <input type="radio" name="orbit" checked={orbit.id === design.orbitId} onChange={() => update({ orbitId: orbit.id })} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{t(`orbits.${orbit.id}.name`)}</span>
                  <span className="block text-xs text-foreground/65">{t(`orbits.${orbit.id}.desc`)}</span>
                  <span className="mt-1 block font-mono text-[11px] text-foreground/70">{t('orbit.stats', { coverage: Math.round(orbit.coverage * 100), deltaV: orbit.insertionDeltaVMs, radiation: Math.round(orbit.radiation * 100) })}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-3 font-mono text-xs text-foreground/70">{t('orbit.derived', { period: Math.round(analysis.power.orbitMinutes), eclipse: Math.round(analysis.power.eclipseMinutes), propellant: Math.round(analysis.mass.propellantKg === Infinity ? 0 : analysis.mass.propellantKg), deltaV: Math.round(analysis.mass.deltaVMs) })}</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{t('orbit.launcher')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LAUNCHERS.map((launcher) => {
            const capacity = launcher.capacityKg[launchClass] ?? 0;
            return (
              <label key={launcher.id} data-testid={`launcher-${launcher.id}`} className={`block cursor-pointer rounded-xl border p-3 ${launcher.id === design.launcherId ? 'border-accent-cyan/60 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02]'}`}>
                <span className="flex items-start gap-2">
                  <input type="radio" name="launcher" checked={launcher.id === design.launcherId} onChange={() => update({ launcherId: launcher.id })} className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">{t(`launchers.${launcher.id}`)}</span>
                    <span className="block font-mono text-[11px] text-foreground/70">{capacity > 0 ? t('orbit.capacity', { capacity, cost: launcher.costM, reliability: Math.round(launcher.reliability * 100) }) : t('orbit.cannotReach')}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-semibold">
        {t('orbit.lifetime', { months: design.lifetimeMonths })}
        <input type="range" min={objective.minLifetimeMonths} max={objective.minLifetimeMonths + LIFETIME_EXTRA_MONTHS} value={design.lifetimeMonths} onChange={(event) => update({ lifetimeMonths: Number(event.target.value) })} className="mt-2 block w-full accent-[var(--color-accent-cyan)]" />
        <span className="block text-xs font-normal text-foreground/65">{t('orbit.lifetimeHelp')}</span>
      </label>
      <StepFooter back="payload" next="review" />
    </section>
  );
}

function IssueList({ issues }: { issues: readonly Issue[] }) {
  const t = useTranslations('mission');
  if (issues.length === 0) return <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{t('review.clear')}</p>;
  return (
    <ul className="mt-3 space-y-2">
      {issues.map((issue) => (
        <li key={issue.id} data-testid={`issue-${issue.id}`} className={`rounded-xl border p-3 text-sm ${issue.severity === 'blocker' ? 'border-rose-400/40 bg-rose-500/10' : 'border-amber-400/30 bg-amber-400/10'}`}>
          <span className="font-semibold">{t(`review.${issue.severity}`)}: </span>{t(`issues.${issue.id}`, localized(t, issue.params))}
        </li>
      ))}
    </ul>
  );
}

function ReviewStep({ analysis }: { analysis: Analysis }) {
  const t = useTranslations('mission');
  const teamPlay = useMissionStore((state) => state.teamPlay);
  const players = useMissionStore((state) => state.players);
  const signoffs = useMissionStore((state) => state.signoffs);
  const toggleSignoff = useMissionStore((state) => state.toggleSignoff);
  const launch = useMissionStore((state) => state.launch);
  const blocked = hasBlockers(analysis);
  const allSigned = !teamPlay || ROLES.every((role) => signoffs.includes(role));

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('review.title')}</h2>
      <p className="mt-1 text-sm text-foreground/70">{t('review.help')}</p>
      <IssueList issues={analysis.issues} />
      {teamPlay ? (
        <fieldset className="mt-4 rounded-2xl border border-panel-border p-4">
          <legend className="px-1 text-sm font-semibold">{t('team.signoff')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={signoffs.includes(role)} onChange={() => toggleSignoff(role)} />
                {players[role] ? `${players[role]} · ` : ''}{t(`roles.${role}.name`)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className={GHOST_BUTTON} onClick={() => useMissionStore.getState().goTo('orbit')}>{t('back')}</button>
        <button type="button" data-testid="launch" className={BUTTON} disabled={blocked || !allSigned} onClick={() => launch(Math.floor(Math.random() * 2 ** 31))}>{t('review.launch')}</button>
      </div>
    </section>
  );
}

function eventText(t: Translate, event: FlightEvent) {
  return t(`events.${event.id}`, localized(t, event.params));
}

function FlightStep({ design }: { design: MissionDesign }) {
  const t = useTranslations('mission');
  const flight = useMissionStore((state) => state.flight);
  const goTo = useMissionStore((state) => state.goTo);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const last = flight ? flight.frames.length - 1 : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => Math.min(last, value + 1)), FRAME_MS / speed);
    return () => window.clearInterval(timer);
  }, [last, speed]);

  if (!flight) return null;
  const frame = flight.frames[Math.min(index, last)]!;
  const objective = objectiveById(design.objectiveId);
  const arrival = flight.frames.find((item) => item.phase === 'operations')?.day ?? 0;
  const seen = flight.events.filter((event) => event.day <= frame.day);
  const finished = index >= last;
  const alive = frame.healthPct > 0;

  return (
    <section>
      <h2 className="text-lg font-semibold">{t(`phases.${frame.phase}`)}</h2>
      <div className="mt-3 h-72 overflow-hidden rounded-2xl border border-panel-border bg-black sm:h-96">
        <MissionScene target={objective.target} phase={frame.phase} cruiseProgress={arrival > 0 ? Math.min(1, frame.day / arrival) : 1} alive={alive} fallback={t('flight.noWebgl')} />
      </div>
      <p className="mt-1 text-xs text-foreground/55">{t('flight.notToScale')}</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['day', t('flight.dayValue', { day: frame.day })],
          ['power', t('flight.powerValue', { available: Math.round(frame.powerAvailableW), load: Math.round(frame.loadW) })],
          ['buffer', t('flight.bufferValue', { value: Number(frame.bufferGb.toFixed(1)) })],
          ['returned', t('flight.returnedValue', { value: Math.round(frame.returnedGb) })],
        ].map(([key, value]) => (
          <div key={key} className="rounded-xl border border-panel-border bg-white/[0.03] p-2">
            <dt className="text-[11px] uppercase tracking-[0.12em] text-foreground/60">{t(`flight.${key}`)}</dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {SPEEDS.map((value) => <button key={value} type="button" aria-pressed={speed === value} className={speed === value ? BUTTON : GHOST_BUTTON} onClick={() => setSpeed(value)}>{value}×</button>)}
        {finished
          ? <button type="button" data-testid="open-report" className={BUTTON} onClick={() => goTo('report')}>{t('flight.report')}</button>
          : <button type="button" data-testid="skip-flight" className={GHOST_BUTTON} onClick={() => setIndex(last)}>{t('flight.skip')}</button>}
      </div>

      <h3 className="mt-5 text-sm font-semibold">{t('flight.log')}</h3>
      <ol aria-live="polite" className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
        {[...seen].reverse().map((event, position) => (
          <li key={`${event.day}-${event.id}-${position}`} className="text-foreground/80"><span className="font-mono text-xs text-accent-cyan/85">{t('flight.dayValue', { day: event.day })}</span> {eventText(t, event)}</li>
        ))}
      </ol>
    </section>
  );
}

const OUTCOME_STYLE = { full: 'border-emerald-400/40 bg-emerald-400/10', partial: 'border-amber-400/40 bg-amber-400/10', failed: 'border-rose-400/40 bg-rose-500/10' } as const;
const INSIGHT_STYLE = { good: 'border-emerald-400/30', bad: 'border-rose-400/40', info: 'border-panel-border' } as const;

function ReportStep({ analysis }: { analysis: Analysis }) {
  const t = useTranslations('mission');
  const design = useMissionStore((state) => state.design);
  const [copied, setCopied] = useState(false);
  const flight = useMissionStore((state) => state.flight);
  const teamPlay = useMissionStore((state) => state.teamPlay);
  const attempts = useMissionStore((state) => state.attempts);
  const goTo = useMissionStore((state) => state.goTo);
  if (!flight) return null;
  const score = scoreMission(analysis, flight, teamPlay);
  const parts: [string, number, number][] = [['success', score.success, 20], ['science', score.science, 50], ['budget', score.budget, 15], ['robustness', score.robustness, 15]];
  if (teamPlay) parts.push(['team', score.teamBonus, 20]);

  async function copyDesignLink() {
    if (!design) return;
    const url = new URL(window.location.href);
    url.search = `?${SHARE_PARAM}=${encodeDesign(design)}`;
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
  }

  return (
    <section>
      <div data-testid="report-outcome" data-outcome={flight.outcome} className={`rounded-2xl border p-4 ${OUTCOME_STYLE[flight.outcome]}`}>
        <h2 className="text-lg font-semibold">{t(`outcomes.${flight.outcome}`)}</h2>
        <p className="mt-1 text-sm text-foreground/80">{t('report.summary', { days: flight.operationsDays, planned: flight.plannedDays, returned: Math.round(flight.returnedGb), science: Math.round(flight.scienceValue), required: Math.round(analysis.science.required) })}</p>
        <p className="mt-2 font-mono text-3xl" data-testid="report-score">{score.total}</p>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {parts.map(([key, value, max]) => <li key={key} className="flex justify-between rounded-xl border border-panel-border px-3 py-2 text-sm"><span>{t(`report.${key}`)}</span><span className="font-mono">{value}/{max}</span></li>)}
      </ul>

      <h3 className="mt-5 text-sm font-semibold">{t('report.why')}</h3>
      <ul className="mt-2 space-y-2">
        {score.insights.map((insight) => (
          <li key={insight.id} data-testid={`insight-${insight.id}`} className={`rounded-xl border p-3 text-sm ${INSIGHT_STYLE[insight.tone]}`}>{t(`insights.${insight.id}`, localized(t, insight.params))}</li>
        ))}
      </ul>

      {teamPlay ? <RoleResults goals={score.goals} /> : null}

      {attempts.length > 1 ? (
        <>
          <h3 className="mt-5 text-sm font-semibold">{t('report.attempts')}</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-foreground/60"><tr><th className="py-1 pr-3 font-normal">{t('report.mission')}</th><th className="py-1 pr-3 font-normal">{t('report.total')}</th><th className="py-1 pr-3 font-normal">{t('report.cost')}</th><th className="py-1 pr-3 font-normal">{t('report.mass')}</th><th className="py-1 font-normal">{t('report.result')}</th></tr></thead>
              <tbody className="font-mono">
                {attempts.map((attempt) => <tr key={attempt.id} className="border-t border-panel-border"><td className="py-1 pr-3 font-sans">{t(`objectives.${attempt.objectiveId}.name`)}</td><td className="py-1 pr-3">{attempt.score}</td><td className="py-1 pr-3">${attempt.costM}M</td><td className="py-1 pr-3">{attempt.wetKg} kg</td><td className="py-1 font-sans">{t(`outcomes.${attempt.outcome}`)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" data-testid="redesign" className={BUTTON} onClick={() => goTo('spacecraft')}>{t('report.redesign')}</button>
        <button type="button" className={GHOST_BUTTON} onClick={() => goTo('objective')}>{t('report.newMission')}</button>
        <button type="button" data-testid="share-design" className={GHOST_BUTTON} onClick={copyDesignLink}>{copied ? t('report.copied') : t('report.share')}</button>
      </div>
    </section>
  );
}

function RoleResults({ goals }: { goals: readonly { role: RoleId; met: boolean; params: Record<string, number | string> }[] }) {
  const t = useTranslations('mission');
  return (
    <>
      <h3 className="mt-5 text-sm font-semibold">{t('report.teamGoals')}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {goals.map((goal) => <li key={goal.role}><span aria-hidden>{goal.met ? '✓' : '✗'}</span> <span className="font-medium">{t(`roles.${goal.role}.name`)}:</span> {t(`roles.${goal.role}.result`, goal.params)} <span className="sr-only">{goal.met ? t('report.met') : t('report.notMet')}</span></li>)}
      </ul>
    </>
  );
}
