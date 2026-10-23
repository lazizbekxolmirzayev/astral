import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  RingGeometry,
  SRGBColorSpace,
  RepeatWrapping,
  type BufferGeometry,
} from 'three';
import { fbm3 } from '@/lib/noise';

/**
 * Procedural surfaces. Nothing here is a photograph or a measurement: the
 * patterns only make worlds look different from each other (banded gas giants,
 * blue-green Earth, red Mars). Colors are artistic.
 */
export type TextureLook = {
  mode: 'bands' | 'blobs' | 'granules';
  /** Colors from low to high value of the pattern. */
  palette: readonly string[];
  seed: number;
  /** Frequency of the pattern. */
  scale?: number;
  /** For bands: how strongly noise bends the stripes. */
  turbulence?: number;
  /** For blobs: 0..1 threshold where sea turns to land (palette index split). */
  seaLevel?: number;
  /** Overlay cloud cover 0..1 (white, soft). */
  clouds?: number;
};

const WIDTH = 512;
const HEIGHT = 256;

function paletteColors(palette: readonly string[]): Color[] {
  return palette.map((hex) => new Color(hex));
}

function sample(colors: Color[], t: number): Color {
  const clamped = Math.min(0.9999, Math.max(0, t));
  const scaled = clamped * (colors.length - 1);
  const index = Math.floor(scaled);
  return colors[index]!.clone().lerp(colors[index + 1]!, scaled - index);
}

/** Paints an equirectangular map; sampling on the sphere keeps the left/right edges seamless. */
export function createPlanetTexture(look: TextureLook): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const image = context.createImageData(WIDTH, HEIGHT);
  const colors = paletteColors(look.palette);
  const scale = look.scale ?? 2.5;
  const turbulence = look.turbulence ?? 0.35;
  const seaLevel = look.seaLevel ?? 0.52;

  for (let py = 0; py < HEIGHT; py += 1) {
    const v = py / (HEIGHT - 1);
    const phi = (v - 0.5) * Math.PI;
    for (let px = 0; px < WIDTH; px += 1) {
      const theta = (px / WIDTH) * Math.PI * 2;
      const x = Math.cos(phi) * Math.cos(theta);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.sin(theta);
      let color: Color;
      if (look.mode === 'bands') {
        const warp = (fbm3(x * scale, y * scale * 0.6, z * scale, look.seed, 5) - 0.5) * turbulence;
        const stripe = 0.5 + 0.5 * Math.sin((y + warp) * 14 + fbm3(x * 2, y * 8, z * 2, look.seed + 3) * 3);
        color = sample(colors, stripe);
      } else if (look.mode === 'granules') {
        const n = fbm3(x * scale * 3, y * scale * 3, z * scale * 3, look.seed, 5);
        color = sample(colors, n);
      } else {
        const n = fbm3(x * scale, y * scale, z * scale, look.seed, 6);
        const iceCap = Math.abs(y) > 0.86 ? (Math.abs(y) - 0.86) / 0.14 : 0;
        const t = n < seaLevel ? (n / seaLevel) * 0.45 : 0.5 + ((n - seaLevel) / (1 - seaLevel)) * 0.5;
        color = sample(colors, t);
        if (iceCap > 0) color.lerp(new Color('#f2f6fa'), Math.min(1, iceCap * 1.4));
      }
      if (look.clouds) {
        const c = fbm3(x * 3.2 + 9, y * 3.2, z * 3.2 - 4, look.seed + 99, 5);
        const cover = Math.max(0, (c - (1 - look.clouds)) / look.clouds);
        color.lerp(new Color('#ffffff'), Math.min(0.85, cover * 1.1));
      }
      const i = (py * WIDTH + px) * 4;
      image.data[i] = Math.round(color.r * 255);
      image.data[i + 1] = Math.round(color.g * 255);
      image.data[i + 2] = Math.round(color.b * 255);
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  return texture;
}

/** Soft round glow used for stars, the Sun's halo and galaxy cores. */
export function createGlowTexture(inner = '#ffffff', outer = 'rgba(255,255,255,0)'): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.25, inner.length === 7 ? `${inner}aa` : inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Radial stripes for a ring seen from above; `u` runs inner edge to outer edge. */
export function createRingTexture(base: string, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 4;
  const context = canvas.getContext('2d');
  if (context) {
    const color = new Color(base);
    for (let x = 0; x < 512; x += 1) {
      const u = x / 511;
      const gap = fbm3(u * 24, 0.5, 0.5, seed, 3);
      let alpha = 0.15 + 0.75 * gap;
      if (u > 0.62 && u < 0.67) alpha *= 0.1; // an empty division, like Cassini's
      if (u < 0.08 || u > 0.95) alpha *= 0.4;
      const shade = 0.75 + 0.25 * fbm3(u * 60, 2, 2, seed + 5, 2);
      context.fillStyle = `rgba(${Math.round(color.r * 255 * shade)},${Math.round(color.g * 255 * shade)},${Math.round(color.b * 255 * shade)},${alpha})`;
      context.fillRect(x, 0, 1, 4);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** RingGeometry whose UVs run radially, so `createRingTexture` maps stripe-by-stripe. */
export function createRingGeometry(inner: number, outer: number): BufferGeometry {
  const geometry = new RingGeometry(inner, outer, 128, 1);
  const position = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < position.count; i += 1) {
    const radius = Math.hypot(position.getX(i), position.getY(i));
    uv.setXY(i, (radius - inner) / (outer - inner), 0.5);
  }
  return geometry;
}

export const RING_SIDE = DoubleSide;
export const GLOW_BLENDING = AdditiveBlending;
