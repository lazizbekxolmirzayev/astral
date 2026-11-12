import { L } from '../i18n';
import type { Launcher, LaunchTarget } from '../models/catalog';
import { q } from '../models/quantity';
import { est, game } from './provenance';

/**
 * Where launchers drop the spacecraft. Orbit targets are reference orbits chosen
 * for the game; C3 targets are typical departure energies:
 * - TLI C3 ≈ −2 km²/s² is the usual trans-lunar value (the Moon is still bound to Earth).
 * - TMI C3 = 10 km²/s² is a representative Earth–Mars opportunity; the minimum-energy
 *   (Hohmann) transfer needs about 8.7 km²/s². It also serves heliocentric missions.
 */
export const LAUNCH_TARGETS: readonly LaunchTarget[] = [
  {
    id: 'leo',
    kind: 'orbit',
    name: L('Low Earth orbit (500 km, 51.6°)', "Past Yer orbitasi (500 km, 51,6°)"),
    centralBody: 'earth',
    periapsisAltKm: 500,
    apoapsisAltKm: 500,
    inclinationDeg: 51.6,
  },
  {
    id: 'sso',
    kind: 'orbit',
    name: L('Sun-synchronous orbit (600 km, 97.8°)', "Quyosh-sinxron orbita (600 km, 97,8°)"),
    centralBody: 'earth',
    periapsisAltKm: 600,
    apoapsisAltKm: 600,
    inclinationDeg: 97.8,
  },
  {
    id: 'gto',
    kind: 'orbit',
    name: L('Geostationary transfer orbit (185 × 35,786 km, 28.5°)', "Geostatsionar o'tish orbitasi (185 × 35 786 km, 28,5°)"),
    centralBody: 'earth',
    periapsisAltKm: 185,
    apoapsisAltKm: 35_786,
    inclinationDeg: 28.5,
  },
  {
    id: 'tli',
    kind: 'escape',
    name: L('Trans-lunar injection (C3 ≈ −2 km²/s²)', "Oyga uchish traektoriyasiga chiqish (C3 ≈ −2 km²/s²)"),
    centralBody: 'earth',
    c3: q(-2, 'km^2/s^2', 'estimated', 'Typical trans-lunar injection energy (cf. Curtis, Orbital Mechanics for Engineering Students)'),
  },
  {
    id: 'tmi',
    kind: 'escape',
    name: L('Interplanetary injection (C3 ≈ 10 km²/s², Earth–Mars class)', "Sayyoralararo traektoriyaga chiqish (C3 ≈ 10 km²/s², Yer–Mars sinfi)"),
    centralBody: 'earth',
    c3: q(10, 'km^2/s^2', 'estimated', 'Representative Earth–Mars opportunity; Hohmann minimum is about 8.7 km²/s² (cf. Curtis; Vallado)'),
  },
];

const RELIABILITY_NOTE =
  'Educational round number; historical success rates of launch vehicle classes fall roughly between 90% and 98%.';

/**
 * Generic launch vehicle classes. Capacities fall as the target gets more energetic
 * (LEO > SSO > GTO > TLI > TMI) the way real vehicles do; they are not those of any
 * specific rocket.
 */
export const LAUNCHERS: readonly Launcher[] = [
  {
    id: 'launcher-small',
    name: L('Small-lift launcher', "Yengil sinf raketasi"),
    summary: L('Cheap rides for CubeSats and small satellites in low Earth orbit.', "Past Yer orbitasidagi CubeSat va kichik yo'ldoshlar uchun arzon uchirish."),
    sizeClass: 'small',
    cost: game(7, 'MUSD'),
    reliability: q(0.92, '1', 'estimated', RELIABILITY_NOTE),
    capacity: { leo: est(300, 'kg'), sso: est(200, 'kg') },
  },
  {
    id: 'launcher-medium',
    name: L('Medium-lift launcher', "O'rta sinf raketasi"),
    summary: L('Reaches the Moon and geostationary transfer with a medium satellite.', "O'rta yo'ldoshni Oygacha va geostatsionar o'tish orbitasigacha yetkazadi."),
    sizeClass: 'medium',
    cost: game(60, 'MUSD'),
    reliability: q(0.96, '1', 'estimated', RELIABILITY_NOTE),
    capacity: { leo: est(7500, 'kg'), sso: est(5000, 'kg'), gto: est(3200, 'kg'), tli: est(2100, 'kg'), tmi: est(1700, 'kg') },
  },
  {
    id: 'launcher-heavy',
    name: L('Heavy-lift launcher', "Og'ir sinf raketasi"),
    summary: L('Carries large geostationary satellites and Mars orbiters.', "Katta geostatsionar yo'ldoshlar va Mars orbital apparatlarini ko'taradi."),
    sizeClass: 'heavy',
    cost: game(120, 'MUSD'),
    reliability: q(0.97, '1', 'estimated', RELIABILITY_NOTE),
    capacity: { leo: est(22000, 'kg'), sso: est(14500, 'kg'), gto: est(8500, 'kg'), tli: est(5600, 'kg'), tmi: est(4600, 'kg') },
  },
  {
    id: 'launcher-super-heavy',
    name: L('Super-heavy launcher', "O'ta og'ir sinf raketasi"),
    summary: L('Enormous capacity at an enormous price, and less flight history.', "Juda katta ko'tarish quvvati va juda yuqori narx; parvoz tarixi kamroq."),
    sizeClass: 'super-heavy',
    cost: game(450, 'MUSD'),
    reliability: q(0.95, '1', 'estimated', RELIABILITY_NOTE),
    capacity: { leo: est(65000, 'kg'), sso: est(40000, 'kg'), gto: est(28000, 'kg'), tli: est(21000, 'kg'), tmi: est(17000, 'kg') },
  },
];
