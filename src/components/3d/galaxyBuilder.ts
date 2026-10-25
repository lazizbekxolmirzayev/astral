import { BufferAttribute, BufferGeometry, Color } from 'three';
import { mulberry32 } from '@/lib/random';

export type GalaxyShape = {
  kind: 'spiral' | 'irregular' | 'elliptical';
  radius: number;
  /** Number of particles. */
  count: number;
  seed: number;
  arms?: number;
  /** How tightly the arms wind (radians of twist from core to rim). */
  twist?: number;
  thickness?: number;
  coreColor: string;
  armColor: string;
  /** Core bulge radius as a fraction of `radius`. */
  bulgeRadius?: number;
  /** Core brightness multiplier over the arm. */
  coreBrightness?: number;
  /** Dust lanes: darker spiral arcs that absorb light. */
  dust?: number;
};

/**
 * Point cloud for one galaxy: bright warm core, bluer arms, scatter between.
 * Layout is illustrative: it shows the kind of galaxy, not a measured map.
 *
 * Houdini-style: every particle's position, colour and size is derived from a
 * small set of procedural rules (arm pitch, thickness falloff, dust absorption)
 * rather than hand-placed, so a different seed or arm count produces a coherent
 * new galaxy instead of noise.
 */
export function buildGalaxyGeometry(shape: GalaxyShape): BufferGeometry {
  const random = mulberry32(shape.seed);
  const gaussian = () => (random() + random() + random() + random() - 2) / 2;
  const positions = new Float32Array(shape.count * 3);
  const colors = new Float32Array(shape.count * 3);
  const sizes = new Float32Array(shape.count);
  const core = new Color(shape.coreColor);
  const arm = new Color(shape.armColor);
  const arms = shape.arms ?? 2;
  const twist = shape.twist ?? 3.2;
  const thickness = shape.thickness ?? 0.05;
  const bulgeRadius = shape.bulgeRadius ?? 0.22;
  const coreBrightness = shape.coreBrightness ?? 1.6;
  const dust = shape.dust ?? 0.18;

  for (let i = 0; i < shape.count; i += 1) {
    let x: number;
    let y: number;
    let z: number;
    let t: number; // 0 core .. 1 rim, drives color
    let dustFactor = 1;
    if (shape.kind === 'spiral') {
      const inBulge = random() < 0.22;
      if (inBulge) {
        const r = Math.abs(gaussian()) * shape.radius * bulgeRadius;
        const a = random() * Math.PI * 2;
        const e = (random() - 0.5) * 0.9;
        x = r * Math.cos(a) * Math.cos(e);
        z = r * Math.sin(a) * Math.cos(e);
        y = r * Math.sin(e) * 0.8;
        t = r / (shape.radius * bulgeRadius);
      } else {
        const r = Math.pow(random(), 0.65) * shape.radius;
        const armIndex = Math.floor(random() * arms);
        const base = (armIndex / arms) * Math.PI * 2 + (r / shape.radius) * twist;
        const spread = gaussian() * (0.28 - 0.14 * (r / shape.radius));
        const a = base + spread;
        x = r * Math.cos(a) + gaussian() * shape.radius * 0.015;
        z = r * Math.sin(a) + gaussian() * shape.radius * 0.015;
        y = gaussian() * shape.radius * thickness * (1 - 0.6 * (r / shape.radius));
        t = r / shape.radius;
        // Dust lanes: a fraction of arm particles sit in darker arcs.
        if (random() < dust) {
          dustFactor = 0.35 + random() * 0.25;
        }
      }
    } else if (shape.kind === 'elliptical') {
      const r = Math.pow(random(), 1.6) * shape.radius;
      const a = random() * Math.PI * 2;
      const e = Math.acos(2 * random() - 1);
      x = r * Math.sin(e) * Math.cos(a);
      y = r * Math.cos(e) * 0.7;
      z = r * Math.sin(e) * Math.sin(a);
      t = r / shape.radius;
    } else {
      const clump = Math.floor(random() * 6);
      const cr = mulberry32(shape.seed + clump * 7919);
      const cx = (cr() - 0.5) * shape.radius * 1.3;
      const cz = (cr() - 0.5) * shape.radius * 0.9;
      x = cx + gaussian() * shape.radius * 0.35;
      z = cz + gaussian() * shape.radius * 0.35;
      y = gaussian() * shape.radius * 0.08;
      t = 0.55 + random() * 0.3;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const mix = Math.min(1, Math.max(0, t));
    const c = core.clone().lerp(arm, mix);
    const brightness = dustFactor * (0.5 + random() * 0.5) * (1.15 - 0.45 * mix);
    // The core burns brighter than the arms so the centre reads as a galactic nucleus.
    if (mix < bulgeRadius) {
      c.lerp(new Color('#ffffff'), (1 - mix / bulgeRadius) * 0.5);
      colors[i * 3] = c.r * brightness * coreBrightness;
      colors[i * 3 + 1] = c.g * brightness * coreBrightness;
      colors[i * 3 + 2] = c.b * brightness * coreBrightness;
    } else {
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;
    }
    sizes[i] = 0.6 + Math.pow(random(), 5) * 2.4;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  return geometry;
}