import { L, type Localized } from '../i18n';
import type { ModelCardId } from '../modelCards';
import { q, type Quantity } from '../models/quantity';
import { toBase, type UnitSymbol } from '../units';

/**
 * Every tunable assumption of the resource engine, in one table. Each one has a
 * unit, a provenance, an explanation in English and Uzbek, and the model it belongs
 * to; the evaluation lists the ones it used, so nothing is hidden inside a formula.
 *
 * Provenance here: `estimated` = typical engineering practice, `fictional` = a
 * game-design threshold.
 */

export type Assumption = {
  readonly id: string;
  readonly model: ModelCardId;
  readonly description: Localized;
  readonly quantity: Quantity;
};

const PRACTICE = 'Typical early-design engineering practice (cf. Wertz & Larson, SMAD). Educational value.';
const GAME = 'Game-design threshold, not an engineering standard.';

const est = (value: number, unit: UnitSymbol) => q(value, unit, 'estimated', PRACTICE);
const game = (value: number, unit: UnitSymbol) => q(value, unit, 'fictional', GAME);

const list: Assumption[] = [];
function add(id: string, model: ModelCardId, quantity: Quantity, description: Localized): void {
  list.push({ id, model, quantity, description });
}

/* ------------------------------- power budget ------------------------------ */
add('power-system-efficiency', 'power-budget', est(0.9, '1'), L('Share of array output that reaches the loads after wiring, regulation and converters.', "Panel quvvatining simlar, rostlagich va konvertorlardan keyin iste'molchilarga yetadigan ulushi."));
add('sun-factor-sun-tracking', 'power-budget', est(0.95, '1'), L('Average cosine factor of arrays that turn to face the Sun.', "Quyoshga qarab burilib turadigan panellarning o'rtacha kosinus koeffitsiyenti."));
add('sun-factor-body-mounted', 'power-budget', est(0.35, '1'), L('Orbit-average cosine factor of cells fixed to the spacecraft body.', "Korpusga mahkamlangan elementlarning orbita bo'yicha o'rtacha kosinus koeffitsiyenti."));
add('battery-round-trip-efficiency', 'power-budget', est(0.9, '1'), L('Energy returned by a battery per unit of energy put in.', "Batareyaga berilgan energiyaning qaytib olinadigan ulushi."));
add('comms-standby-fraction', 'power-budget', est(0.1, '1'), L('Share of the radio power drawn while it is not transmitting.', "Radio uzatmayotganda sarflaydigan quvvatining ulushi."));

/* ----------------------------- communications ----------------------------- */
const CONTACT_S: Record<string, [number, string, string]> = {
  leo: [1800, 'about 30 minutes of ground-station contact per day', 'kuniga taxminan 30 daqiqa yer stansiyasi bilan aloqa'],
  sso: [3600, 'about 60 minutes of ground-station contact per day (polar orbit, high-latitude station)', 'kuniga taxminan 60 daqiqa aloqa (qutbiy orbita, yuqori kenglikdagi stansiya)'],
  geo: [86_400, 'continuous contact (the satellite is always in view)', "uzluksiz aloqa (yo'ldosh doim ko'rinadi)"],
  moon: [21_600, 'about 6 hours of contact per day, allowing for Earth rotation and passes behind the Moon', "kuniga taxminan 6 soat aloqa (Yer aylanishi va Oy orqasidan o'tish hisobga olingan)"],
  mars: [18_000, 'about 5 hours of contact per day, allowing for ground-network sharing and occultation', "kuniga taxminan 5 soat aloqa (tarmoqni bo'lishish va yopilish hisobga olingan)"],
};
for (const [destination, [seconds, en, uz]] of Object.entries(CONTACT_S)) {
  add(`contact-time-${destination}`, 'communications-data', est(seconds, 's'), L(`Downlink time per day: ${en}.`, `Kunlik uzatish vaqti: ${uz}.`));
}
add('link-required-ebn0', 'communications-data', est(3, 'dB'), L('Eb/N0 needed by a modern coded modulation to reach a low bit-error rate.', "Zamonaviy kodlangan modulyatsiyaning past xato ehtimoliga erishishi uchun kerak Eb/N0."));
add('link-margin', 'communications-data', est(3, 'dB'), L('Safety margin kept on top of the required Eb/N0.', "Talab qilingan Eb/N0 ustiga saqlanadigan xavfsizlik zaxirasi."));
add('link-other-losses', 'communications-data', est(2, 'dB'), L('Combined pointing, polarisation and atmospheric loss.', "Yo'naltirish, qutblanish va atmosfera yo'qotishlarining yig'indisi."));
add('link-min-elevation', 'communications-data', est(10, 'deg'), L('Lowest elevation at which the ground station tracks an Earth-orbiting satellite.', "Yer stansiyasi yo'ldoshni kuzatadigan eng past ko'tarilish burchagi."));
add('ground-efficiency-near-earth', 'communications-data', est(0.6, '1'), L('Aperture efficiency of near-Earth ground antennas.', "Yerga yaqin stansiya antennalarining apertura samaradorligi."));
add('ground-efficiency-deep-space', 'communications-data', est(0.65, '1'), L('Aperture efficiency of deep-space ground antennas.', "Chuqur kosmos stansiya antennalarining apertura samaradorligi."));

type Band = 'uhf' | 's' | 'x' | 'ka';
const GROUND: Record<'near-earth' | 'deep-space', Record<Band, [number, number]>> = {
  'near-earth': { uhf: [3, 500], s: [3.7, 200], x: [11, 100], ka: [9, 150] },
  'deep-space': { uhf: [34, 150], s: [34, 40], x: [34, 25], ka: [34, 40] },
};
for (const [segment, bands] of Object.entries(GROUND)) {
  for (const [band, [diameter, noise]] of Object.entries(bands)) {
    add(`ground-diameter-${segment}-${band}`, 'communications-data', est(diameter, 'm' as UnitSymbol), L(`Receiving dish diameter, ${segment}, ${band}-band.`, `Qabul qiluvchi tarelka diametri, ${segment}, ${band}-diapazon.`));
    add(`ground-noise-${segment}-${band}`, 'communications-data', est(noise, 'K'), L(`System noise temperature of the ground receiver, ${segment}, ${band}-band.`, `Yer qabul qilgichining shovqin harorati, ${segment}, ${band}-diapazon.`));
  }
}

/* --------------------------------- delta-v -------------------------------- */
add('delta-v-margin', 'delta-v', est(0.1, '1'), L('Margin added on top of the computed Δv requirement.', "Hisoblangan Δv talabi ustiga qo'shiladigan zaxira."));
add('moon-arrival-vinf', 'delta-v', est(800, 'm/s'), L('Hyperbolic excess speed relative to the Moon on a direct trans-lunar transfer.', "To'g'ridan-to'g'ri Oyga uchishda Oyga nisbatan giperbolik ortiqcha tezlik."))
add('delta-v-correction-moon', 'delta-v', est(30, 'm/s'), L('Reserve for trajectory corrections on the way to the Moon.', "Oyga yo'lda traektoriyani tuzatish uchun zaxira."));
add('delta-v-correction-mars', 'delta-v', est(50, 'm/s'), L('Reserve for trajectory corrections on the way to Mars.', "Marsga yo'lda traektoriyani tuzatish uchun zaxira."));

/* -------------------------------- thresholds ------------------------------- */
add('tight-margin', 'mass-budget', game(0.1, '1'), L('A resource with less than this margin is shown as "tight".', "Zaxirasi shu qiymatdan kam resurs «tang» deb ko'rsatiladi."));

export const ASSUMPTIONS: readonly Assumption[] = list;

const byId: ReadonlyMap<string, Assumption> = new Map(list.map((assumption) => [assumption.id, assumption]));

/** Reads assumptions and remembers which ones a calculation actually used. */
export type AssumptionReader = {
  /** The value in the SI base unit. */
  value(id: string): number;
  quantity(id: string): Quantity;
  readonly used: () => Assumption[];
};

export function createAssumptionReader(): AssumptionReader {
  const used = new Map<string, Assumption>();
  const get = (id: string): Assumption => {
    const assumption = byId.get(id);
    if (!assumption) throw new Error(`unknown engine assumption "${id}"`);
    used.set(id, assumption);
    return assumption;
  };
  return {
    value: (id) => toBase(get(id).quantity),
    quantity: (id) => get(id).quantity,
    used: () => [...used.values()],
  };
}
