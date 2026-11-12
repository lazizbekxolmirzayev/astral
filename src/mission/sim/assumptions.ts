import { L, type Localized } from '../i18n';

/**
 * Every number the simulation adds on top of the resource engine. They are game /
 * teaching assumptions (estimated or fictional), listed here so the UI can show them
 * and tests can pin them. Anything physical (power, Δv, data, link) comes from the
 * engine's evaluation of the mission document, not from here.
 */
export const SIM_ASSUMPTIONS = {
  countdownS: 3_600,
  ascentS: 540,
  earthInsertionS: 1_200,
  departureInjectionS: 1_800,
  captureS: 3_600,
  /** After operations the spacecraft keeps downlinking the backlog for at most this long. */
  finalDownlinkMaxDays: 14,
  /** Continuous critical power shortage that destroys the spacecraft (health runs from 1 to 0). */
  criticalPowerLossS: 20 * 86_400,
  /** One daily contact window starts this fraction of a day after the day begins. */
  contactStartFraction: 0.25,
  /** Parking-orbit altitude drawn for departures and ascents (picture only). */
  parkingAltitudeKm: 300,
  /** A deep-space mission is not shadowed: only near-body orbits have eclipses. */
  /** Share of design life during which an instrument may still show a one-off fault (not used by the schedule; kept for documentation). */
  permanentFaultShare: 0.25,
  /** Events per 100 days of operations, per kind. */
  eventRatePer100Days: { 'solar-degradation': 0.4, 'instrument-malfunction': 0.35, 'communication-outage': 0.6, 'observation-opportunity': 0.7, 'increased-power-demand': 0.5 },
  maxEventsPerKind: 6,
} as const;

export const SIM_ASSUMPTION_LIST: ReadonlyArray<{ id: string; value: string; label: Localized; provenance: 'estimated' | 'fictional' }> = [
  { id: 'countdown', value: '3600 s', provenance: 'fictional', label: L('Pre-launch countdown and checks take one hour.', "Uchirishdan oldingi sanoq va tekshiruvlar bir soat davom etadi.") },
  { id: 'ascent', value: '540 s', provenance: 'estimated', label: L('Ascent to orbit takes nine minutes; its path and speed are a schematic profile, not an integrated trajectory.', "Orbitaga chiqish to'qqiz daqiqa; uning yo'li va tezligi sxematik profil, integrallangan traektoriya emas.") },
  { id: 'insertion', value: '1200 s / 1800 s / 3600 s', provenance: 'fictional', label: L('Orbit insertion 20 min, injection coast 30 min, capture 1 h (burns are treated as impulsive).', "Orbitaga kirish 20 daq, tezlanish 30 daq, qamrab olish 1 soat (yoqishlar impulsli deb olinadi).") },
  { id: 'contact', value: '1 window / day', provenance: 'fictional', label: L('The daily contact time from the link model is flown as one window per day.', "Havola modelidagi kunlik aloqa vaqti kuniga bitta oyna sifatida o'tkaziladi.") },
  { id: 'critical-power', value: '20 d', provenance: 'fictional', label: L('Twenty days of continuous critical power shortage destroy the spacecraft; shorter shortages damage it in proportion.', "Yigirma kun uzluksiz jiddiy quvvat tanqisligi apparatni yo'q qiladi; qisqaroq tanqislik mutanosib zarar yetkazadi.") },
  { id: 'final-downlink', value: '14 d', provenance: 'fictional', label: L('After operations the remaining backlog is sent for at most 14 days.', "Operatsiyalardan keyin qolgan navbat ko'pi bilan 14 kun yuboriladi.") },
  { id: 'events', value: '0.35–0.7 / 100 d', provenance: 'fictional', label: L('Seeded events happen at these average rates per 100 days of operations.', "Seed asosidagi hodisalar operatsiyaning har 100 kunida shu o'rtacha tezlikda yuz beradi.") },
  { id: 'transfer', value: 'half ellipse', provenance: 'estimated', label: L('Cruise is drawn as half of a transfer ellipse between the departure and arrival radii, with ideal planet phasing; the catalog cruise time sets the pace.', "Safar ketish va yetib kelish radiuslari orasidagi o'tish ellipsining yarmi sifatida chiziladi, sayyoralar ideal fazada deb olinadi; tezlikni katalogdagi safar vaqti belgilaydi.") },
];
