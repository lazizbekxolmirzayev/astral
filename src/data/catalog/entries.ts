import type { CatalogEntry, CatalogQuantity } from './types';

/**
 * Hand-curated starter catalogue.
 *
 * Honesty rules for this file:
 * - Every number is a widely published approximate value typed in by hand, not
 *   fetched from the linked source. So every quantity is `estimated`, and every
 *   record is `curated-unverified`; the UI shows that warning.
 * - Where a value is genuinely uncertain (Betelgeuse's mass, Tunguska's energy)
 *   the `note` says so.
 * - Full datasets (IAU WGSN names, NASA Exoplanet Archive, Meteoritical
 *   Bulletin) replace these records through an import script later; see
 *   `src/data/catalog/README.md`.
 */

const est = (value: number, unit: string, note?: string): CatalogQuantity => ({ value, unit, provenance: 'estimated', ...(note ? { note } : {}) });

const IAU = 'https://www.iau.org/public/themes/naming_stars/';
const EXO = 'https://exoplanetarchive.ipac.caltech.edu/';
const SBDB = 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html';
const MB = 'https://www.lpi.usra.edu/meteor/';
const NED = 'https://ned.ipac.caltech.edu/';
const GEN = 'https://en.wikipedia.org/wiki/Black_hole';

const base = { reviewStatus: 'curated-unverified' as const };
const starBase = { ...base, type: 'star' as const, sourceUrl: IAU, license: 'Facts; no copyright (names: IAU WGSN)' };
const exoBase = { ...base, type: 'exoplanet' as const, sourceUrl: EXO, license: 'NASA public data' };
const smallBase = { ...base, sourceUrl: SBDB, license: 'NASA/JPL public data' };
const galBase = { ...base, type: 'galaxy' as const, sourceUrl: NED, license: 'NASA/IPAC public data' };
const bhBase = { ...base, type: 'black_hole' as const, sourceUrl: GEN, license: 'Facts; no copyright' };
const pulsarBase = { ...base, type: 'pulsar' as const, sourceUrl: 'https://chandra.si.edu/sound/vela.html', license: 'NASA/Chandra public educational media' };
const evBase = { ...base, type: 'meteorite_event' as const, sourceUrl: MB, license: 'Facts; no copyright' };

export const catalogEntries: readonly CatalogEntry[] = [
  // ---- Stars ----
  { ...starBase, id: 'sun', name: 'Sun', aliases: ['Sol', 'Quyosh', 'Солнце'], classification: 'G2V main-sequence star', description: 'The star at the centre of the Solar System.', massSolar: est(1, 'M☉'), radiusSolar: est(1, 'R☉'), temperatureK: est(5772, 'K'), distanceLy: est(0.0000158, 'ly') },
  { ...starBase, id: 'sirius-a', name: 'Sirius A', aliases: ['Sirius', 'Alpha Canis Majoris', 'Sirius yulduzi', 'Сириус'], classification: 'A1V main-sequence star', description: 'Brightest star in the night sky; has a white-dwarf companion, Sirius B.', massSolar: est(2.06, 'M☉'), radiusSolar: est(1.71, 'R☉'), temperatureK: est(9940, 'K'), distanceLy: est(8.6, 'ly') },
  { ...starBase, id: 'proxima-centauri', name: 'Proxima Centauri', aliases: ['Proxima', 'Alpha Centauri C', 'Проксима Центавра'], classification: 'M5.5V red dwarf', description: 'Nearest known star to the Sun.', massSolar: est(0.122, 'M☉'), radiusSolar: est(0.154, 'R☉'), temperatureK: est(3042, 'K'), distanceLy: est(4.24, 'ly') },
  { ...starBase, id: 'alpha-centauri-a', name: 'Alpha Centauri A', aliases: ['Rigil Kentaurus', 'Toliman', 'Alpha Cen A', 'Альфа Центавра'], classification: 'G2V main-sequence star', description: 'Sun-like star in the closest star system.', massSolar: est(1.1, 'M☉'), radiusSolar: est(1.22, 'R☉'), temperatureK: est(5790, 'K'), distanceLy: est(4.37, 'ly') },
  { ...starBase, id: 'vega', name: 'Vega', aliases: ['Alpha Lyrae', 'Вега'], classification: 'A0V main-sequence star', description: 'Bright star in Lyra; a standard reference in photometry.', massSolar: est(2.14, 'M☉'), radiusSolar: est(2.36, 'R☉'), temperatureK: est(9600, 'K'), distanceLy: est(25, 'ly') },
  { ...starBase, id: 'betelgeuse', name: 'Betelgeuse', aliases: ['Alpha Orionis', 'Бетельгейзе'], classification: 'M1-2 red supergiant', description: 'Red supergiant in Orion that will end as a supernova.', massSolar: est(18, 'M☉', 'Published estimates span roughly 10-20 M☉'), radiusSolar: est(760, 'R☉', 'Varies; it is a pulsating star'), temperatureK: est(3600, 'K'), distanceLy: est(550, 'ly', 'Uncertain by tens of ly') },
  { ...starBase, id: 'rigel', name: 'Rigel', aliases: ['Beta Orionis', 'Ригель'], classification: 'B8 blue supergiant', description: 'Blue supergiant in Orion.', massSolar: est(21, 'M☉', 'Uncertain'), radiusSolar: est(79, 'R☉'), temperatureK: est(12100, 'K'), distanceLy: est(860, 'ly') },
  { ...starBase, id: 'polaris', name: 'Polaris', aliases: ['North Star', 'Alpha Ursae Minoris', 'Qutb yulduzi', 'Полярная звезда'], classification: 'F7 supergiant (Cepheid)', description: 'The current northern pole star.', massSolar: est(5.4, 'M☉'), radiusSolar: est(46, 'R☉'), temperatureK: est(6000, 'K'), distanceLy: est(430, 'ly') },
  { ...starBase, id: 'arcturus', name: 'Arcturus', aliases: ['Alpha Bootis', 'Арктур'], classification: 'K1.5 red giant', description: 'Brightest star in the northern celestial hemisphere.', massSolar: est(1.08, 'M☉'), radiusSolar: est(25.4, 'R☉'), temperatureK: est(4286, 'K'), distanceLy: est(36.7, 'ly') },
  { ...starBase, id: 'antares', name: 'Antares', aliases: ['Alpha Scorpii', 'Антарес'], classification: 'M1.5 red supergiant', description: 'Red supergiant, the heart of Scorpius.', massSolar: est(12, 'M☉', 'Uncertain'), radiusSolar: est(680, 'R☉', 'Uncertain'), temperatureK: est(3600, 'K'), distanceLy: est(550, 'ly') },
  { ...starBase, id: 'trappist-1', name: 'TRAPPIST-1', aliases: ['2MASS J23062928-0502285', 'TRAPPIST 1'], classification: 'M8V ultracool dwarf', description: 'Ultracool dwarf hosting seven known rocky planets.', massSolar: est(0.089, 'M☉'), radiusSolar: est(0.121, 'R☉'), temperatureK: est(2566, 'K'), distanceLy: est(40.7, 'ly') },
  { ...starBase, id: '51-pegasi', name: '51 Pegasi', aliases: ['51 Peg', 'Helvetios'], classification: 'G2-4V star', description: 'Sun-like star; first main-sequence star found with an exoplanet.', massSolar: est(1.11, 'M☉'), radiusSolar: est(1.27, 'R☉'), temperatureK: est(5790, 'K'), distanceLy: est(50.9, 'ly') },

  // ---- Black holes ----
  { ...bhBase, id: 'sagittarius-a-star', name: 'Sagittarius A*', aliases: ['Sgr A*', 'Sagittarius A', 'Galaxy centre black hole', 'Sagittarius A yulduz'], classification: 'Supermassive black hole', description: 'The supermassive black hole at the centre of the Milky Way.', massSolar: est(4.3e6, 'M☉'), distanceLy: est(26000, 'ly') },
  { ...bhBase, id: 'm87-star', name: 'M87*', aliases: ['M87 black hole', 'Messier 87 black hole', 'Pōwehi'], classification: 'Supermassive black hole', description: 'First black hole imaged by the Event Horizon Telescope.', massSolar: est(6.5e9, 'M☉'), distanceLy: est(53e6, 'ly') },
  { ...bhBase, id: 'cygnus-x-1', name: 'Cygnus X-1', aliases: ['Cyg X-1', 'Лебедь X-1'], classification: 'Stellar-mass black hole (X-ray binary)', description: 'One of the first strong black-hole candidates, orbiting a blue supergiant.', massSolar: est(21, 'M☉'), distanceLy: est(7200, 'ly') },

  // ---- Pulsars ----
  { ...pulsarBase, id: 'vela-pulsar', name: 'Vela Pulsar', aliases: ['PSR B0833-45', 'PSR J0835-4510', 'Vela pulsari'], classification: 'Young radio pulsar · about 11 pulses/s', description: 'A rapidly rotating neutron star in the Vela supernova remnant. Pulse rate and distance are approximate catalogue values.', distanceLy: est(1000, 'ly'), radiusKm: est(12, 'km'), rotationPeriodMs: est(89, 'ms') },
  { ...pulsarBase, id: 'crab-pulsar', name: 'Crab Pulsar', aliases: ['PSR B0531+21', 'PSR J0534+2200', 'Crab pulsari'], classification: 'Young radio pulsar · about 30 pulses/s', description: 'The neutron star at the centre of the Crab Nebula supernova remnant.', sourceUrl: 'https://chandra.cfa.harvard.edu/sound/crab_chandra_nustar.html', distanceLy: est(6500, 'ly'), radiusKm: est(12, 'km'), rotationPeriodMs: est(33, 'ms') },

  // ---- Exoplanets ----
  { ...exoBase, id: 'proxima-b', name: 'Proxima Centauri b', aliases: ['Proxima b', 'Проксима b'], classification: 'Terrestrial-mass exoplanet', description: 'Planet in the habitable-zone distance of Proxima Centauri.', hostId: 'proxima-centauri', massEarth: est(1.07, 'M⊕', 'Minimum mass (m sin i)'), semiMajorAxisAu: est(0.0485, 'AU'), orbitalPeriodDays: est(11.19, 'd'), distanceLy: est(4.24, 'ly') },
  { ...exoBase, id: '51-pegasi-b', name: '51 Pegasi b', aliases: ['51 Peg b', 'Dimidium'], classification: 'Hot Jupiter', description: 'First exoplanet found around a Sun-like star (1995).', hostId: '51-pegasi', massEarth: est(150, 'M⊕', 'Minimum mass, about 0.47 Jupiter masses'), semiMajorAxisAu: est(0.052, 'AU'), orbitalPeriodDays: est(4.23, 'd'), distanceLy: est(50.9, 'ly') },
  { ...exoBase, id: 'trappist-1e', name: 'TRAPPIST-1 e', aliases: ['TRAPPIST 1e', 'TRAPPIST-1e'], classification: 'Rocky exoplanet', description: 'Rocky planet in the TRAPPIST-1 system, near the habitable zone.', hostId: 'trappist-1', massEarth: est(0.69, 'M⊕'), radiusKm: est(5870, 'km'), semiMajorAxisAu: est(0.0292, 'AU'), orbitalPeriodDays: est(6.1, 'd'), distanceLy: est(40.7, 'ly') },
  { ...exoBase, id: '55-cancri-e', name: '55 Cancri e', aliases: ['55 Cnc e', 'Janssen'], classification: 'Lava super-Earth', description: 'Super-Earth so close to its star that its day side is molten.', massEarth: est(8, 'M⊕'), semiMajorAxisAu: est(0.0154, 'AU'), orbitalPeriodDays: est(0.74, 'd'), distanceLy: est(41, 'ly') },

  // ---- Asteroids and comets ----
  { ...smallBase, type: 'asteroid', id: 'ceres', name: '1 Ceres', aliases: ['Ceres', 'Tseres', 'Церера'], classification: 'Dwarf planet / asteroid', description: 'Largest object in the asteroid belt.', massKg: est(9.38e20, 'kg'), radiusKm: est(473, 'km'), semiMajorAxisAu: est(2.77, 'AU'), eccentricity: est(0.076, ''), orbitalPeriodDays: est(1680, 'd') },
  { ...smallBase, type: 'asteroid', id: 'vesta', name: '4 Vesta', aliases: ['Vesta', 'Веста'], classification: 'Asteroid', description: 'Second most massive object in the asteroid belt.', massKg: est(2.59e20, 'kg'), radiusKm: est(262, 'km'), semiMajorAxisAu: est(2.36, 'AU'), eccentricity: est(0.089, ''), orbitalPeriodDays: est(1325, 'd') },
  { ...smallBase, type: 'asteroid', id: 'apophis', name: '99942 Apophis', aliases: ['Apophis', 'Апофис'], classification: 'Near-Earth asteroid', description: 'Near-Earth asteroid with a close, safe Earth flyby in April 2029.', diameterM: est(340, 'm'), densityKgM3: est(2600, 'kg/m³', 'Assumed typical value'), semiMajorAxisAu: est(0.922, 'AU'), eccentricity: est(0.191, ''), orbitalPeriodDays: est(324, 'd') },
  { ...smallBase, type: 'asteroid', id: 'bennu', name: '101955 Bennu', aliases: ['Bennu', 'Бенну'], classification: 'Near-Earth asteroid', description: 'Carbon-rich asteroid sampled by OSIRIS-REx.', diameterM: est(490, 'm'), densityKgM3: est(1190, 'kg/m³'), semiMajorAxisAu: est(1.126, 'AU'), eccentricity: est(0.204, ''), orbitalPeriodDays: est(436.6, 'd') },
  { ...smallBase, type: 'comet', id: 'halley', name: '1P/Halley', aliases: ['Halley', "Halley's Comet", 'Galley kometasi', 'Комета Галлея'], classification: 'Periodic comet', description: 'Famous periodic comet, returning about every 76 years.', diameterM: est(11000, 'm', 'Irregular nucleus, about 15 x 8 km'), semiMajorAxisAu: est(17.8, 'AU'), eccentricity: est(0.967, ''), orbitalPeriodDays: est(27500, 'd') },

  // ---- Meteorite / impact events ----
  { ...evBase, id: 'chelyabinsk-2013', name: 'Chelyabinsk meteor (2013)', aliases: ['Chelyabinsk', 'Chelyabinsk 2013', 'Челябинский метеорит', 'Chelyabinsk meteoriti'], classification: 'Airburst', description: 'Airburst over Russia on 15 Feb 2013; the shock wave broke windows across the city.', diameterM: est(19, 'm'), massKg: est(1.2e7, 'kg'), impactVelocityKmS: est(19, 'km/s'), energyMegatons: est(0.5, 'Mt TNT', 'About 500 kt') },
  { ...evBase, id: 'tunguska-1908', name: 'Tunguska event (1908)', aliases: ['Tunguska', 'Tunguska 1908', 'Тунгусский метеорит', 'Tunguska portlashi'], classification: 'Airburst', description: 'Airburst over Siberia that flattened about 2,000 km² of forest.', diameterM: est(50, 'm', 'Highly uncertain; about 50-60 m'), impactVelocityKmS: est(15, 'km/s', 'Assumed'), energyMegatons: est(12, 'Mt TNT', 'Published estimates about 3-30 Mt') },
  { ...evBase, id: 'barringer-crater', name: 'Barringer (Meteor) Crater', aliases: ['Meteor Crater', 'Barringer', 'Canyon Diablo'], classification: 'Impact crater', description: 'Arizona crater formed about 50,000 years ago by an iron meteorite.', diameterM: est(50, 'm', 'Impactor size; crater is about 1.2 km wide'), impactVelocityKmS: est(13, 'km/s', 'Assumed'), energyMegatons: est(10, 'Mt TNT', 'Rough') },
  { ...evBase, id: 'chicxulub', name: 'Chicxulub impact', aliases: ['Chicxulub', 'Dinosaur-killer asteroid', 'Chicxulub asteroidi', 'Чиксулуб'], classification: 'Impact crater', description: 'Impact about 66 million years ago linked to the end-Cretaceous mass extinction.', diameterM: est(12000, 'm', 'About 10-15 km'), impactVelocityKmS: est(20, 'km/s', 'Assumed'), energyMegatons: est(1e8, 'Mt TNT', 'Order of magnitude only') },

  // ---- Galaxies ----
  { ...galBase, id: 'milky-way', name: 'Milky Way', aliases: ['Our Galaxy', 'Somon yo‘li', 'Somon yoli', 'Млечный Путь'], classification: 'Barred spiral galaxy', description: 'The galaxy that contains the Solar System.', massSolar: est(1.5e12, 'M☉', 'Including dark matter; uncertain'), distanceLy: est(0, 'ly') },
  { ...galBase, id: 'andromeda', name: 'Andromeda Galaxy', aliases: ['M31', 'Messier 31', 'NGC 224', 'Andromeda', 'Андромеда'], classification: 'Spiral galaxy', description: 'Nearest large galaxy to the Milky Way.', distanceLy: est(2.5e6, 'ly') },
  { ...galBase, id: 'triangulum', name: 'Triangulum Galaxy', aliases: ['M33', 'Messier 33', 'NGC 598'], classification: 'Spiral galaxy', description: 'Third-largest galaxy of the Local Group.', distanceLy: est(2.7e6, 'ly') },
  { ...galBase, id: 'lmc', name: 'Large Magellanic Cloud', aliases: ['LMC', 'Katta Magellan buluti'], classification: 'Irregular galaxy', description: 'Satellite galaxy of the Milky Way.', distanceLy: est(160000, 'ly') },
  { ...galBase, id: 'whirlpool', name: 'Whirlpool Galaxy', aliases: ['M51', 'Messier 51', 'NGC 5194'], classification: 'Interacting grand-design spiral in Canes Venatici.', description: 'A face-on spiral with active star-forming arms, interacting with NGC 5195.', distanceLy: est(31e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/' },
  { ...galBase, id: 'sombrero', name: 'Sombrero Galaxy', aliases: ['M104', 'Messier 104', 'NGC 4594'], classification: 'Spiral galaxy', description: 'Galaxy with a bright nucleus and a prominent dust lane.', distanceLy: est(2.9e7, 'ly') },
  { ...galBase, id: 'm81', name: 'Bode’s Galaxy', aliases: ['M81', 'Messier 81', 'NGC 3031', 'Bode Galaxy'], classification: 'Grand-design spiral galaxy', description: 'A nearby spiral with arms winding into its nucleus; gravitationally interacting with M82.', distanceLy: est(11.6e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-81/' },
  { ...galBase, id: 'm82', name: 'Cigar Galaxy', aliases: ['M82', 'Messier 82', 'NGC 3034'], classification: 'Starburst galaxy', description: 'An edge-on galaxy with intense central star formation and a large gas outflow.', distanceLy: est(12e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-82/' },
  { ...galBase, id: 'pinwheel', name: 'Pinwheel Galaxy', aliases: ['M101', 'Messier 101', 'NGC 5457'], classification: 'Asymmetric grand-design spiral galaxy', description: 'A face-on spiral with prominent arms and widespread star-forming regions.', distanceLy: est(25e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-101/' },
  { ...galBase, id: 'centaurus-a', name: 'Centaurus A', aliases: ['Cen A', 'NGC 5128', 'Caldwell 77'], classification: 'Peculiar elliptical galaxy with a prominent dust lane', description: 'An active galaxy with a dark dust lane, shaped by a past merger.', distanceLy: est(11e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-77/' },
  { ...galBase, id: 'smc', name: 'Small Magellanic Cloud', aliases: ['SMC', 'NGC 292', 'Kichik Magellan buluti'], classification: 'Dwarf irregular galaxy', description: 'A nearby satellite galaxy with active star-forming regions.', distanceLy: est(200000, 'ly'), sourceUrl: 'https://science.nasa.gov/missions/hubble/hubble-captures-a-neighbors-colorful-clouds/' },
  { ...galBase, id: 'm32', name: 'Messier 32', aliases: ['M32', 'NGC 221'], classification: 'Compact elliptical galaxy', description: 'A compact satellite galaxy of Andromeda.', distanceLy: est(2.5e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-32/' },
  { ...galBase, id: 'm110', name: 'Messier 110', aliases: ['M110', 'NGC 205'], classification: 'Dwarf elliptical galaxy', description: 'An elliptical satellite galaxy of Andromeda.', distanceLy: est(2.7e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-110/' },
  { ...galBase, id: 'ngc-5195', name: 'NGC 5195', aliases: ['Messier 51 companion', 'Whirlpool companion'], classification: 'Interacting companion galaxy', description: 'A small companion passing behind the Whirlpool Galaxy and disturbing one of its spiral arms.', distanceLy: est(31e6, 'ly'), sourceUrl: 'https://science.nasa.gov/mission/hubble/m51-hubble-remix/' },
  { ...galBase, id: 'ngc-1300', name: 'NGC 1300', aliases: ['Barred spiral NGC 1300'], classification: 'Barred spiral galaxy', description: 'A well-studied barred spiral with arms extending from the ends of its central bar.', distanceLy: est(69e6, 'ly'), sourceUrl: 'https://science.nasa.gov/asset/hubble/barred-spiral-galaxy-ngc-1300/' },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return catalogEntries.find((entry) => entry.id === id);
}
