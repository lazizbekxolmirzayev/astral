import { SIM_ASSUMPTIONS } from './assumptions';
import { streamRng } from './rng';
import { EVENT_KINDS, type ScheduledEvent, type SimEventKind } from './types';

export type EventInputs = {
  seed: number;
  /** Mission elapsed time science operations begin and end (planned), seconds. */
  opsStartS: number;
  opsEndS: number;
  instrumentCount: number;
  /** Solar arrays are present (degradation has nothing to act on otherwise). */
  hasArrays: boolean;
};

const DAY = 86_400;

/**
 * The seeded event schedule. Each kind has its own random stream, so adding or removing
 * one kind never shifts another, and the same seed and mission give the same list.
 * Counts follow the rates in `SIM_ASSUMPTIONS`: expected = rate × days / 100, with the
 * fractional part decided by the generator.
 */
export function generateEvents(input: EventInputs): ScheduledEvent[] {
  const days = Math.max(0, (input.opsEndS - input.opsStartS) / DAY);
  const events: ScheduledEvent[] = [];
  if (days <= 0) return events;

  for (const kind of EVENT_KINDS) {
    if (kind === 'instrument-malfunction' && input.instrumentCount === 0) continue;
    if (kind === 'solar-degradation' && !input.hasArrays) continue;
    const rng = streamRng(input.seed, `events:${kind}`);
    const expected = (SIM_ASSUMPTIONS.eventRatePer100Days[kind] * days) / 100;
    const count = Math.min(SIM_ASSUMPTIONS.maxEventsPerKind, Math.floor(expected + rng()));
    for (let index = 0; index < count; index += 1) {
      const startS = input.opsStartS + rng() * (input.opsEndS - input.opsStartS) * 0.95;
      const event = describe(kind, rng, startS, input);
      events.push({ id: `${kind}-${index + 1}`, ...event });
    }
  }
  return events.sort((a, b) => a.startS - b.startS || a.id.localeCompare(b.id));
}

function describe(kind: SimEventKind, rng: () => number, startS: number, input: EventInputs): Omit<ScheduledEvent, 'id'> {
  switch (kind) {
    case 'solar-degradation':
      // A permanent loss of 2–8 % of array output (micrometeoroid hits, radiation, contamination).
      return { kind, startS, endS: null, magnitude: 0.02 + rng() * 0.06, instrumentIndex: null };
    case 'instrument-malfunction': {
      const index = Math.min(input.instrumentCount - 1, Math.floor(rng() * input.instrumentCount));
      const permanent = rng() < SIM_ASSUMPTIONS.permanentFaultShare;
      const durationS = (2 + rng() * 18) * DAY;
      return { kind, startS, endS: permanent ? null : startS + durationS, magnitude: 1, instrumentIndex: index };
    }
    case 'communication-outage':
      return { kind, startS, endS: startS + (0.5 + rng() * 2.5) * DAY, magnitude: 1, instrumentIndex: null };
    case 'observation-opportunity':
      // A rare target: science yield is doubled while it lasts.
      return { kind, startS, endS: startS + (1 + rng() * 3) * DAY, magnitude: 1, instrumentIndex: null };
    case 'increased-power-demand':
      // Heaters, a recovery manoeuvre or a processing load: 10–30 % more load.
      return { kind, startS, endS: startS + (2 + rng() * 8) * DAY, magnitude: 0.1 + rng() * 0.2, instrumentIndex: null };
  }
}
