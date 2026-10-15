/**
 * Deterministic PRNG so the starfield looks identical on every load and
 * matches between server and client renders. Not cryptographically secure.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform point on the unit sphere: [x, y, z], each in [-1, 1]. */
export function randomUnitVector(random: () => number): [number, number, number] {
  const z = random() * 2 - 1;
  const ring = Math.sqrt(1 - z * z);
  const phi = random() * Math.PI * 2;
  return [ring * Math.cos(phi), ring * Math.sin(phi), z];
}
