import { REQUIREMENT_KINDS } from '../models/mission';
import { L, type Localized } from '../i18n';
import { SIM_ASSUMPTIONS } from './assumptions';
import type { SimPlan } from './plan';
import type { MissionOutcome, RequirementCheck, ScheduledEvent, SimState, StageId, StageRecord, TimelineKind, TimelineSeverity } from './types';

const DAY = 86_400;
const BIT_PER_GBIT = 1e9;

/* ------------------------------------------------------------------ text helpers */

const num = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** A duration in both languages: seconds, minutes, hours or days, whichever reads best. */
export function durationText(seconds: number): Localized {
  const abs = Math.abs(seconds);
  if (abs < 120) return L(`${num(seconds)} s`, `${num(seconds)} s`);
  if (abs < 7_200) return L(`${num(seconds / 60, 1)} min`, `${num(seconds / 60, 1)} daq`);
  if (abs < 2 * DAY) return L(`${num(seconds / 3_600, 1)} h`, `${num(seconds / 3_600, 1)} soat`);
  return L(`${num(seconds / DAY, 1)} d`, `${num(seconds / DAY, 1)} kun`);
}

const join = (...parts: Array<Localized | string>): Localized => ({
  en: parts.map((part) => (typeof part === 'string' ? part : part.en)).join(''),
  uz: parts.map((part) => (typeof part === 'string' ? part : part.uz)).join(''),
});

/* --------------------------------------------------------------------- creation */

function blankInstruments(plan: SimPlan): SimState['instruments'] {
  return plan.instruments.map((instrument) => ({ instrumentId: instrument.instrumentId, status: 'off', creditedS: 0, observedS: 0, faultUntilS: null }));
}

export function createSim(plan: SimPlan): SimState {
  const stages: StageRecord[] = plan.stageIds.map((id) => ({ id, plannedSeconds: plan.stagePlannedS[id] ?? 0, startS: null, endS: null, result: 'pending', outcome: null }));
  const state: SimState = {
    t: 0,
    stageIndex: 0,
    stageElapsedS: 0,
    ended: false,
    stages,
    timeline: [],
    outcome: null,
    batteryJ: plan.power.batteryCapacityJ,
    generationW: 0,
    loadW: 0,
    sunlit: true,
    powerMode: 'nominal',
    health: 1,
    generatedBits: 0,
    deliveredBits: 0,
    lostBits: 0,
    backlogBits: 0,
    inContact: false,
    dvUsed: 0,
    instruments: blankInstruments(plan),
    degradationFactor: 1,
    opsStartS: null,
    opsEndS: null,
    opsFlownS: 0,
    eventsStarted: [],
    eventsEnded: [],
    lastLog: {},
    opsLimit: null,
  };
  if (plan.unresolvable) {
    stages[0] = { ...stages[0]!, startS: 0, endS: 0, result: 'failed', outcome: plan.unresolvable[0] ?? null };
    for (let index = 1; index < stages.length; index += 1) stages[index] = { ...stages[index]!, result: 'skipped' };
    state.ended = true;
    state.outcome = finalize(plan, state, join(L('The design cannot be flown: ', "Dizaynni uchirib bo'lmaydi: "), plan.unresolvable[0] ?? L('unresolved', "aniqlanmagan")));
  }
  return state;
}

function clone(state: SimState): SimState {
  return { ...state, stages: state.stages.map((stage) => ({ ...stage })), timeline: state.timeline.slice(), instruments: state.instruments.map((item) => ({ ...item })), eventsStarted: state.eventsStarted.slice(), eventsEnded: state.eventsEnded.slice(), lastLog: { ...state.lastLog } };
}

/* ------------------------------------------------------------------------ log */

function log(plan: SimPlan, s: SimState, kind: TimelineKind, severity: TimelineSeverity, text: Localized, cause: Localized | null = null) {
  s.timeline.push({ t: s.t, stage: plan.stageIds[s.stageIndex]!, kind, severity, text, cause });
}

/** True when a recurring message is allowed again. Checked before the text is built, because building it formats numbers. */
function due(s: SimState, key: string, gapS: number): boolean {
  const last = s.lastLog[key];
  return last === undefined || s.t - last >= gapS;
}

/** Logs a recurring condition at most once per `gapS`, so a flickering state does not flood the timeline. */
function logGap(plan: SimPlan, s: SimState, key: string, gapS: number, kind: TimelineKind, severity: TimelineSeverity, text: Localized, cause: Localized | null = null) {
  const last = s.lastLog[key];
  if (last !== undefined && s.t - last < gapS) return;
  s.lastLog[key] = s.t;
  log(plan, s, kind, severity, text, cause);
}

/* -------------------------------------------------------------------- queries */

export const stageLength = (plan: SimPlan, id: StageId): number => (id === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[id] ?? 0));

/** Time step for a stage: fine enough to resolve eclipses and contact passes, coarse where nothing quick happens. */
function stepOf(plan: SimPlan, id: StageId): number {
  if (id === 'pre-launch') return 60;
  if (id === 'launch') return 10;
  if (id === 'orbit-insertion' || id === 'destination-arrival') return 60;
  const contact = plan.link.contactS > 0 ? plan.link.contactS / 3 : 3_600;
  if (id === 'cruise') return Math.max(30, Math.min(3_600, contact));
  const eclipsed = plan.power.eclipseS > 0 ? plan.power.periodS / 24 : 3_600;
  return Math.max(30, Math.min(900, eclipsed, contact));
}

/** Seconds of the daily contact window that fall inside [t, t+dt). The window starts a quarter-day into each day. */
export function contactOverlap(plan: SimPlan, t: number, dt: number): number {
  const length = Math.min(plan.link.contactS, DAY);
  if (length <= 0 || dt <= 0) return 0;
  const offset = SIM_ASSUMPTIONS.contactStartFraction * DAY;
  let overlap = 0;
  const firstDay = Math.floor((t - offset - length) / DAY);
  const lastDay = Math.floor((t + dt - offset) / DAY);
  for (let day = firstDay; day <= lastDay; day += 1) {
    const start = day * DAY + offset;
    overlap += Math.max(0, Math.min(t + dt, start + length) - Math.max(t, start));
  }
  return overlap;
}

const activeAt = (events: readonly ScheduledEvent[], kind: ScheduledEvent['kind'], t: number) => events.filter((event) => event.kind === kind && t >= event.startS && (event.endS === null || t < event.endS));

/** Science points earned so far: value × share of the planned observing time achieved × share of the data that reached Earth. */
export function scienceEarned(plan: SimPlan, s: SimState): number {
  const delivered = s.generatedBits > 0 ? Math.min(1, s.deliveredBits / s.generatedBits) : 1;
  let total = 0;
  plan.instruments.forEach((instrument, index) => {
    if (!instrument.pointingOk || instrument.dutyCycle <= 0 || plan.ops.plannedS <= 0) return;
    const achieved = (s.instruments[index]?.creditedS ?? 0) / (instrument.dutyCycle * plan.ops.plannedS);
    total += instrument.scienceValue * achieved * (instrument.relay ? 1 : delivered);
  });
  return total;
}

/* ----------------------------------------------------------------- stage logic */

function enterStage(plan: SimPlan, s: SimState) {
  const index = s.stageIndex;
  const id = plan.stageIds[index]!;
  const record = s.stages[index]!;
  record.startS = s.t;
  record.result = 'active';
  const planned = stageLength(plan, id);
  log(plan, s, 'stage', 'info', join(L('Stage begins: ', 'Bosqich boshlandi: '), stageTitle(plan, id)), planned > 0 ? join(L('Planned length ', 'Rejalashtirilgan davomiyligi '), durationText(planned)) : null);

  if (id === 'pre-launch') {
    const { counts, groups } = plan.evaluation.readiness;
    log(plan, s, 'check', counts.fail > 0 ? 'warning' : 'success', L(`Pre-launch checks: ${counts.pass} pass, ${counts.warning} warning, ${counts.fail} fail.`, `Uchirishdan oldingi tekshiruvlar: ${counts.pass} PASS, ${counts.warning} WARNING, ${counts.fail} FAIL.`));
    for (const group of groups) {
      for (const check of group.checks) {
        if (check.status === 'pass') continue;
        log(plan, s, 'check', check.status === 'fail' ? 'error' : 'warning', check.reason, check.fix);
      }
    }
    for (const reason of plan.blockers) log(plan, s, 'check', 'error', join(L('Launch hold: ', 'Uchirish to\'xtatildi: '), reason));
  }
  if (id === 'launch') log(plan, s, 'burn', 'info', join(L('Liftoff on ', 'Uchirish: '), plan.launcherName, L(' from ', ' – '), plan.siteName));
  if (id === 'orbit-insertion') {
    s.batteryJ = plan.power.batteryCapacityJ;
    log(plan, s, 'power', 'info', L(`Spacecraft separated; batteries start full (${num(plan.power.batteryCapacityJ / 3_600)} Wh usable).`, `Apparat ajraldi; batareyalar to'la (${num(plan.power.batteryCapacityJ / 3_600)} Wh foydali).`));
  }
  if (id === 'science-operations') {
    s.opsStartS = s.t;
    s.opsLimit = plan.ops.limit;
    if (plan.ops.limit !== 'planned') {
      const cause = plan.ops.limit === 'design-life'
        ? L(`The bus design life leaves only ${durationText(plan.ops.effectiveS).en} after the cruise.`, `Platforma xizmat muddati safardan keyin faqat ${durationText(plan.ops.effectiveS).uz} qoldiradi.`)
        : L(`Only ${num(Math.max(0, plan.dv.available - plan.dv.insertion - plan.dv.corrections), 0)} m/s of Δv is left for stationkeeping, which covers ${durationText(plan.ops.effectiveS).en}.`, `Orbitani ushlash uchun faqat ${num(Math.max(0, plan.dv.available - plan.dv.insertion - plan.dv.corrections), 0)} m/s Δv qolgan, bu ${durationText(plan.ops.effectiveS).uz}ga yetadi.`);
      log(plan, s, 'science', 'warning', join(L('Operations will stop after ', 'Operatsiyalar to\'xtaydi: '), durationText(plan.ops.effectiveS), L(' instead of ', ' (reja: '), durationText(plan.ops.plannedS), L('.', ').')), cause);
    }
    s.instruments.forEach((item) => { item.status = 'idle'; });
  }
  if (id === 'data-transmission') {
    s.instruments.forEach((item) => { if (item.status !== 'fault') item.status = 'off'; });
    log(plan, s, 'comms', 'info', L(`Final downlink: ${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit still waiting.`, `Yakuniy uzatish: ${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit kutmoqda.`));
  }
}

/** Closes the active stage with a result, then moves to the next one (or ends the mission when it was the last). */
function leaveStage(plan: SimPlan, s: SimState, result: 'ok' | 'failed', outcomeText: Localized | null) {
  const record = s.stages[s.stageIndex]!;
  const id = record.id;
  const warned = s.timeline.some((entry) => entry.stage === id && entry.severity === 'warning' && entry.t >= (record.startS ?? 0));
  record.endS = s.t;
  record.result = result === 'failed' ? 'failed' : warned ? 'degraded' : 'ok';
  record.outcome = outcomeText;
  if (outcomeText) log(plan, s, 'stage', result === 'failed' ? 'error' : 'success', join(L('Stage ends: ', 'Bosqich tugadi: '), stageTitle(plan, id)), outcomeText);
  if (result === 'failed') {
    for (let index = s.stageIndex + 1; index < s.stages.length; index += 1) s.stages[index]!.result = 'skipped';
    s.ended = true;
    s.outcome = finalize(plan, s, outcomeText ?? L('The mission was lost.', "Missiya yo'qotildi."));
    return;
  }
  if (s.stageIndex >= s.stages.length - 1) { s.ended = true; s.outcome = finalize(plan, s, null); return; }
  s.stageIndex += 1;
  s.stageElapsedS = 0;
}

/** Ends the mission in the active stage because something went wrong. */
function lose(plan: SimPlan, s: SimState, text: Localized, cause: Localized | null) {
  log(plan, s, 'outcome', 'error', text, cause);
  leaveStage(plan, s, 'failed', cause ? join(text, ' – ', cause) : text);
}

function dvText(plan: SimPlan, s: SimState, needed: number): Localized {
  const have = Math.max(0, plan.dv.available - s.dvUsed);
  return L(`Δv needed ${num(needed)} m/s, only ${num(have)} m/s left.`, `Kerak Δv ${num(needed)} m/s, faqat ${num(have)} m/s qoldi.`);
}

/** How a launch flown by hand ended (the texts carry no numbers, so they can be translated one to one). */
export const PILOT_FAILURE: Record<'ground' | 'stress' | 'fuel', { headline: Localized; cause: Localized }> = {
  ground: { headline: L('Launch failure: the vehicle fell back and hit the ground.', "Uchirish muvaffaqiyatsiz: raketa qaytib yerga tushdi."), cause: L('The climb was not steep or powerful enough to leave the ground behind.', "Ko'tarilish yerni tark etish uchun yetarlicha tik yoki kuchli bo'lmadi.") },
  stress: { headline: L('Launch failure: the vehicle broke up in flight.', "Uchirish muvaffaqiyatsiz: raketa havoda parchalanib ketdi."), cause: L('It was turned too sharply while the air pressure on it was high (max-Q), so the structure failed.', "Havo bosimi baland paytda (max-Q) u juda keskin burildi va konstruksiya buzildi.") },
  fuel: { headline: L('Launch failure: the vehicle ran out of propellant before reaching orbit.', "Uchirish muvaffaqiyatsiz: raketa orbitaga chiqmasdan yoqilg'isi tugadi."), cause: L('The speed gained was not enough to stay in orbit, so the vehicle falls back into the atmosphere.', "Olingan tezlik orbitada qolish uchun yetmadi, shuning uchun raketa atmosferaga qaytib tushadi.") },
};
export const PILOT_SUCCESS: Record<'perfect' | 'good' | 'rough', Localized> = {
  perfect: L('Reached the parking orbit under manual control: a perfect insertion.', "Qo'lda boshqarib to'xtash orbitasiga chiqdi: a'lo darajadagi chiqish."),
  good: L('Reached the parking orbit under manual control: a good insertion.', "Qo'lda boshqarib to'xtash orbitasiga chiqdi: yaxshi chiqish."),
  rough: L('Reached a stable orbit under manual control, but far from the planned parking orbit.', "Qo'lda boshqarib barqaror orbitaga chiqdi, ammo rejalangan to'xtash orbitasidan uzoqda."),
};

function finishStage(plan: SimPlan, s: SimState) {
  const id = plan.stageIds[s.stageIndex]!;
  switch (id) {
    case 'pre-launch': {
      if (plan.blockers.length > 0) { lose(plan, s, L('Launch scrubbed: the vehicle was not cleared to fly.', "Uchirish bekor qilindi: raketa uchishga ruxsat olmadi."), plan.blockers[0]!); return; }
      leaveStage(plan, s, 'ok', L('All checks done; cleared for launch.', "Barcha tekshiruvlar tugadi; uchirishga ruxsat berildi."));
      return;
    }
    case 'launch': {
      const { reliability, draw, success, pilot } = plan.launch;
      if (pilot) {
        if (pilot.failure) { const text = PILOT_FAILURE[pilot.failure]; lose(plan, s, text.headline, text.cause); return; }
        leaveStage(plan, s, 'ok', PILOT_SUCCESS[pilot.grade ?? 'good']);
        return;
      }
      if (!success) { lose(plan, s, L('Launch failure: the vehicle was lost during ascent.', "Uchirish muvaffaqiyatsiz: raketa ko'tarilishda yo'qotildi."), L(`The vehicle's reliability is ${num(reliability * 100, 1)} %; this mission's seeded draw was ${num(draw * 100, 1)} %, which is not below it.`, `Raketa ishonchliligi ${num(reliability * 100, 1)} %; bu missiyaning seed bo'yicha tanlovi ${num(draw * 100, 1)} % bo'lib, undan past emas.`)); return; }
      leaveStage(plan, s, 'ok', L(`Reached the delivery target (reliability ${num(reliability * 100, 1)} %, draw ${num(draw * 100, 1)} %).`, `Yetkazish nuqtasiga chiqdi (ishonchlilik ${num(reliability * 100, 1)} %, tanlov ${num(draw * 100, 1)} %).`));
      return;
    }
    case 'orbit-insertion': {
      if (plan.missionClass === 'earth-orbit') {
        const needed = plan.dv.insertion + plan.dv.corrections;
        if (plan.dv.impulsiveImpossible || plan.dv.available - s.dvUsed < needed) {
          s.dvUsed = Math.min(plan.dv.available, s.dvUsed + needed);
          lose(plan, s, L('Orbit insertion failed: the spacecraft could not reach its orbit.', "Orbitaga kirish muvaffaqiyatsiz: apparat orbitasiga yeta olmadi."), plan.dv.impulsiveImpossible ? L('The propulsion cannot make the impulsive burn the insertion needs.', "Dvigatel orbitaga kirish uchun kerak bo'lgan impulsli yoqishni bajara olmaydi.") : dvText(plan, s, needed));
          return;
        }
        s.dvUsed += needed;
        log(plan, s, 'burn', 'success', L(`Insertion burn done: ${num(needed)} m/s. Δv remaining ${num(plan.dv.available - s.dvUsed)} m/s.`, `Orbitaga kirish yoqishi bajarildi: ${num(needed)} m/s. Qolgan Δv ${num(plan.dv.available - s.dvUsed)} m/s.`));
        leaveStage(plan, s, 'ok', L('In the operational orbit.', 'Ishchi orbitada.'));
        return;
      }
      if (plan.departure && plan.departure.requiredC3 > plan.departure.providedC3) {
        lose(plan, s, L('Departure failed: the launcher could not give the spacecraft enough energy to leave Earth on this trajectory.', "Ketish muvaffaqiyatsiz: raketa apparatga bu traektoriya uchun Yerdan ketish energiyasini bera olmadi."), L(`Needed C3 ${num(plan.departure.requiredC3, 1)} km²/s², the launcher provides ${num(plan.departure.providedC3, 1)} km²/s².`, `Kerak C3 ${num(plan.departure.requiredC3, 1)} km²/s², raketa ${num(plan.departure.providedC3, 1)} km²/s² beradi.`));
        return;
      }
      leaveStage(plan, s, 'ok', plan.departure ? L(`Departure energy sufficient (C3 ${num(plan.departure.requiredC3, 1)} ≤ ${num(plan.departure.providedC3, 1)} km²/s²).`, `Ketish energiyasi yetarli (C3 ${num(plan.departure.requiredC3, 1)} ≤ ${num(plan.departure.providedC3, 1)} km²/s²).`) : L('On the transfer orbit.', "O'tish orbitasida."));
      return;
    }
    case 'cruise':
      leaveStage(plan, s, 'ok', L(`Cruise complete; ${num(plan.dv.corrections)} m/s spent on corrections.`, `Safar tugadi; tuzatishlarga ${num(plan.dv.corrections)} m/s sarflandi.`));
      return;
    case 'destination-arrival': {
      const needed = plan.dv.insertion;
      if (plan.dv.impulsiveImpossible || plan.dv.available - s.dvUsed < needed) {
        s.dvUsed = plan.dv.available;
        lose(plan, s, L('Arrival failed: the capture burn could not be completed, so the spacecraft flew past its destination.', "Yetib kelish muvaffaqiyatsiz: qamrab olish yoqishi bajarilmadi, apparat manzildan o'tib ketdi."), plan.dv.impulsiveImpossible ? L('The propulsion cannot make the impulsive capture burn.', "Dvigatel impulsli qamrab olish yoqishini bajara olmaydi.") : dvText(plan, s, needed));
        return;
      }
      s.dvUsed += needed;
      log(plan, s, 'burn', 'success', L(`Capture burn done: ${num(needed)} m/s. Δv remaining ${num(plan.dv.available - s.dvUsed)} m/s.`, `Qamrab olish yoqishi bajarildi: ${num(needed)} m/s. Qolgan Δv ${num(plan.dv.available - s.dvUsed)} m/s.`));
      leaveStage(plan, s, 'ok', L('Captured into the operational orbit.', 'Ishchi orbitaga qamrab olindi.'));
      return;
    }
    case 'science-operations': {
      s.opsEndS = s.t;
      const reason = s.opsLimit === 'propellant' ? L('Propellant for stationkeeping ran out.', "Orbitani ushlash uchun yoqilg'i tugadi.") : s.opsLimit === 'design-life' ? L('The bus design life ended.', 'Platformaning xizmat muddati tugadi.') : L('Planned operations completed.', 'Rejalashtirilgan operatsiyalar tugadi.');
      log(plan, s, 'science', s.opsLimit === 'planned' ? 'success' : 'warning', L(`Science operations end after ${durationText(s.opsFlownS).en}.`, `Ilmiy operatsiyalar ${durationText(s.opsFlownS).uz}dan keyin tugadi.`), reason);
      leaveStage(plan, s, 'ok', reason);
      return;
    }
    case 'data-transmission':
      leaveStage(plan, s, 'ok', s.backlogBits > 0 ? L(`${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit were still unsent when the downlink period ended.`, `Uzatish davri tugaganda ${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit hali yuborilmagan edi.`) : L('Everything was sent.', 'Hammasi yuborildi.'));
      return;
    case 'mission-completion':
      leaveStage(plan, s, 'ok', null);
      return;
  }
}

/* ---------------------------------------------------------------------- physics */

function applyEvents(plan: SimPlan, s: SimState) {
  for (const event of plan.events) {
    if (!s.eventsStarted.includes(event.id) && s.t >= event.startS) {
      s.eventsStarted.push(event.id);
      announce(plan, s, event, true);
    }
    if (event.endS !== null && !s.eventsEnded.includes(event.id) && s.eventsStarted.includes(event.id) && s.t >= event.endS) {
      s.eventsEnded.push(event.id);
      announce(plan, s, event, false);
    }
  }
}

function announce(plan: SimPlan, s: SimState, event: ScheduledEvent, starting: boolean) {
  const name = event.instrumentIndex !== null ? (plan.instruments[event.instrumentIndex]?.name ?? L('instrument', 'asbob')) : null;
  const pct = num(event.magnitude * 100, 1);
  switch (event.kind) {
    case 'solar-degradation':
      if (starting) {
        s.degradationFactor *= 1 - event.magnitude;
        log(plan, s, 'event', 'warning', L(`Solar array output drops ${pct} % permanently.`, `Quyosh panellari quvvati doimiy ${pct} % kamaydi.`), L('Radiation and dust damage the cells; the power budget margin shrinks.', "Radiatsiya va chang elementlarga zarar yetkazadi; quvvat zaxirasi kamayadi."));
      }
      return;
    case 'instrument-malfunction': {
      const item = s.instruments[event.instrumentIndex ?? 0];
      if (!item || !name) return;
      if (starting) {
        item.faultUntilS = event.endS ?? Number.POSITIVE_INFINITY;
        item.status = 'fault';
        log(plan, s, 'event', 'error', join(L('Instrument malfunction: ', 'Asbob nosozligi: '), name), event.endS === null ? L('The fault is permanent; this instrument returns no more science.', "Nosozlik doimiy; bu asbob endi ilmiy natija bermaydi.") : join(L('The instrument is out for ', 'Asbob '), durationText(event.endS - event.startS), L('; its science for that time is lost.', ' ishlamaydi; shu vaqt uchun ilmiy natija yo\'qoladi.')));
      } else {
        item.faultUntilS = null;
        log(plan, s, 'event', 'success', join(L('Instrument recovered: ', 'Asbob tiklandi: '), name));
      }
      return;
    }
    case 'communication-outage':
      log(plan, s, 'event', starting ? 'warning' : 'success', starting ? L('Communication outage: no downlink until the link returns.', "Aloqa uzildi: aloqa tiklanguncha ma'lumot yuborilmaydi.") : L('Communication restored.', 'Aloqa tiklandi.'), starting ? L('Data keeps accumulating in onboard storage during the outage.', "Uzilish vaqtida ma'lumotlar bortdagi xotirada yig'iladi.") : null);
      return;
    case 'observation-opportunity':
      log(plan, s, 'event', starting ? 'success' : 'info', starting ? L('Observation opportunity: instruments earn double science for a while.', 'Kuzatish imkoniyati: asboblar bir muddat ikki baravar ilmiy natija beradi.') : L('The observation opportunity has passed.', "Kuzatish imkoniyati o'tdi."), starting ? L('More data is produced, so the link must carry more.', "Ko'proq ma'lumot hosil bo'ladi, aloqa ko'proq yuk ko'taradi.") : null);
      return;
    case 'increased-power-demand':
      log(plan, s, 'event', starting ? 'warning' : 'info', starting ? L(`Power demand rises ${pct} %.`, `Quvvat talabi ${pct} % oshdi.`) : L('Power demand returns to normal.', 'Quvvat talabi normallashdi.'), starting ? L('Heaters and processing draw extra power; batteries may take the strain.', "Isitgichlar va hisoblash qo'shimcha quvvat oladi; yuk batareyalarga tushishi mumkin.") : null);
      return;
  }
}

/** One time step of the spacecraft's power, instruments and link. */
function physicsStep(plan: SimPlan, s: SimState, id: StageId, dt: number) {
  const inScience = id === 'science-operations';
  const P = plan.power;
  const mid = s.t + dt / 2;

  // sunlight: only orbits around a body are shadowed
  const shadowed = P.eclipseS > 0 && (id === 'science-operations' || id === 'data-transmission' || id === 'destination-arrival' || (id === 'orbit-insertion' && plan.missionClass === 'earth-orbit'));
  s.sunlit = !shadowed || mid % P.periodS < P.periodS - P.eclipseS;
  const ratio = P.bolW > 0 ? P.eolW / P.bolW : 1;
  const aged = P.bolW * ratio ** (s.t / P.degradationYearsS) * s.degradationFactor;
  s.generationW = s.sunlit ? aged : 0;

  // loads
  const demand = 1 + activeAt(plan.events, 'increased-power-demand', mid).reduce((sum, event) => sum + event.magnitude, 0);
  const outage = activeAt(plan.events, 'communication-outage', mid).length > 0;
  const bonus = activeAt(plan.events, 'observation-opportunity', mid).length > 0 ? 2 : 1;
  const overlap = contactOverlap(plan, s.t, dt);
  const fraction = overlap / dt;
  const burning = id === 'destination-arrival' || (id === 'orbit-insertion' && plan.missionClass === 'earth-orbit');
  const base = P.baseLoadW * demand + (burning ? P.propulsionPeakW : 0);
  const commsFull = P.commsFullW * (fraction + (1 - fraction) * P.commsStandby);
  const commsStandby = P.commsFullW * P.commsStandby;

  // which instruments want to observe this step
  const wants: boolean[] = plan.instruments.map((instrument, index) => {
    const item = s.instruments[index]!;
    if (item.faultUntilS !== null && mid >= item.faultUntilS) item.faultUntilS = null;
    if (!inScience || item.faultUntilS !== null || instrument.dutyCycle <= 0) return false;
    const cycle = Math.min(plan.geometry.periodS, DAY);
    const offset = (index / Math.max(1, plan.instruments.length)) * cycle;
    return instrument.dutyCycle >= 1 || (mid + offset) % cycle < instrument.dutyCycle * cycle;
  });
  const instrumentLoad = plan.instruments.reduce((sum, instrument, index) => sum + (wants[index] ? instrument.powerW : 0), 0);

  // power levels: shed the least important loads first
  const available = s.generationW + (dt > 0 ? s.batteryJ / dt : 0);
  let served: number;
  let mode: SimState['powerMode'];
  let instrumentsOn = false;
  let commsOn = true;
  if (available >= base + commsFull + instrumentLoad) { served = base + commsFull + instrumentLoad; mode = 'nominal'; instrumentsOn = true; }
  else if (available >= base + commsFull) { served = base + commsFull; mode = 'instruments-shed'; }
  else if (available >= base + commsStandby) { served = base + commsStandby; mode = 'comms-limited'; commsOn = false; }
  else if (available >= base) { served = base; mode = 'essential-only'; commsOn = false; }
  else { served = Math.max(0, available); mode = 'brownout'; commsOn = false; }

  const net = s.generationW - served;
  s.batteryJ = Math.min(P.batteryCapacityJ, Math.max(0, s.batteryJ + (net >= 0 ? net * P.chargeEfficiency : net) * dt));
  s.loadW = served;
  if (mode === 'brownout') s.health = Math.max(0, s.health - dt / SIM_ASSUMPTIONS.criticalPowerLossS);

  if (mode !== s.powerMode) {
    const worse = ['nominal', 'instruments-shed', 'comms-limited', 'essential-only', 'brownout'].indexOf(mode) > ['nominal', 'instruments-shed', 'comms-limited', 'essential-only', 'brownout'].indexOf(s.powerMode);
    if (worse && due(s, `power:${mode}`, 3 * DAY)) {
      const text = mode === 'instruments-shed' ? L('Power is short: science instruments are switched off.', "Quvvat yetmayapti: ilmiy asboblar o'chirildi.")
        : mode === 'comms-limited' ? L('Power is short: the radio drops to standby and cannot downlink.', "Quvvat yetmayapti: radio kutish rejimiga o'tdi, uzata olmaydi.")
        : mode === 'essential-only' ? L('Power is critically short: only essential systems run.', 'Quvvat juda kam: faqat muhim tizimlar ishlaydi.')
        : L('Brownout: even essential systems lack power, and the spacecraft is being damaged.', "Quvvat uzilishi: muhim tizimlarga ham quvvat yetmayapti, apparat zararlanmoqda.");
      logGap(plan, s, `power:${mode}`, 3 * DAY, 'power', mode === 'instruments-shed' ? 'warning' : 'error', text, L(`Generation ${num(s.generationW)} W against a load of ${num(base + commsFull + instrumentLoad)} W; the battery holds ${num(s.batteryJ / 3_600)} Wh.`, `Ishlab chiqarish ${num(s.generationW)} W, yuk ${num(base + commsFull + instrumentLoad)} W; batareyada ${num(s.batteryJ / 3_600)} Wh.`));
    }
    s.powerMode = mode;
  }

  // instruments
  plan.instruments.forEach((instrument, index) => {
    const item = s.instruments[index]!;
    if (!inScience) { if (item.status !== 'fault') item.status = 'off'; return; }
    if (item.faultUntilS !== null) { item.status = 'fault'; return; }
    if (!wants[index]) { item.status = 'idle'; return; }
    if (!instrumentsOn) { item.status = 'unpowered'; return; }
    item.status = 'observing';
    item.observedS += dt;
    item.creditedS += dt * bonus;
    if (!instrument.relay) {
      const bits = instrument.dataRateBps * dt * bonus;
      s.generatedBits += bits;
      s.backlogBits += bits;
    }
  });
  if (s.backlogBits > plan.storageBits) {
    const lost = s.backlogBits - plan.storageBits;
    s.lostBits += lost;
    s.backlogBits = plan.storageBits;
    if (due(s, 'storage', 5 * DAY)) logGap(plan, s, 'storage', 5 * DAY, 'comms', 'error', L('Onboard storage is full: new data is being lost.', "Bortdagi xotira to'la: yangi ma'lumotlar yo'qolmoqda."), L(`Storage holds ${num(plan.storageBits / BIT_PER_GBIT, 2)} Gbit and the link cannot empty it fast enough.`, `Xotira ${num(plan.storageBits / BIT_PER_GBIT, 2)} Gbit sig'adi, aloqa uni yetarlicha tez bo'shata olmayapti.`));
  }

  // downlink
  const downlinkOk = commsOn && !outage;
  s.inContact = downlinkOk && overlap > 0;
  if (s.inContact && s.backlogBits > 0) {
    const sent = Math.min(s.backlogBits, plan.link.rateBps * overlap);
    s.backlogBits -= sent;
    s.deliveredBits += sent;
  }
  const dailyCapacity = plan.link.rateBps * plan.link.contactS;
  if (s.backlogBits > Math.max(3 * dailyCapacity, 1) && due(s, 'backlog', 10 * DAY)) {
    logGap(plan, s, 'backlog', 10 * DAY, 'comms', 'warning', L(`Communication backlog is growing: ${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit are queued.`, `Aloqa navbati o'smoqda: ${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit navbatda.`), L(`The link sends at most ${num(dailyCapacity / BIT_PER_GBIT, 2)} Gbit per day, less than the instruments produce.`, `Aloqa kuniga ko'pi bilan ${num(dailyCapacity / BIT_PER_GBIT, 2)} Gbit yuboradi, bu asboblar hosil qilganidan kam.`));
  }
  if (inScience) s.opsFlownS += dt;
}

/* -------------------------------------------------------------------- stepping */

/**
 * Advances the simulation by up to `seconds` of mission time. Pure: the previous state is not modified.
 * Only whole steps are taken (a step is at most 15 minutes), so the state can lag the request by less than
 * one step; the caller keeps the rest. The same plan and the same target time give exactly the same state
 * however the time is split into calls, which is what makes playback speed irrelevant to the result.
 */
export function advanceSim(plan: SimPlan, previous: SimState, seconds: number): SimState {
  if (previous.ended || seconds <= 0) return previous;
  const s = clone(previous);
  let remaining = seconds;
  let guard = 0;
  while (remaining > 1e-9 && !s.ended && guard < 6_000_000) {
    guard += 1;
    const id = plan.stageIds[s.stageIndex]!;
    const record = s.stages[s.stageIndex]!;
    if (record.startS === null) enterStage(plan, s);
    const length = stageLength(plan, id);
    const left = length - s.stageElapsedS;
    if (left <= 1e-9 || (id === 'data-transmission' && s.backlogBits <= 0)) { finishStage(plan, s); continue; }

    // Only whole steps are taken, so the result never depends on how the caller splits the time.
    const dt = Math.min(stepOf(plan, id), left);
    if (remaining + 1e-9 < dt) break;
    applyEvents(plan, s);
    if (id === 'cruise' && plan.dv.corrections > 0) s.dvUsed += (plan.dv.corrections * dt) / length;
    if (id === 'science-operations' && plan.dv.stationkeeping > 0) s.dvUsed += (plan.dv.stationkeeping * dt) / plan.ops.plannedS;
    if (id !== 'pre-launch' && id !== 'launch') physicsStep(plan, s, id, dt);
    s.t += dt;
    s.stageElapsedS += dt;
    remaining -= dt;
    if (s.health <= 0 && id !== 'pre-launch' && id !== 'launch') {
      lose(plan, s, L('Spacecraft lost: power failed for too long.', "Apparat yo'qotildi: quvvat juda uzoq vaqt yetishmadi."), L('Critical power shortage damaged it beyond recovery.', "Jiddiy quvvat tanqisligi uni tiklab bo'lmas darajada zararladi."));
    }
  }
  // Reuse the old log array when nothing was logged, so views that depend on it do not re-render every frame.
  if (s.timeline.length === previous.timeline.length) s.timeline = previous.timeline;
  return s;
}

/** Runs until the active stage ends (or the mission does). */
export function skipToNextStage(plan: SimPlan, state: SimState): SimState {
  if (state.ended) return state;
  const index = state.stageIndex;
  let s = state;
  const id = plan.stageIds[index]!;
  const budget = Math.max(stageLength(plan, id), 1) + 1;
  s = advanceSim(plan, s, Math.max(budget - s.stageElapsedS, 1));
  return s.stageIndex === index && !s.ended ? advanceSim(plan, s, 1) : s;
}

/** Runs to the end of the mission. Used by tests and the "run to end" control. */
export function runToEnd(plan: SimPlan, state: SimState): SimState {
  let s = state;
  let guard = 0;
  while (!s.ended && guard < 64) { s = skipToNextStage(plan, s); guard += 1; }
  return s;
}

/* ------------------------------------------------------------------ the outcome */

export function stageTitle(plan: SimPlan, id: StageId): Localized {
  const earth = plan.missionClass === 'earth-orbit';
  switch (id) {
    case 'pre-launch': return L('Pre-launch checks', 'Uchirishdan oldingi tekshiruvlar');
    case 'launch': return L('Launch', 'Uchirish');
    case 'orbit-insertion': return earth ? L('Orbit insertion', 'Orbitaga kirish') : plan.missionClass === 'geostationary' ? L('Transfer-orbit injection', "O'tish orbitasiga chiqish") : L('Departure injection', 'Ketish traektoriyasiga chiqish');
    case 'cruise': return plan.missionClass === 'geostationary' ? L('Transfer to geostationary orbit', "Geostatsionar orbitaga o'tish") : plan.missionClass === 'lunar' ? L('Trans-lunar cruise', 'Oygacha safar') : plan.missionClass === 'mars' ? L('Interplanetary cruise to Mars', 'Marsgacha sayyoralararo safar') : L('Cruise to the operational orbit', 'Ishchi orbitagacha safar');
    case 'destination-arrival': return plan.missionClass === 'geostationary' ? L('Geostationary insertion', 'Geostatsionar orbitaga kirish') : plan.missionClass === 'lunar' ? L('Lunar orbit capture', 'Oy orbitasiga qamrab olinish') : plan.missionClass === 'mars' ? L('Mars orbit capture', 'Mars orbitasiga qamrab olinish') : L('Arrival in the operational orbit', 'Ishchi orbitaga yetib kelish');
    case 'science-operations': return L('Science operations', 'Ilmiy operatsiyalar');
    case 'data-transmission': return L('Data transmission', "Ma'lumot uzatish");
    case 'mission-completion': return L('Mission completion', 'Missiyaning yakuni');
  }
}

function finalize(plan: SimPlan, s: SimState, lostText: Localized | null): MissionOutcome {
  const lost = lostText !== null;
  const endedIn = plan.stageIds[Math.min(s.stageIndex, plan.stageIds.length - 1)]!;
  const sciencePoints = scienceEarned(plan, s);
  const operationsDays = s.opsFlownS / DAY;

  const requirements: RequirementCheck[] = plan.evaluation.requirements.length === 0 ? [] : plan.evaluation.requirements.map((requirement) => {
    const unit = REQUIREMENT_KINDS[requirement.kind].unit;
    const direction = REQUIREMENT_KINDS[requirement.kind].direction;
    let actual = requirement.actual;
    let fromSimulation = false;
    if (requirement.kind === 'min-operations') { actual = operationsDays; fromSimulation = true; }
    if (requirement.kind === 'min-science') { actual = sciencePoints; fromSimulation = true; }
    if (requirement.kind === 'min-data-return') { actual = s.deliveredBits / BIT_PER_GBIT; fromSimulation = true; }
    const met = fromSimulation ? (direction === 'min' ? actual >= requirement.limit : actual <= requirement.limit) : requirement.met;
    return { id: requirement.id, kind: requirement.kind, limit: requirement.limit, actual, unit, met, fromSimulation };
  });
  const metCount = requirements.filter((requirement) => requirement.met).length;
  const allMet = requirements.every((requirement) => requirement.met);

  const reasons: Localized[] = [];
  if (lostText) reasons.push(lostText);
  for (const record of s.stages) if (record.result === 'failed' && record.outcome && record.outcome !== lostText) reasons.push(record.outcome);
  if (s.opsLimit === 'propellant' && s.opsEndS !== null) reasons.push(L('Operations were cut short because the propellant for stationkeeping ran out.', "Orbitani ushlash uchun yoqilg'i tugagani sababli operatsiyalar qisqardi."));
  if (s.opsLimit === 'design-life' && s.opsEndS !== null) reasons.push(L('Operations were cut short because the bus design life ended.', 'Platformaning xizmat muddati tugagani sababli operatsiyalar qisqardi.'));
  if (s.lostBits > 0) reasons.push(L(`${num(s.lostBits / BIT_PER_GBIT, 2)} Gbit were lost because onboard storage was full.`, `Bortdagi xotira to'lgani uchun ${num(s.lostBits / BIT_PER_GBIT, 2)} Gbit yo'qoldi.`));
  if (s.backlogBits > 0 && !lost) reasons.push(L(`${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit never reached Earth.`, `${num(s.backlogBits / BIT_PER_GBIT, 2)} Gbit Yerga yetib bormadi.`));
  if (s.stages.some((stage) => stage.id === 'science-operations' && stage.startS !== null)) {
    plan.instruments.forEach((instrument, index) => {
      const item = s.instruments[index]!;
      const nominal = instrument.dutyCycle * plan.ops.plannedS;
      if (nominal > 0 && item.observedS < nominal * 0.8 && instrument.pointingOk) reasons.push(L(`${instrument.name.en} observed ${num((item.observedS / nominal) * 100)} % of its planned time (faults, power or a shorter mission).`, `${instrument.name.uz} rejalashtirilgan vaqtning ${num((item.observedS / nominal) * 100)} % ida kuzatdi (nosozlik, quvvat yoki qisqa missiya).`));
      if (!instrument.pointingOk) reasons.push(L(`${instrument.name.en} cannot point accurately enough, so it earns no science.`, `${instrument.name.uz} yetarli aniqlikda nishonga ololmaydi, shuning uchun ilmiy natija bermaydi.`));
    });
  }
  for (const requirement of requirements) {
    if (!requirement.met) reasons.push(L(`Requirement not met (${requirement.kind}): ${num(requirement.actual, 2)} ${requirement.unit} against ${num(requirement.limit, 2)}.`, `Talab bajarilmadi (${requirement.kind}): ${num(requirement.actual, 2)} ${requirement.unit}, kerak ${num(requirement.limit, 2)}.`));
  }

  let kind: MissionOutcome['kind'];
  const producedSomething = sciencePoints > 0 || s.deliveredBits > 0;
  if (!producedSomething || s.opsStartS === null) kind = 'failure';
  else if (allMet && !lost) kind = 'success';
  else kind = 'partial';

  const summary = kind === 'success'
    ? L(`Mission succeeded: all ${requirements.length} requirements were met.`, `Missiya muvaffaqiyatli: barcha ${requirements.length} ta talab bajarildi.`)
    : kind === 'partial'
      ? L(`Partial success: ${metCount} of ${requirements.length} requirements met, ${num(sciencePoints, 1)} science points returned.`, `Qisman muvaffaqiyat: ${requirements.length} ta talabdan ${metCount} tasi bajarildi, ${num(sciencePoints, 1)} ilmiy ball qaytdi.`)
      : (lostText ?? L('The mission produced no science.', 'Missiya ilmiy natija bermadi.'));
  if (kind === 'success' && reasons.length === 0) reasons.push(L('Every stage finished and every requirement was met.', 'Har bir bosqich tugadi va har bir talab bajarildi.'));

  return {
    kind,
    summary,
    reasons,
    requirements,
    operationsDays,
    sciencePoints,
    scienceNominal: plan.evaluation.details?.science.total.value ?? 0,
    deliveredBits: s.deliveredBits,
    generatedBits: s.generatedBits,
    lostBits: s.lostBits,
    endBacklogBits: s.backlogBits,
    endedIn,
  };
}
