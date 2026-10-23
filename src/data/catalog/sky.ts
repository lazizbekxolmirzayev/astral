/**
 * Sky positions for the catalogue objects that have one, J2000 equatorial
 * coordinates in degrees, rounded to about 0.01-0.1 deg. They give the 3D
 * galaxy and universe views real directions; distances come from the catalogue
 * entry. Typed in by hand like the rest of the starter catalogue.
 */
export type SkyPosition = { raDeg: number; decDeg: number };

export const skyPositions: Readonly<Record<string, SkyPosition>> = {
  'sirius-a': { raDeg: 101.287, decDeg: -16.716 },
  'proxima-centauri': { raDeg: 217.429, decDeg: -62.68 },
  'alpha-centauri-a': { raDeg: 219.902, decDeg: -60.834 },
  vega: { raDeg: 279.234, decDeg: 38.784 },
  betelgeuse: { raDeg: 88.793, decDeg: 7.407 },
  rigel: { raDeg: 78.634, decDeg: -8.202 },
  polaris: { raDeg: 37.955, decDeg: 89.264 },
  arcturus: { raDeg: 213.915, decDeg: 19.182 },
  antares: { raDeg: 247.352, decDeg: -26.432 },
  'trappist-1': { raDeg: 346.622, decDeg: -5.041 },
  '51-pegasi': { raDeg: 344.366, decDeg: 20.769 },
  'sagittarius-a-star': { raDeg: 266.417, decDeg: -29.008 },
  'm87-star': { raDeg: 187.706, decDeg: 12.391 },
  'cygnus-x-1': { raDeg: 299.59, decDeg: 35.202 },
  andromeda: { raDeg: 10.685, decDeg: 41.269 },
  triangulum: { raDeg: 23.462, decDeg: 30.66 },
  lmc: { raDeg: 80.894, decDeg: -69.756 },
  whirlpool: { raDeg: 202.47, decDeg: 47.195 },
  sombrero: { raDeg: 189.998, decDeg: -11.623 },
};
