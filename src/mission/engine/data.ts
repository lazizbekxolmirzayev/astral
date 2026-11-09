import type { Instrument } from '../models/catalog';
import type { Quantity } from '../models/quantity';
import { toBase } from '../units';
import { derive, type Derived } from './derived';
import type { LinkResult } from './link';
import type { ResolvedDesign } from './resolve';

/** Bits one instrument adds to the onboard queue per day; relay instruments add none. */
export function instrumentDailyData(part: Instrument, quantity = 1): number {
  if (part.dataHandling === 'relay') return 0;
  return toBase(part.dataRate) * toBase(part.dutyCycle) * quantity * 86_400;
}

export type DataResult = {
  /** Data the instruments produce per day (store-and-forward instruments only). */
  dailyGenerated: Derived;
  /** What the link can send per day: usable rate × contact time. */
  dailyCapacity: Derived;
  /** Onboard storage from the flight computers. */
  storage: Derived;
  /** Largest backlog, measured just before a downlink, over the whole mission. */
  peakQueue: Derived;
  /** Data thrown away because the storage was full. */
  lost: Derived;
  /** Data still waiting at the end of operations. */
  endBacklog: Derived;
  generatedTotal: Derived;
  /** Data that reached Earth during the planned operations. */
  returnedTotal: Derived;
  /** returned / generated, 1 when nothing is generated. */
  returnFraction: number;
  /** First day (1-based) the storage overflowed, or null. */
  firstOverflowDay: number | null;
};

/**
 * Daily data volume and the onboard queue. Each day the instruments add their data,
 * then one downlink pass sends up to the daily capacity; what does not fit waits in
 * storage, and what does not fit in storage is lost. The queue is measured at its
 * fullest (a whole day of data plus the backlog), which is slightly conservative.
 */
export function computeData(design: ResolvedDesign, link: LinkResult): DataResult {
  const model = 'communications-data' as const;
  const days = design.mission.plannedOperationsDays;

  let generated = 0;
  const inputs: Quantity[] = [];
  for (const { part, quantity } of design.instruments) {
    if (part.dataHandling === 'relay') continue;
    generated += instrumentDailyData(part, quantity);
    inputs.push(part.dataRate, part.dutyCycle);
  }
  const dailyGenerated = derive(generated, 'bit', model, 'Σ data rate · duty cycle · quantity · 86 400 s (per day)', inputs);

  const capacity = link.usableRate.value * link.contactTime.value;
  const dailyCapacity = derive(capacity, 'bit', model, 'usable data rate · contact time (per day)', [link.usableRate, link.contactTime]);

  let storageBits = 0;
  const storageInputs: Quantity[] = [];
  for (const { part, quantity } of design.computers) {
    storageBits += toBase(part.storage) * quantity;
    storageInputs.push(part.storage);
  }
  const storage = derive(storageBits, 'bit', model, 'Σ flight-computer storage', storageInputs);

  let queue = 0;
  let peak = 0;
  let lost = 0;
  let returned = 0;
  let firstOverflowDay: number | null = null;
  for (let day = 1; day <= days; day += 1) {
    queue += generated;
    if (queue > peak) peak = queue;
    if (queue > storageBits) {
      lost += queue - storageBits;
      queue = storageBits;
      firstOverflowDay ??= day;
    }
    const sent = Math.min(queue, capacity);
    returned += sent;
    queue -= sent;
  }
  const generatedTotal = generated * days;

  return {
    dailyGenerated,
    dailyCapacity,
    storage,
    peakQueue: derive(peak, 'bit', model, 'fullest the queue gets before a downlink', [dailyGenerated, dailyCapacity, storage]),
    lost: derive(lost, 'bit', model, 'data discarded when storage is full', [dailyGenerated, storage]),
    endBacklog: derive(queue, 'bit', model, 'data still onboard at the end of operations', [dailyGenerated, dailyCapacity]),
    generatedTotal: derive(generatedTotal, 'bit', model, 'daily data × operations days', [dailyGenerated]),
    returnedTotal: derive(returned, 'bit', model, 'Σ over days of min(queue, capacity)', [dailyGenerated, dailyCapacity, storage]),
    returnFraction: generatedTotal > 0 ? Math.min(1, returned / generatedTotal) : 1,
    firstOverflowDay,
  };
}
