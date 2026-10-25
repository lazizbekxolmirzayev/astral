import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  NoColorSpace,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
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

// 384×192 keeps the surface detail crisp at normal viewing distances while
// reducing first-open texture painting work by more than forty percent.
const WIDTH = 384;
const HEIGHT = 192;

function paletteColors(palette: readonly string[]): Color[] {
  return palette.map((hex) => new Color(hex));
}

function sample(colors: Color[], t: number): Color {
  const clamped = Math.min(0.9999, Math.max(0, t));
  const scaled = clamped * (colors.length - 1);
  const index = Math.floor(scaled);
  return colors[index]!.clone().lerp(colors[index + 1]!, scaled - index);
}

/**
 * One full paint of a surface: colour plus the two maps lighting needs to stop
 * worlds looking like flat stickers — `height` (relief, later turned into a
 * normal map) and `roughness` (how sharp a reflection is; oceans mirror, deserts
 * do not).
 */
type SurfacePaint = {
  albedo: Uint8ClampedArray;
  height: Float32Array;
  roughness: Float32Array;
  /** 1 open water, 0 land — drives the ocean mask and night lights. */
  water: Float32Array;
};

/** Paints one equirectangular set of maps. Sampling on the sphere keeps the left/right edges seamless. */
function paintSurface(look: TextureLook): SurfacePaint {
  const albedo = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const height = new Float32Array(WIDTH * HEIGHT);
  const roughness = new Float32Array(WIDTH * HEIGHT);
  const water = new Float32Array(WIDTH * HEIGHT);
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
      const pixel = py * WIDTH + px;
      const detail = fbm3(x * scale * 7 + 12, y * scale * 7 - 5, z * scale * 7 + 3, look.seed + 211, 3);
      let color: Color;
      let elevation: number;
      let glossy: number;
      let ocean = 0;

      if (look.mode === 'bands') {
        const warp = (fbm3(x * scale, y * scale * 0.6, z * scale, look.seed, 5) - 0.5) * turbulence;
        const stripe =
          0.5 +
          0.5 * Math.sin((y + warp + (detail - 0.5) * 0.035) * 14 + fbm3(x * 2, y * 8, z * 2, look.seed + 3) * 3);
        color = sample(colors, stripe);
        // Gas giant bands are nearly flat but have storm relief, and their ices
        // are cloudy rather than mirror-smooth.
        elevation = stripe * 0.35 + detail * 0.25;
        glossy = 0.42 + stripe * 0.26;
      } else if (look.mode === 'granules') {
        const n = fbm3(x * scale * 3, y * scale * 3, z * scale * 3, look.seed, 5);
        color = sample(colors, n * 0.82 + detail * 0.18);
        elevation = n;
        glossy = 0.9;
      } else {
        const n = fbm3(x * scale, y * scale, z * scale, look.seed, 6) * 0.9 + detail * 0.1;
        const iceCap = Math.abs(y) > 0.86 ? (Math.abs(y) - 0.86) / 0.14 : 0;
        const isOcean = n < seaLevel;
        const t = isOcean ? (n / seaLevel) * 0.45 : 0.5 + ((n - seaLevel) / (1 - seaLevel)) * 0.5;
        color = sample(colors, t);
        if (iceCap > 0) color.lerp(new Color('#f2f6fa'), Math.min(1, iceCap * 1.4));
        ocean = isOcean ? 1 : 0;
        // Sea is level; land rises with the noise. Ice sheets sit on top of both.
        elevation = isOcean ? 0.3 : 0.4 + (n - seaLevel) * 1.6;
        glossy = isOcean ? 0.16 : 0.86 - Math.min(0.25, (n - seaLevel) * 0.6);
        if (iceCap > 0) glossy = glossy * (1 - iceCap) + 0.34 * iceCap;
      }

      if (look.clouds) {
        const c = fbm3(x * 3.2 + 9, y * 3.2, z * 3.2 - 4, look.seed + 99, 5);
        const cover = Math.max(0, (c - (1 - look.clouds)) / look.clouds);
        const strength = Math.min(0.85, cover * 1.1);
        color.lerp(new Color('#ffffff'), strength);
        // Cloud tops are high and matte.
        elevation = elevation * (1 - strength) + 0.62 * strength;
        glossy = glossy * (1 - strength) + 0.8 * strength;
      }

      const i = pixel * 4;
      albedo[i] = Math.round(color.r * 255);
      albedo[i + 1] = Math.round(color.g * 255);
      albedo[i + 2] = Math.round(color.b * 255);
      albedo[i + 3] = 255;
      height[pixel] = elevation;
      roughness[pixel] = glossy;
      water[pixel] = ocean;
    }
  }
  return { albedo, height, roughness, water };
}

/**
 * The same look is painted once per body and shared by the albedo, roughness,
 * normal and night-light maps, so the noise is only sampled once. `WeakMap`
 * keeps the cache from outliving the look it belongs to.
 */
const paintCache = new WeakMap<TextureLook, SurfacePaint>();

function getSurfacePaint(look: TextureLook): SurfacePaint {
  const cached = paintCache.get(look);
  if (cached) return cached;
  const painted = paintSurface(look);
  paintCache.set(look, painted);
  return painted;
}

function textureFromPixels(pixels: Uint8ClampedArray, srgb: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (context) {
    const image = context.createImageData(WIDTH, HEIGHT);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Turns a height field into a tangent-space normal map with central
 * differences. X wraps (the seam of the equirectangular map), Y clamps.
 */
function normalPixelsFromHeight(height: Float32Array, strength: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let py = 0; py < HEIGHT; py += 1) {
    const up = Math.max(0, py - 1) * WIDTH;
    const down = Math.min(HEIGHT - 1, py + 1) * WIDTH;
    const row = py * WIDTH;
    for (let px = 0; px < WIDTH; px += 1) {
      const left = ((px - 1 + WIDTH) % WIDTH);
      const right = ((px + 1) % WIDTH);
      const slopeX = (height[row + right]! - height[row + left]!) * strength;
      const slopeY = (height[down + px]! - height[up + px]!) * strength;
      // n = normalize(-dx, -dy, 1) encoded into 0..1 RGB.
      const nx = -slopeX;
      const ny = -slopeY;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const i = (row + px) * 4;
      pixels[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      pixels[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      pixels[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

/** Alpha-only channel packed into RGB, for the roughness map (read as red). */
function greyscalePixels(values: Float32Array): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < values.length; i += 1) {
    const shade = Math.round(Math.min(1, Math.max(0, values[i]!)) * 255);
    const j = i * 4;
    pixels[j] = shade;
    pixels[j + 1] = shade;
    pixels[j + 2] = shade;
    pixels[j + 3] = 255;
  }
  return pixels;
}

/** Paints an equirectangular map; used for a body's colour channel on its own. */
export function createPlanetTexture(look: TextureLook): CanvasTexture {
  return textureFromPixels(getSurfacePaint(look).albedo, true);
}

export type PlanetSurface = {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
  normalMap: CanvasTexture;
  dispose(): void;
};

/**
 * The full PBR set for a lit body. Colour, roughness and relief all come from
 * one paint pass, so an ocean is simultaneously blue, sharp-reflecting and
 * level — which is what makes a world read as a sphere rather than a decal.
 */
export function createPlanetSurface(look: TextureLook, normalStrength = 2.4): PlanetSurface {
  const paint = getSurfacePaint(look);
  const map = textureFromPixels(paint.albedo, true);
  const roughnessMap = textureFromPixels(greyscalePixels(paint.roughness), false);
  const normalMap = textureFromPixels(normalPixelsFromHeight(paint.height, normalStrength), false);
  return {
    map,
    roughnessMap,
    normalMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      normalMap.dispose();
    },
  };
}

/**
 * Warm pinpricks on the land side only: the night-lights emissive map. Kept in
 * its own pass because it must follow the same noise as the continents, or the
 * "cities" would float on the Pacific.
 */
export function createNightLightsTexture(look: TextureLook): CanvasTexture {
  const paint = getSurfacePaint(look);
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let py = 0; py < HEIGHT; py += 1) {
    const v = py / (HEIGHT - 1);
    const phi = (v - 0.5) * Math.PI;
    for (let px = 0; px < WIDTH; px += 1) {
      const theta = (px / WIDTH) * Math.PI * 2;
      const x = Math.cos(phi) * Math.cos(theta);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.sin(theta);
      const pixel = py * WIDTH + px;
      const i = pixel * 4;
      const land = 1 - paint.water[pixel]!;
      // Clustered, not uniform: settlement follows coastlines and clumps.
      const cluster = fbm3(x * 22 + 5, y * 22 - 3, z * 22 + 8, look.seed + 611, 3);
      const sparkle = fbm3(x * 90, y * 90, z * 90, look.seed + 977, 2);
      const density = Math.max(0, cluster - 0.52) * 2.1 * land * Math.max(0, sparkle - 0.35) * 1.7;
      const value = Math.min(1, density * 2.2) * (1 - Math.min(1, Math.abs(y) / 0.85) ** 2);
      pixels[i] = Math.round(255 * value);
      pixels[i + 1] = Math.round(198 * value);
      pixels[i + 2] = Math.round(126 * value);
      pixels[i + 3] = 255;
    }
  }
  return textureFromPixels(pixels, true);
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

/** A stretched streak: the anamorphic flare a bright star leaves on a lens. */
export function createStreakTexture(): CanvasTexture {
  const width = 256;
  const height = 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(140,190,255,0)');
    gradient.addColorStop(0.42, 'rgba(190,220,255,0.5)');
    gradient.addColorStop(0.5, 'rgba(255,252,240,1)');
    gradient.addColorStop(0.58, 'rgba(190,220,255,0.5)');
    gradient.addColorStop(1, 'rgba(140,190,255,0)');
    context.fillStyle = gradient;
    for (let y = 0; y < height; y += 1) {
      const falloff = 1 - Math.abs(y - height / 2) / (height / 2);
      context.globalAlpha = falloff ** 2.2;
      context.fillRect(0, y, width, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Separate cloud deck: white where the noise says so, transparent elsewhere. */
export function createCloudTexture(seed: number, cover: number, size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  const w = canvas.width;
  const h = canvas.height;
  for (let py = 0; py < h; py += 1) {
    const phi = (py / (h - 1) - 0.5) * Math.PI;
    for (let px = 0; px < w; px += 1) {
      const theta = (px / w) * Math.PI * 2;
      const x = Math.cos(phi) * Math.cos(theta);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.sin(theta);
      // Two scales: broad weather systems plus fibrous detail between them.
      const mass = fbm3(x * 2.6 + 9, y * 2.6, z * 2.6 - 4, seed + 99, 5);
      const wisp = fbm3(x * 9, y * 14, z * 9, seed + 173, 4);
      const value = mass * 0.72 + wisp * 0.28;
      const alpha = Math.min(1, Math.max(0, (value - (1 - cover)) / Math.max(0.08, cover)) * 1.25);
      // Thin out toward the poles so the shell does not cap the planet in white.
      const latitude = 1 - Math.min(1, Math.abs(y) / 0.95) ** 3 * 0.35;
      const i = (py * w + px) * 4;
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(alpha * latitude * 255);
    }
  }
  const image = context.createImageData(w, h);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 4;
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

/**
 * A soft, irregular nebula cloud: layered fractal noise in a few colours, with
 * a bright core. Used behind the planets in the system view and as the Milky
 * Way's inner halo in the galaxy view.
 *
 * PROVENANCE: entirely artistic — no photograph or survey is sampled.
 */
export function createNebulaTexture(
  colors: readonly string[],
  seed: number,
  size = 320,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const image = context.createImageData(size, size);
  const palette = colors.map((hex) => new Color(hex));
  for (let y = 0; y < size; y += 1) {
    const v = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const radial = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      // Soft vignette: bright in the middle, fading to nothing at the edge.
      const envelope = Math.pow(Math.max(0, 1 - radial), 1.6);
      const cloud =
        fbm3(u * 3.2 + 1.7, v * 3.2 - 2.3, angle * 2 + seed, seed + 5, 4) * 0.5 +
        fbm3(u * 8 + 9, v * 8 - 4, angle * 5, seed + 41, 3) * 0.28 +
        fbm3(u * 18, v * 18, angle * 11, seed + 97, 2) * 0.12;
      const value = envelope * (0.35 + cloud * 0.65);
      if (value <= 0) continue;
      const t = Math.min(0.9999, Math.max(0, value));
      const scaled = t * (palette.length - 1);
      const index = Math.floor(scaled);
      const color = palette[index]!.clone().lerp(palette[index + 1]!, scaled - index);
      const i = (y * size + x) * 4;
      image.data[i] = Math.round(color.r * 255);
      image.data[i + 1] = Math.round(color.g * 255);
      image.data[i + 2] = Math.round(color.b * 255);
      image.data[i + 3] = Math.round(value * 255);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A tiny equirectangular "sky" used as the scene's lighting probe: mostly very
 * dark blue, a faint warm direction where the Galaxy's core sits, and a cool
 * band along the galactic plane.
 *
 * This is what gives metal, ice and ocean something to reflect instead of a
 * flat black void — the browser-side stand-in for an infinite-light environment
 * probe. PROVENANCE: colours and intensities are artistic.
 */
export function createSkyProbeTexture(size = 160): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const w = canvas.width;
  const h = canvas.height;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const voidColor = new Color('#05070f');
  const planeColor = new Color('#1b2440');
  const coreColor = new Color('#3a2f3f');
  const rimColor = new Color('#0d1526');

  for (let py = 0; py < h; py += 1) {
    const v = py / (h - 1);
    const phi = (v - 0.5) * Math.PI;
    for (let px = 0; px < w; px += 1) {
      const theta = (px / w) * Math.PI * 2;
      const x = Math.cos(phi) * Math.cos(theta);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.sin(theta);
      // Galactic plane: a band tilted through the sphere, brightest at one side.
      const plane = Math.exp(-((y - x * 0.32) ** 2) * 22);
      const coreGlow = Math.max(0, 1 - Math.hypot(x - 0.72, y - 0.2, z + 0.3) * 1.25) ** 2.4;
      const grain = fbm3(x * 14, y * 14, z * 14, 4242, 3);
      const color = voidColor.clone()
        .lerp(planeColor, plane * 0.5)
        .lerp(coreColor, Math.min(1, coreGlow * 0.8))
        .lerp(rimColor, Math.abs(y) * 0.25);
      color.multiplyScalar(0.82 + grain * 0.5);
      const i = (py * w + px) * 4;
      pixels[i] = Math.round(Math.min(255, color.r * 255));
      pixels[i + 1] = Math.round(Math.min(255, color.g * 255));
      pixels[i + 2] = Math.round(Math.min(255, color.b * 255));
      pixels[i + 3] = 255;
    }
  }
  const image = context.createImageData(w, h);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}
