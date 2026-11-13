import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { fbm3 } from '@/lib/noise';

/** A seamless patch of country seen from above (sea, coast, fields, hills). Procedural and artistic, not imagery of a real place. */
export function createGroundTexture(size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const lerp = (a: number[], b: number[], t: number) => a.map((value, index) => value + (b[index]! - value) * t);
  const SEA = [22, 70, 128], SHALLOW = [46, 128, 170], SAND = [196, 184, 140], FIELD = [74, 122, 62], FOREST = [38, 84, 50], HILL = [122, 108, 84];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // sampling on a torus keeps the tile seamless
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx = Math.cos(u) * 1.6, ny = Math.sin(u) * 1.6, nz = Math.cos(v) * 1.6, nw = Math.sin(v) * 1.6;
      const height = fbm3(nx + nw * 0.7, ny + nw * 0.3, nz, 7, 5);
      const detail = fbm3(nx * 4 + 9, ny * 4, nz * 4 + nw, 3, 3);
      let color: number[];
      if (height < 0.44) color = lerp(SEA, SHALLOW, Math.max(0, (height - 0.3) / 0.14));
      else if (height < 0.47) color = lerp(SHALLOW, SAND, (height - 0.44) / 0.03);
      else if (height < 0.66) color = lerp(FIELD, FOREST, Math.min(1, detail * 1.4));
      else color = lerp(FOREST, HILL, Math.min(1, (height - 0.66) / 0.14));
      const shade = 0.9 + detail * 0.2;
      const index = (y * size + x) * 4;
      image.data[index] = Math.min(255, color[0]! * shade);
      image.data[index + 1] = Math.min(255, color[1]! * shade);
      image.data[index + 2] = Math.min(255, color[2]! * shade);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = 8;
  return texture;
}
