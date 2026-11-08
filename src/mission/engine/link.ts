import { BODIES, SI_EXACT } from '../constants';
import type { Comms } from '../models/catalog';
import type { Quantity } from '../models/quantity';
import { dbToRatio, ratioToDb, toBase, valueIn } from '../units';
import type { AssumptionReader } from './assumptions';
import { derive, type Derived } from './derived';
import { slantRange } from './orbit';
import type { ResolvedDesign } from './resolve';

export type LinkResult = {
  /** Id of the radio that gives the highest usable rate; null when the design has none. */
  radioId: string | null;
  segment: 'near-earth' | 'deep-space';
  /** Worst-case distance between the spacecraft and the ground station. */
  distance: Derived;
  /** Seconds per day the spacecraft can transmit to Earth. */
  contactTime: Derived;
  /** Rate the link budget supports at that distance, with required Eb/N0, margin and losses applied. */
  budgetRate: Derived;
  /** Ceiling set by the radio hardware. */
  hardwareRate: Derived;
  /** min(budgetRate, hardwareRate): the rate the design can actually use. */
  usableRate: Derived;
  /** How much stronger the link is than needed at the hardware rate, in dB. Negative = the link cannot sustain the hardware rate. */
  marginDb: number;
};

const ZERO = (model: 'communications-data', basis: string) => derive(0, 'bit/s', model, basis);

export function groundSegment(destinationId: string): 'near-earth' | 'deep-space' {
  return destinationId === 'moon' || destinationId === 'mars' ? 'deep-space' : 'near-earth';
}

/**
 * Downlink budget (free-space, one direction):
 *   Rb = Pt·Gt·Gr / (Lfs · Lother · k · Ts · (Eb/N0)req · margin)
 * with Gr = η(πD/λ)² and Lfs = (4πd/λ)². Rain fade, pointing dynamics and coding gain
 * beyond the assumed Eb/N0 are not modelled (see the communications-data card).
 */
export function computeLink(design: ResolvedDesign, assume: AssumptionReader): LinkResult {
  const { destination, mission } = design;
  const model = 'communications-data' as const;
  const segment = groundSegment(destination.id);

  // distance
  let distanceM: number;
  const distanceInputs: Quantity[] = [];
  if (destination.earthDistance) {
    distanceM = toBase(destination.earthDistance.max);
    distanceInputs.push(destination.earthDistance.max);
  } else {
    const earth = BODIES.earth;
    const altitude = mission.orbit.apoapsisAltKm * 1000;
    const elevation = valueIn(assume.quantity('link-min-elevation'), 'rad');
    distanceM = slantRange(toBase(earth.radius), altitude, elevation);
    distanceInputs.push(earth.radius, assume.quantity('link-min-elevation'));
  }
  const distance = derive(distanceM, 'm', model, 'greatest distance to the ground station (slant range at minimum elevation, or farthest Earth distance)', distanceInputs);

  const contactId = `contact-time-${destination.id}`;
  const contactTime = derive(assume.value(contactId), 's', model, 'ground-station contact per day', [assume.quantity(contactId)]);

  const evaluate = (radio: Comms) => {
    const wavelength = SI_EXACT.speedOfLightMS / toBase(radio.frequency);
    const diameter = assume.value(`ground-diameter-${segment}-${radio.band}`);
    const noiseTemperature = assume.value(`ground-noise-${segment}-${radio.band}`);
    const efficiency = assume.value(segment === 'near-earth' ? 'ground-efficiency-near-earth' : 'ground-efficiency-deep-space');
    const groundGain = efficiency * ((Math.PI * diameter) / wavelength) ** 2;
    const pathLoss = ((4 * Math.PI * distanceM) / wavelength) ** 2;
    const required = dbToRatio(assume.value('link-required-ebn0') + assume.value('link-margin') + assume.value('link-other-losses'));
    const received = (toBase(radio.txPower) * dbToRatio(toBase(radio.antennaGain)) * groundGain) / pathLoss;
    const rate = received / (SI_EXACT.boltzmannJPerK * noiseTemperature * required);
    const inputs = [
      radio.txPower,
      radio.antennaGain,
      radio.frequency,
      distance,
      assume.quantity(`ground-diameter-${segment}-${radio.band}`),
      assume.quantity(`ground-noise-${segment}-${radio.band}`),
      assume.quantity('link-required-ebn0'),
      assume.quantity('link-margin'),
      assume.quantity('link-other-losses'),
    ];
    return { radio, rate, inputs };
  };

  const options = design.comms.map(({ part }) => evaluate(part));
  if (options.length === 0) {
    return {
      radioId: null,
      segment,
      distance,
      contactTime,
      budgetRate: ZERO(model, 'no radio on board'),
      hardwareRate: ZERO(model, 'no radio on board'),
      usableRate: ZERO(model, 'no radio on board'),
      marginDb: Number.NEGATIVE_INFINITY,
    };
  }
  let best = options[0]!;
  for (const option of options) {
    if (Math.min(option.rate, toBase(option.radio.maxDataRate)) > Math.min(best.rate, toBase(best.radio.maxDataRate))) best = option;
  }
  const hardware = toBase(best.radio.maxDataRate);
  const budgetRate = derive(best.rate, 'bit/s', model, 'Rb = Pt·Gt·Gr / (Lfs·Lother·k·Ts·Eb/N0·margin)', best.inputs);
  const hardwareRate = derive(hardware, 'bit/s', model, `maximum data rate of ${best.radio.id}`, [best.radio.maxDataRate]);
  const usableRate = derive(Math.min(best.rate, hardware), 'bit/s', model, 'min(link-budget rate, hardware rate)', [budgetRate, hardwareRate]);

  return { radioId: best.radio.id, segment, distance, contactTime, budgetRate, hardwareRate, usableRate, marginDb: ratioToDb(best.rate / hardware) };
}
