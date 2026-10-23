import { describe, expect, it } from 'vitest';
import { buildGalaxyGeometry } from './galaxyBuilder';

describe('buildGalaxyGeometry', () => {
  const base = { radius: 10, count: 2000, seed: 7, coreColor: '#ffe6b0', armColor: '#9db8ff' } as const;
  it.each(['spiral', 'irregular', 'elliptical'] as const)('%s stays finite and inside a sensible box', (kind) => {
    const g = buildGalaxyGeometry({ ...base, kind });
    const pos = g.getAttribute('position').array as Float32Array;
    for (const v of pos) expect(Number.isFinite(v)).toBe(true);
    let max = 0;
    for (let i = 0; i < pos.length; i += 3) max = Math.max(max, Math.hypot(pos[i]!, pos[i + 2]!));
    expect(max).toBeLessThan(10 * 2.2);
  });
  it('is deterministic for a seed', () => {
    const a = buildGalaxyGeometry({ ...base, kind: 'spiral' }).getAttribute('position').array as Float32Array;
    const b = buildGalaxyGeometry({ ...base, kind: 'spiral' }).getAttribute('position').array as Float32Array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
