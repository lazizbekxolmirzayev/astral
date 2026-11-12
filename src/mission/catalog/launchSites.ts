import { L } from '../i18n';
import type { LaunchSite } from '../models/catalog';
import { q } from '../models/quantity';

/**
 * Launch sites. Provenance of each part of an entry:
 * - latitude / longitude: geographic facts. `measured` where a published launch-pad
 *   coordinate was used; `estimated` where the value is a rounded public figure.
 * - inclination range: `estimated`. Real ranges are set by range-safety rules that
 *   change over time; these are rounded educational corridors, with the lower end
 *   at the site's latitude (a launch cannot reach an inclination below it directly).
 * - which vehicle classes fly from which site: a game rule. The vehicles are generic
 *   classes (see `launch.ts`), not real rockets, so this assignment is fictional.
 */

const PAD_SOURCE = (pad: string) => `Published coordinates of ${pad}`;
const CORRIDOR_SOURCE = 'Rounded educational corridor; the lower bound equals the site latitude, the upper bound follows public range-safety azimuth limits (cf. DLR Raumfahrtmissionen, Spaceports of the World, CSIS).';

export const LAUNCH_SITES: readonly LaunchSite[] = [
  {
    id: 'site-cape-canaveral',
    name: L('Cape Canaveral / Kennedy', 'Keyp-Kanaveral / Kennedi'),
    summary: L('Busy eastern-range site: low and mid-inclination orbits and geostationary transfers, but polar orbits are not possible.', "Sharqiy poligon: past va o'rta og'ishli orbitalar va geostatsionar o'tish; qutbiy orbitalarga uchirib bo'lmaydi."),
    country: L('United States', 'AQSh'),
    latitude: q(28.56, 'deg', 'measured', PAD_SOURCE('Space Launch Complex 40, Cape Canaveral (AIAA Falcon user guide)')),
    longitude: q(-80.58, 'deg', 'measured', PAD_SOURCE('Space Launch Complex 40, Cape Canaveral (AIAA Falcon user guide)')),
    inclinationRange: { min: q(28.5, 'deg', 'estimated', CORRIDOR_SOURCE), max: q(57, 'deg', 'estimated', CORRIDOR_SOURCE) },
    launcherIds: ['launcher-small', 'launcher-medium', 'launcher-heavy', 'launcher-super-heavy'],
    restrictions: [
      L('Eastward launches over the Atlantic only; inclinations above about 57° are blocked by populated land downrange.', "Faqat Atlantika ustidan sharqqa; taxminan 57° dan yuqori og'ish pastdagi aholi punktlari tufayli yopiq."),
      L('Sun-synchronous and polar orbits would need a very large plane change.', "Quyosh-sinxron va qutbiy orbitalar uchun juda katta tekislik o'zgartirish kerak bo'ladi."),
    ],
  },
  {
    id: 'site-vandenberg',
    name: L('Vandenberg', 'Vandenberg'),
    summary: L('Launches southward over the Pacific: the usual site for polar and sun-synchronous orbits.', "Tinch okean ustidan janubga uchiradi: qutbiy va Quyosh-sinxron orbitalar uchun odatiy joy."),
    country: L('United States', 'AQSh'),
    latitude: q(34.63, 'deg', 'measured', PAD_SOURCE('Space Launch Complex 4E, Vandenberg (AIAA Falcon user guide)')),
    longitude: q(-120.61, 'deg', 'measured', PAD_SOURCE('Space Launch Complex 4E, Vandenberg (AIAA Falcon user guide)')),
    inclinationRange: { min: q(70, 'deg', 'estimated', CORRIDOR_SOURCE), max: q(105, 'deg', 'estimated', CORRIDOR_SOURCE) },
    launcherIds: ['launcher-small', 'launcher-medium', 'launcher-heavy'],
    restrictions: [
      L('Only high-inclination orbits (about 70° and up, including retrograde sun-synchronous) can be flown directly.', "Faqat yuqori og'ishli orbitalarga (taxminan 70° dan boshlab, retrograd Quyosh-sinxron ham) to'g'ridan-to'g'ri uchish mumkin."),
      L('Equatorial and geostationary-transfer orbits are impractical from here.', "Bu yerdan ekvatorial va geostatsionar o'tish orbitalari amaliy emas."),
    ],
  },
  {
    id: 'site-kourou',
    name: L('Guiana Space Centre (Kourou)', 'Gviana kosmik markazi (Kuru)'),
    summary: L('Almost on the equator: the best site for geostationary transfers, and it also reaches polar orbits.', "Deyarli ekvatorda: geostatsionar o'tish uchun eng yaxshi joy, qutbiy orbitalarga ham chiqadi."),
    country: L('France / ESA (French Guiana)', 'Fransiya / ESA (Fransuz Gvianasi)'),
    latitude: q(5.2, 'deg', 'measured', 'Published latitude of the Guiana Space Centre (Space Today, Spaceports of the World)'),
    longitude: q(-52.8, 'deg', 'measured', 'Published longitude of the Guiana Space Centre (Space Today, Spaceports of the World)'),
    inclinationRange: { min: q(5.2, 'deg', 'estimated', CORRIDOR_SOURCE), max: q(100.5, 'deg', 'estimated', 'The coast allows launches up to about 100.5° inclination (Space Today, Spaceports of the World).') },
    launcherIds: ['launcher-medium', 'launcher-heavy'],
    restrictions: [
      L('No small-lift or super-heavy vehicles are based here in the game.', "O'yinda bu yerda yengil va o'ta og'ir raketalar yo'q."),
    ],
  },
  {
    id: 'site-baikonur',
    name: L('Baikonur', 'Baykonur'),
    summary: L('A high-latitude continental site, used for medium and heavy vehicles to mid-inclination and sun-synchronous orbits.', "Yuqori kenglikdagi quruqlikdagi joy: o'rta va og'ir raketalar uchun, o'rta og'ish va Quyosh-sinxron orbitalar."),
    country: L('Kazakhstan (leased to Russia)', "Qozog'iston (Rossiyaga ijaraga berilgan)"),
    latitude: q(45.9, 'deg', 'measured', 'Published latitude of the Baikonur Cosmodrome (45.9° N, 63.3° E; Encyclopedia.com, Launch Sites)'),
    longitude: q(63.3, 'deg', 'measured', 'Published longitude of the Baikonur Cosmodrome (45.9° N, 63.3° E; Encyclopedia.com, Launch Sites)'),
    inclinationRange: { min: q(46, 'deg', 'estimated', CORRIDOR_SOURCE), max: q(99, 'deg', 'estimated', CORRIDOR_SOURCE) },
    launcherIds: ['launcher-medium', 'launcher-heavy'],
    restrictions: [
      L('Nothing below about 46° inclination can be flown directly; a geostationary transfer needs a large plane change.', "Taxminan 46° dan past og'ishga to'g'ridan-to'g'ri chiqib bo'lmaydi; geostatsionar o'tish katta tekislik o'zgartirishni talab qiladi."),
      L('Stages fall on land downrange, which limits some launch directions.', "Bosqichlar quruqlikka tushadi, bu ba'zi yo'nalishlarni cheklaydi."),
    ],
  },
  {
    id: 'site-mahia',
    name: L('Mahia Peninsula', 'Mahia yarimoroli'),
    summary: L('A small-launcher site in the southern hemisphere with open ocean in most directions.', "Janubiy yarimsharda yengil raketalar uchun joy; deyarli barcha yo'nalishda ochiq okean."),
    country: L('New Zealand', 'Yangi Zelandiya'),
    latitude: q(-39.26, 'deg', 'estimated', 'Rounded public position of Mahia Peninsula Launch Complex 1 (listed by NASA Launch Services Program); not independently surveyed here.'),
    longitude: q(177.87, 'deg', 'estimated', 'Rounded public position of Mahia Peninsula Launch Complex 1 (listed by NASA Launch Services Program); not independently surveyed here.'),
    inclinationRange: { min: q(39.3, 'deg', 'estimated', CORRIDOR_SOURCE), max: q(98, 'deg', 'estimated', CORRIDOR_SOURCE) },
    launcherIds: ['launcher-small'],
    restrictions: [
      L('Only small-lift vehicles fly from here in the game.', "O'yinda bu yerdan faqat yengil raketalar uchadi."),
    ],
  },
];
