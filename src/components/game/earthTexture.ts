import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { fbm3 } from '@/lib/noise';

/**
 * A higher-resolution procedural Earth for the flight views: continents, shallow seas, deserts, forests, mountains and
 * polar ice (1024x512), a separate cloud deck and the city lights of the night side. ARTISTIC: the continents are noise,
 * not the real coastlines, and are labelled nowhere as a map.
 */
export type EarthMaps = { map: CanvasTexture; clouds: CanvasTexture; night: CanvasTexture };

const W = 1024;
const H = 512;
let cache: EarthMaps | null = null;

const mix = (a: number[], b: number[], t: number) => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const DEEP = [8, 36, 88], SEA = [20, 84, 160], SHALLOW = [52, 160, 196], SAND = [206, 190, 140], DRY = [176, 148, 96], GRASS = [88, 138, 62], FOREST = [34, 88, 48], ROCK = [118, 106, 92], SNOW = [244, 248, 252];

function direction(px: number, py: number, width: number, height: number): [number, number, number] {
  const theta = (px / width) * Math.PI * 2;
  const phi = (py / (height - 1) - 0.5) * Math.PI;
  return [Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta)];
}

function texture(canvas: HTMLCanvasElement, color: boolean): CanvasTexture {
  const map = new CanvasTexture(canvas);
  if (color) map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  return map;
}

export function getEarthMaps(): EarthMaps {
  if (cache) return cache;
  const surface = document.createElement('canvas');
  surface.width = W; surface.height = H;
  const sctx = surface.getContext('2d')!;
  const image = sctx.createImageData(W, H);
  const lights = document.createElement('canvas');
  lights.width = W; lights.height = H;
  const lctx = lights.getContext('2d')!;
  const lightImage = lctx.createImageData(W, H);
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const [x, y, z] = direction(px, py, W, H);
      const continent = fbm3(x * 1.7 + 3, y * 1.7, z * 1.7 - 2, 11, 5);
      const ridge = fbm3(x * 6 + 1, y * 6, z * 6 + 4, 29, 4);
      const height = continent * 0.82 + ridge * 0.18;
      const dry = fbm3(x * 2.4 - 7, y * 2.4, z * 2.4 + 9, 53, 3) - Math.abs(y) * 0.45 + 0.2;
      const lat = Math.abs(y);
      let color: number[];
      let land = 0;
      if (height < 0.5) {
        const depth = (0.5 - height) / 0.2;
        color = height > 0.475 ? mix(SHALLOW, SEA, (0.5 - height) / 0.025) : mix(SEA, DEEP, Math.min(1, depth));
      } else if (height < 0.515) { color = mix(SAND, GRASS, (height - 0.5) / 0.015); land = 1; }
      else {
        land = 1;
        const green = dry > 0.42 ? mix(GRASS, FOREST, Math.min(1, (dry - 0.42) * 3)) : mix(DRY, GRASS, Math.max(0, dry / 0.42));
        color = height > 0.66 ? mix(green, ROCK, Math.min(1, (height - 0.66) / 0.08)) : green;
        if (height > 0.74) color = mix(color, SNOW, Math.min(1, (height - 0.74) / 0.05));
      }
      // polar ice
      const ice = Math.min(1, Math.max(0, (lat - (0.8 + ridge * 0.06)) / 0.05));
      if (ice > 0) color = mix(color, SNOW, ice);
      const shade = 0.92 + ridge * 0.16;
      const i = (py * W + px) * 4;
      image.data[i] = Math.min(255, color[0]! * shade);
      image.data[i + 1] = Math.min(255, color[1]! * shade);
      image.data[i + 2] = Math.min(255, color[2]! * shade);
      image.data[i + 3] = 255;
      // night lights: clustered settlements on the green and sandy land, none on ice
      const cluster = fbm3(x * 16 + 5, y * 16, z * 16 - 3, 71, 3);
      const sparkle = fbm3(x * 70, y * 70, z * 70, 97, 2);
      const city = land * (1 - ice) * Math.max(0, cluster - 0.5) * 2.4 * Math.max(0, sparkle - 0.4) * 2.2 * (dry > 0.25 ? 1 : 0.3);
      const light = Math.min(255, city * 600);
      lightImage.data[i] = light; lightImage.data[i + 1] = light * 0.8; lightImage.data[i + 2] = light * 0.45; lightImage.data[i + 3] = 255;
    }
  }
  sctx.putImageData(image, 0, 0);
  lctx.putImageData(lightImage, 0, 0);

  const cw = 1024, ch = 512;
  const cloud = document.createElement('canvas');
  cloud.width = cw; cloud.height = ch;
  const cctx = cloud.getContext('2d')!;
  const cimage = cctx.createImageData(cw, ch);
  for (let py = 0; py < ch; py += 1) {
    for (let px = 0; px < cw; px += 1) {
      const [x, y, z] = direction(px, py, cw, ch);
      const bands = fbm3(x * 2.2 + 8, y * 5 + 2, z * 2.2, 131, 5);
      const wisps = fbm3(x * 7, y * 7 + 3, z * 7 - 5, 151, 4);
      const density = Math.min(1, Math.max(0, (bands * 0.7 + wisps * 0.3 - 0.46) / 0.2));
      const i = (py * cw + px) * 4;
      cimage.data[i] = 255; cimage.data[i + 1] = 255; cimage.data[i + 2] = 255; cimage.data[i + 3] = density * 235;
    }
  }
  cctx.putImageData(cimage, 0, 0);
  cache = { map: texture(surface, true), clouds: texture(cloud, true), night: texture(lights, true) };
  return cache;
}
