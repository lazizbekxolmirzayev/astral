import { L } from '../i18n';
import type { Destination } from '../models/catalog';
import { q } from '../models/quantity';
import { game } from './provenance';

const FACTSHEET = 'NASA NSSDC Planetary Fact Sheet';
const ROUND_VALUE = 'Educational round value from mission-design practice; not taken from a specific mission.';

const estimated = (value: number, unit: 'd' | 'm/s') => q(value, unit, 'estimated', ROUND_VALUE);

/**
 * Where a mission can go. Orbit defaults and limits are design ranges for the game.
 * Distances to the Moon and Mars are measured extremes; for Earth orbits the
 * distance to the ground station is computed from the chosen altitude (Phase 2).
 */
export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'leo',
    name: L('Low Earth orbit', "Past Yer orbitasi"),
    summary: L('A few hundred kilometres up: cheap to reach, but the atmosphere drags and the satellite spends part of every orbit in Earth\'s shadow.', "Bir necha yuz kilometr balandlik: yetish arzon, lekin atmosfera sekinlashtiradi va yo'ldosh har aylanishda Yer soyasida bo'ladi."),
    centralBody: 'earth',
    deliveryTarget: 'leo',
    defaultOrbit: { periapsisAltKm: 500, apoapsisAltKm: 500, inclinationDeg: 51.6 },
    orbitLimits: { altitudeKm: { min: 300, max: 1500 }, inclinationDeg: { min: 0, max: 98 } },
    inclinationRule: 'free',
    cruiseDuration: estimated(0, 'd'),
    operationsCostPerDay: game(8000, 'USD'),
    stationkeepingDvPerYear: estimated(15, 'm/s'),
  },
  {
    id: 'sso',
    name: L('Sun-synchronous orbit', "Quyosh-sinxron orbita"),
    summary: L('A near-polar orbit that crosses each place at the same local time every day, ideal for comparing images.', "Qutbga yaqin orbita: har bir joydan har kuni bir xil mahalliy vaqtda o'tadi, tasvirlarni solishtirish uchun qulay."),
    centralBody: 'earth',
    deliveryTarget: 'sso',
    defaultOrbit: { periapsisAltKm: 600, apoapsisAltKm: 600, inclinationDeg: 97.8 },
    orbitLimits: { altitudeKm: { min: 500, max: 900 }, inclinationDeg: { min: 96.5, max: 99.5 } },
    inclinationRule: 'sun-synchronous',
    cruiseDuration: estimated(0, 'd'),
    operationsCostPerDay: game(8000, 'USD'),
    stationkeepingDvPerYear: estimated(5, 'm/s'),
  },
  {
    id: 'geo',
    name: L('Geostationary orbit', "Geostatsionar orbita"),
    summary: L('36,000 km up the satellite stays above one spot on the equator. Perfect for communications, but far away and hard to reach.', "36 000 km balandlikda yo'ldosh ekvatordagi bir nuqta ustida turadi. Aloqa uchun ideal, lekin uzoq va yetish qiyin."),
    centralBody: 'earth',
    deliveryTarget: 'gto',
    defaultOrbit: { periapsisAltKm: 35_786, apoapsisAltKm: 35_786, inclinationDeg: 0 },
    orbitLimits: { altitudeKm: { min: 35_786, max: 35_786 }, inclinationDeg: { min: 0, max: 0 } },
    inclinationRule: 'equatorial',
    cruiseDuration: estimated(5, 'd'),
    operationsCostPerDay: game(25_000, 'USD'),
    stationkeepingDvPerYear: estimated(50, 'm/s'),
  },
  {
    id: 'moon',
    name: L('Lunar orbit', "Oy orbitasi"),
    summary: L('A polar orbit around the Moon. The radio link to Earth is about a second long and there is no atmosphere to help.', "Oy atrofidagi qutbiy orbita. Yer bilan radio aloqa taxminan bir soniya kechikadi, atmosfera yordam bermaydi."),
    centralBody: 'moon',
    deliveryTarget: 'tli',
    defaultOrbit: { periapsisAltKm: 100, apoapsisAltKm: 100, inclinationDeg: 90 },
    orbitLimits: { altitudeKm: { min: 50, max: 500 }, inclinationDeg: { min: 0, max: 180 } },
    inclinationRule: 'free',
    earthDistance: {
      min: q(356_400, 'km', 'measured', `${FACTSHEET} (Moon): closest approach`),
      max: q(406_700, 'km', 'measured', `${FACTSHEET} (Moon): farthest point`),
    },
    cruiseDuration: q(4, 'd', 'estimated', 'Direct transfer takes about three to five days; the Apollo missions took about three.'),
    operationsCostPerDay: game(60_000, 'USD'),
    stationkeepingDvPerYear: estimated(40, 'm/s'),
  },
  {
    id: 'mars',
    name: L('Mars orbit', "Mars orbitasi"),
    summary: L('A long cruise to another planet. Signals take minutes to reach Earth and the link is very weak.', "Boshqa sayyoraga uzoq yo'l. Signal Yerga daqiqalarda yetib boradi va aloqa juda zaif."),
    centralBody: 'mars',
    deliveryTarget: 'tmi',
    defaultOrbit: { periapsisAltKm: 400, apoapsisAltKm: 400, inclinationDeg: 93 },
    orbitLimits: { altitudeKm: { min: 250, max: 1000 }, inclinationDeg: { min: 0, max: 180 } },
    inclinationRule: 'free',
    earthDistance: {
      min: q(54.6e6, 'km', 'measured', `${FACTSHEET} (Mars): minimum distance from Earth`),
      max: q(401.3e6, 'km', 'measured', `${FACTSHEET} (Mars): maximum distance from Earth`),
    },
    cruiseDuration: q(260, 'd', 'estimated', 'The minimum-energy Earth–Mars transfer takes about 259 days (textbook value).'),
    operationsCostPerDay: game(120_000, 'USD'),
    stationkeepingDvPerYear: estimated(15, 'm/s'),
  },
];
