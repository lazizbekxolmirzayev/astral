import type { CelestialObject } from '@/types/celestial';

/**
 * ## Where this data comes from
 *
 * Every value below is transcribed from the cited NASA page and labelled with
 * its provenance. Nothing here is filled in from memory.
 *
 * `https://nssdc.gsfc.nasa.gov/planetary/factsheet/` was unreachable during the
 * first pass (connection timeout, verified with curl) and became reachable on
 * 2026-10-14. Its "Orbital Eccentricity" row is now transcribed below as
 * `measured`. Table columns are Mercury, Venus, Earth, Moon, Mars, Jupiter,
 * Saturn, Uranus, Neptune, Pluto — the Moon column (0.055) is its geocentric
 * orbit and is excluded.
 *
 * TODO(data): the same fact sheet also carries "Mass (10^24 kg)" and "Mean
 * Temperature (C)" rows. They are reachable now but were not transcribed here
 * because no task needs them yet, so `mass` and `meanTemperature` stay
 * `undefined` for all nine bodies.
 *
 * Three wording caveats kept honest in comments per object:
 * - NASA prose says "average distance from the Sun"; that is stored in
 *   `semiMajorAxis`, which is the same quantity for a Keplerian orbit.
 * - NASA prose says "one rotation every X" / "one day on X takes X", not
 *   "sidereal rotation period"; stored in `rotationPeriod` as printed.
 * - Some pages print a radius, others an equatorial diameter. Where a diameter
 *   is printed, the radius is halved and marked `derived`.
 */

const sources = {
  factSheet: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
  sun: 'https://science.nasa.gov/sun/facts/',
  mercury: 'https://science.nasa.gov/mercury/facts/',
  venus: 'https://science.nasa.gov/venus/venus-facts/',
  earth: 'https://science.nasa.gov/earth/facts/',
  mars: 'https://science.nasa.gov/mars/facts/',
  jupiter: 'https://science.nasa.gov/jupiter/jupiter-facts/',
  saturn: 'https://science.nasa.gov/saturn/facts/',
  uranus: 'https://science.nasa.gov/uranus/facts/',
  neptune: 'https://science.nasa.gov/neptune/neptune-facts/',
} as const;

export const solarSystem: CelestialObject[] = [
  {
    // Source: https://science.nasa.gov/sun/facts/ — "Its diameter is about 865,000
    // miles (1.4 million kilometers)"; "Its spin has a tilt of 7.25 degrees";
    // "Length of day: 25 Earth days at the equator and 36 Earth days at the poles".
    id: 'sun',
    name: 'Sun',
    type: 'star',
    parentId: null,
    // Page prints a diameter of 1.4e6 km; radius = diameter / 2.
    radius: {
      value: 700000,
      unit: 'km',
      provenance: 'derived',
      source: sources.sun,
    },
    // Equatorial value; the same page gives 36 Earth days at the poles.
    rotationPeriod: { value: 25, unit: 'd', provenance: 'measured', source: sources.sun },
    axialTilt: { value: 7.25, unit: 'deg', provenance: 'measured', source: sources.sun },
    description:
      'The star at the centre of the Solar System; it holds 99.8% of the Solar System mass according to its NASA facts page.',
  },
  {
    // Source: https://science.nasa.gov/mercury/facts/ — "With a radius of 1,516
    // miles (2,440 kilometers)"; "average distance of 36 million miles (58 million
    // kilometers)"; "around the Sun every 88 days"; "one rotation every 59 Earth
    // days"; "tilted just 2 degrees".
    id: 'mercury',
    name: 'Mercury',
    type: 'planet',
    parentId: 'sun',
    radius: { value: 2440, unit: 'km', provenance: 'measured', source: sources.mercury },
    semiMajorAxis: {
      value: 58000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.mercury,
    },
    orbitalPeriod: { value: 88, unit: 'd', provenance: 'measured', source: sources.mercury },
    eccentricity: {
      value: 0.206,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 59, unit: 'd', provenance: 'measured', source: sources.mercury },
    axialTilt: { value: 2, unit: 'deg', provenance: 'measured', source: sources.mercury },
    description: 'The innermost planet, printed by NASA as 0.4 AU from the Sun.',
  },
  {
    // Source: https://science.nasa.gov/venus/venus-facts/ — "diameter at its
    // equator is about 7,521 miles (12,104 kilometers)"; "average distance of 67
    // million miles (108 million kilometers)"; "a Venus year ... takes only 225
    // Earth days"; "your day would be 243 Earth days long"; "tilt is only three
    // degrees".
    id: 'venus',
    name: 'Venus',
    type: 'planet',
    parentId: 'sun',
    // Page prints an equatorial diameter of 12104 km; radius = diameter / 2.
    radius: {
      value: 6052,
      unit: 'km',
      provenance: 'derived',
      source: sources.venus,
    },
    semiMajorAxis: {
      value: 108000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.venus,
    },
    orbitalPeriod: { value: 225, unit: 'd', provenance: 'measured', source: sources.venus },
    eccentricity: {
      value: 0.007,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    // Magnitude only. This page does not state the retrograde sense; NASA's
    // Uranus page says Venus is one of the two retrograde rotators.
    rotationPeriod: { value: 243, unit: 'd', provenance: 'measured', source: sources.venus },
    axialTilt: { value: 3, unit: 'deg', provenance: 'measured', source: sources.venus },
    description:
      'Second planet from the Sun. Rotates retrograde per https://science.nasa.gov/uranus/facts/.',
  },
  {
    // Source: https://science.nasa.gov/earth/facts/ — "equatorial diameter of
    // 7,926 miles (12,756 kilometers)"; "average distance of 93 million miles
    // (150 million kilometers)"; "one rotation every 23.9 hours"; "365.25 days to
    // complete one trip around the Sun"; "tilted 23.4 degrees".
    id: 'earth',
    name: 'Earth',
    type: 'planet',
    parentId: 'sun',
    // Page prints an equatorial diameter of 12756 km; radius = diameter / 2.
    radius: {
      value: 6378,
      unit: 'km',
      provenance: 'derived',
      source: sources.earth,
    },
    semiMajorAxis: {
      value: 150000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.earth,
    },
    orbitalPeriod: { value: 365.25, unit: 'd', provenance: 'measured', source: sources.earth },
    eccentricity: {
      value: 0.017,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 23.9, unit: 'h', provenance: 'measured', source: sources.earth },
    axialTilt: { value: 23.4, unit: 'deg', provenance: 'measured', source: sources.earth },
    description: 'Third planet from the Sun, exactly one astronomical unit away per its NASA page.',
  },
  {
    // Source: https://science.nasa.gov/mars/facts/ — "With a radius of 2,106 miles
    // (3,390 kilometers)"; "average distance of 142 million miles (228 million
    // kilometers)"; "687 Earth days"; "one rotation every 24.6 hours"; "tilted 25
    // degrees".
    id: 'mars',
    name: 'Mars',
    type: 'planet',
    parentId: 'sun',
    radius: { value: 3390, unit: 'km', provenance: 'measured', source: sources.mars },
    semiMajorAxis: {
      value: 228000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.mars,
    },
    orbitalPeriod: { value: 687, unit: 'd', provenance: 'measured', source: sources.mars },
    eccentricity: {
      value: 0.094,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 24.6, unit: 'h', provenance: 'measured', source: sources.mars },
    axialTilt: { value: 25, unit: 'deg', provenance: 'measured', source: sources.mars },
    description: 'Fourth planet from the Sun; a Martian year is 669.6 sols, or 687 Earth days.',
  },
  {
    // Source: https://science.nasa.gov/jupiter/jupiter-facts/ — "With a radius of
    // 43,440.7 miles (69,911 kilometers)"; "average distance of 484 million miles
    // (778 million kilometers)"; "One day on Jupiter takes 9.9 hours"; "a complete
    // orbit ... in about 12 Earth years (4,333 Earth days)"; "tilted ... by just
    // 3 degrees".
    id: 'jupiter',
    name: 'Jupiter',
    type: 'planet',
    parentId: 'sun',
    radius: { value: 69911, unit: 'km', provenance: 'measured', source: sources.jupiter },
    semiMajorAxis: {
      value: 778000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.jupiter,
    },
    orbitalPeriod: {
      value: 4333,
      unit: 'd',
      provenance: 'measured',
      source: sources.jupiter,
    },
    eccentricity: {
      value: 0.049,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 9.9, unit: 'h', provenance: 'measured', source: sources.jupiter },
    axialTilt: { value: 3, unit: 'deg', provenance: 'measured', source: sources.jupiter },
    description: 'The largest planet, 5.2 AU from the Sun per its NASA page.',
  },
  {
    // Source: https://science.nasa.gov/saturn/facts/ — "equatorial diameter of
    // about 74,897 miles (120,500 kilometers)"; "average distance of 886 million
    // miles (1.4 billion kilometers)"; "One day on Saturn takes only 10.7 hours";
    // "about 29.4 Earth years (10,756 Earth days)"; "axis is tilted by 26.73
    // degrees".
    id: 'saturn',
    name: 'Saturn',
    type: 'planet',
    parentId: 'sun',
    // Page prints an equatorial diameter of 120500 km; radius = diameter / 2.
    radius: {
      value: 60250,
      unit: 'km',
      provenance: 'derived',
      source: sources.saturn,
    },
    semiMajorAxis: {
      value: 1400000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.saturn,
    },
    orbitalPeriod: { value: 10756, unit: 'd', provenance: 'measured', source: sources.saturn },
    eccentricity: {
      value: 0.052,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 10.7, unit: 'h', provenance: 'measured', source: sources.saturn },
    axialTilt: { value: 26.73, unit: 'deg', provenance: 'measured', source: sources.saturn },
    description: 'Sixth planet from the Sun, 9.5 AU away per its NASA page.',
  },
  {
    // Source: https://science.nasa.gov/uranus/facts/ — "equatorial diameter of
    // 31,763 miles (51,118 kilometers)"; "average distance of 1.8 billion miles
    // (2.9 billion kilometers)"; "One day on Uranus takes about 17 hours"; "about
    // 84 Earth years (30,687 Earth days)"; "a tilt of 97.77 degrees"; the same
    // page states Uranus rotates in the opposite direction to most planets.
    id: 'uranus',
    name: 'Uranus',
    type: 'planet',
    parentId: 'sun',
    // Page prints an equatorial diameter of 51118 km; radius = diameter / 2.
    radius: {
      value: 25559,
      unit: 'km',
      provenance: 'derived',
      source: sources.uranus,
    },
    semiMajorAxis: {
      value: 2900000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.uranus,
    },
    orbitalPeriod: { value: 30687, unit: 'd', provenance: 'measured', source: sources.uranus },
    eccentricity: {
      value: 0.047,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    // Magnitude only; the retrograde sense is stated in prose on the same page.
    rotationPeriod: { value: 17, unit: 'h', provenance: 'measured', source: sources.uranus },
    axialTilt: { value: 97.77, unit: 'deg', provenance: 'measured', source: sources.uranus },
    description:
      'Seventh planet from the Sun. Its 97.77 degree tilt means it rolls around the Sun on its side.',
  },
  {
    // Source: https://science.nasa.gov/neptune/neptune-facts/ — "equatorial
    // diameter of 30,775 miles (49,528 kilometers)"; "average distance of 2.8
    // billion miles (4.5 billion kilometers)"; "One day on Neptune takes about 16
    // hours"; "about 165 Earth years (60,190 Earth days)"; "tilted 28 degrees".
    id: 'neptune',
    name: 'Neptune',
    type: 'planet',
    parentId: 'sun',
    // Page prints an equatorial diameter of 49528 km; radius = diameter / 2.
    radius: {
      value: 24764,
      unit: 'km',
      provenance: 'derived',
      source: sources.neptune,
    },
    semiMajorAxis: {
      value: 4500000000,
      unit: 'km',
      provenance: 'measured',
      source: sources.neptune,
    },
    orbitalPeriod: { value: 60190, unit: 'd', provenance: 'measured', source: sources.neptune },
    eccentricity: {
      value: 0.010,
      unit: 'dimensionless',
      provenance: 'measured',
      source: sources.factSheet,
    },
    rotationPeriod: { value: 16, unit: 'h', provenance: 'measured', source: sources.neptune },
    axialTilt: { value: 28, unit: 'deg', provenance: 'measured', source: sources.neptune },
    description: 'The outermost planet, about 30 AU from the Sun per its NASA page.',
  },
];

export const sun = solarSystem.find((object) => object.id === 'sun');
export const planets = solarSystem.filter((object) => object.type === 'planet');
