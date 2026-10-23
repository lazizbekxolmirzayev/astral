/**
 * Equatorial (J2000) to galactic coordinates, and the unit vectors the 3D
 * galaxy view needs. Standard IAU galactic frame: the north galactic pole is at
 * RA 192.85948 deg, Dec +27.12825 deg and the galactic centre direction is l = 0.
 */
const NGP_RA = (192.85948 * Math.PI) / 180;
const NGP_DEC = (27.12825 * Math.PI) / 180;
const L_NCP = (122.93192 * Math.PI) / 180;

export function equatorialToGalactic(raDeg: number, decDeg: number): { lDeg: number; bDeg: number } {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const sinB = Math.sin(dec) * Math.sin(NGP_DEC) + Math.cos(dec) * Math.cos(NGP_DEC) * Math.cos(ra - NGP_RA);
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const y = Math.cos(dec) * Math.sin(ra - NGP_RA);
  const x = Math.sin(dec) * Math.cos(NGP_DEC) - Math.cos(dec) * Math.sin(NGP_DEC) * Math.cos(ra - NGP_RA);
  let l = L_NCP - Math.atan2(y, x);
  l = ((l % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { lDeg: (l * 180) / Math.PI, bDeg: (b * 180) / Math.PI };
}

/** Unit vector toward (l, b): X to the galactic centre, Y toward l = 90 deg, Z to the north galactic pole. */
export function galacticUnitVector(lDeg: number, bDeg: number): [number, number, number] {
  const l = (lDeg * Math.PI) / 180;
  const b = (bDeg * Math.PI) / 180;
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
}
