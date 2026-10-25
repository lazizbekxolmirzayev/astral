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
};

/**
 * Point cloud for one galaxy: bright warm core, bluer arms, scatter between.
 * Layout is illustrative: it shows the kind of galaxy, not a measured map.
 */
export function buildGalaxyGeometry(shape: GalaxyShape): BufferGeometry {
  const random = mulberry32(shape.seed);
  const gaussian = () => (random() + random() + random() + random() - 2) / 2;
  const positions = new Float32Array(shape.count * 3);
  const colors = new Float32Array(shape.count * 3);
  const sizes = new Float32Array(shape.count);
  const phases = new Float32Array(shape.count);
  const core = new Color(shape.coreColor);
  const arm = new Color(shape.armColor);
  const arms = shape.arms ?? 2;
  const twist = shape.twist ?? 3.2;
  const thickness = shape.thickness ?? 0.05;

  for (let i = 0; i < shape.count; i += 1) {
    let x: number;
    let y: number;
    let z: number;
    let t: number; // 0 core .. 1 rim, drives color
    if (shape.kind === 'spiral') {
      const bulge = random() < 0.22;
      if (bulge) {
        const r = Math.abs(gaussian()) * shape.radius * 0.22;
        const a = random() * Math.PI * 2;
        const e = (random() - 0.5) * 0.9;
        x = r * Math.cos(a) * Math.cos(e);
        z = r * Math.sin(a) * Math.cos(e);
        y = r * Math.sin(e) * 0.8;
        t = r / (shape.radius * 0.6);
      } else {
        const cluster = random() < 0.24;
        const r = Math.pow(random(), cluster ? 0.78 : 0.62) * shape.radius;
        const armIndex = Math.floor(random() * arms);
        const base = (armIndex / arms) * Math.PI * 2 + (r / shape.radius) * twist;
        const spread = gaussian() * (cluster ? 0.12 : 0.3 - 0.16 * (r / shape.radius));
        const a = base + spread;
        const clump = cluster ? 0.009 : 0.025;
        x = r * Math.cos(a) + gaussian() * shape.radius * clump;
        z = r * Math.sin(a) + gaussian() * shape.radius * clump;
        y = gaussian() * shape.radius * thickness * (1 - 0.72 * (r / shape.radius));
        t = r / shape.radius;
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
    if (shape.kind === 'spiral' && random() < 0.12) c.lerp(new Color('#9edbff'), 0.45);
    const b = (0.38 + random() * 0.72) * (1.25 - 0.42 * mix);
    colors[i * 3] = c.r * b;
    colors[i * 3 + 1] = c.g * b;
    colors[i * 3 + 2] = c.b * b;
    sizes[i] = 0.45 + Math.pow(random(), 4) * (shape.kind === 'spiral' ? 3.2 : 2.7);
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  return geometry;
}
