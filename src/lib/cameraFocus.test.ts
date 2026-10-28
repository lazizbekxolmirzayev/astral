import { describe, expect, it } from 'vitest';
import { focusView, type Point3 } from './cameraFocus';

const distanceBetween = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('focusView', () => {
  it('looks straight at the body', () => {
    const center = { x: 14.5, y: 0, z: -3 };
    const view = focusView(center, 0.66, { x: 0, y: 24, z: 56 });
    expect(view.target).toEqual(center);
  });

  it('frames a body at eight of its radii, clamped to a readable range', () => {
    // Jupiter-sized: 1.9 * 8 = 15.2 scene units.
    expect(distanceBetween(focusView({ x: 0, y: 0, z: 0 }, 1.9, { x: 0, y: 24, z: 56 }).position, { x: 0, y: 0, z: 0 })).toBeCloseTo(15.2, 6);
    // Dust-sized: clamped up to the 5 unit minimum.
    expect(distanceBetween(focusView({ x: 0, y: 0, z: 0 }, 0.1, { x: 0, y: 24, z: 56 }).position, { x: 0, y: 0, z: 0 })).toBeCloseTo(5, 6);
    // Sun-sized: 4.5 * 8 = 36 clamped down to the 26 unit maximum.
    expect(distanceBetween(focusView({ x: 0, y: 0, z: 0 }, 4.5, { x: 0, y: 24, z: 56 }).position, { x: 0, y: 0, z: 0 })).toBeCloseTo(26, 6);
  });

  it('keeps the current viewing direction instead of jumping', () => {
    const center = { x: 25, y: 0, z: 4 };
    const from = { x: 0, y: 24, z: 56 };
    const view = focusView(center, 1.9, from);
    const before = { x: from.x - center.x, y: from.y - center.y, z: from.z - center.z };
    const after = { x: view.position.x - center.x, y: view.position.y - center.y, z: view.position.z - center.z };
    const scale = Math.hypot(before.x, before.y, before.z) / Math.hypot(after.x, after.y, after.z);
    expect(after.x * scale).toBeCloseTo(before.x, 6);
    expect(after.y * scale).toBeCloseTo(before.y, 6);
    expect(after.z * scale).toBeCloseTo(before.z, 6);
  });

  it('stays finite when the camera is already on top of the body', () => {
    const center = { x: 8, y: 0, z: 2 };
    const view = focusView(center, 0.38, center);
    expect(Number.isNaN(view.position.x)).toBe(false);
    expect(distanceBetween(view.position, center)).toBeCloseTo(5, 6);
  });

  it('is stable: reframing from the framed position gives the same view', () => {
    const center = { x: -18, y: 0, z: 6 };
    const once = focusView(center, 0.46, { x: 0, y: 24, z: 56 });
    const twice = focusView(center, 0.46, once.position);
    expect(twice.position.x).toBeCloseTo(once.position.x, 9);
    expect(twice.position.y).toBeCloseTo(once.position.y, 9);
    expect(twice.position.z).toBeCloseTo(once.position.z, 9);
  });
});

describe('focusView minimum elevation', () => {
  it('lifts an edge-on approach to the requested elevation and keeps the distance', () => {
    const view = focusView({ x: 0, y: 0, z: 0 }, 1, { x: 100, y: 0, z: 0 }, undefined, 0.4);
    const d = Math.hypot(view.position.x, view.position.y, view.position.z);
    expect(view.position.y / d).toBeCloseTo(Math.sin(0.4), 6);
    expect(view.position.x).toBeGreaterThan(0);
  });
  it('leaves steeper approaches alone', () => {
    const view = focusView({ x: 0, y: 0, z: 0 }, 1, { x: 0, y: 100, z: 0 }, undefined, 0.4);
    expect(view.position.x).toBeCloseTo(0, 9);
    expect(view.position.y).toBeGreaterThan(0);
  });
});
