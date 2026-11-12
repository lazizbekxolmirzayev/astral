/**
 * Deterministic random numbers for the simulation. The same seed and stream name
 * always give the same sequence, on every machine; nothing here reads the clock.
 */

/** FNV-1a hash of a string, 32 bits. Used to derive independent streams from one mission seed. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, well-behaved 32-bit generator. Returns a function that yields numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** An independent stream for one purpose (`launch`, `events`, ...): changing one never shifts another. */
export function streamRng(seed: number, stream: string): () => number {
  return createRng((seed ^ hashString(stream)) >>> 0);
}
