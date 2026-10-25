import { Color, MeshStandardMaterial, type Texture } from 'three';
import type { PlanetSurface } from './proceduralTextures';

/**
 * Materials for lit bodies.
 *
 * A `MeshStandardMaterial` plus the environment probe already does most of the
 * work; the one hand-written hook here is the night side of a world. Emissive
 * maps in three light the whole sphere, so city lights would glow through the
 * daylight. The patch multiplies emissive by how far a fragment is from the
 * Sun, which is exactly the terminator behaviour that makes a planet look real.
 */
export type BodyMaterialOptions = {
  color: string;
  /** PBR maps; without them the body is a flat coloured sphere. */
  surface: PlanetSurface | null;
  roughness: number;
  metalness: number;
  /** Normal-map relief strength; scaled per body so small worlds stay subtle. */
  normalScale: number;
  /** Warm emissive map shown only on the night side. */
  nightLights?: { map: Texture; intensity: number };
  /** How much of the environment probe reaches this surface. */
  envMapIntensity: number;
  toneMapped?: boolean;
};

/** Live uniform slot filled every frame by the body that owns the material. */
export type SunDirectionUniform = { value: [number, number, number] };

export function createBodyMaterial(options: BodyMaterialOptions): MeshStandardMaterial {
  const sunDirectionView: SunDirectionUniform = { value: [0, 0, 1] };
  const material = new MeshStandardMaterial({
    color: new Color(options.surface ? '#ffffff' : options.color),
    map: options.surface?.map ?? null,
    roughnessMap: options.surface?.roughnessMap ?? null,
    normalMap: options.surface?.normalMap ?? null,
    roughness: options.roughness,
    metalness: options.metalness,
    envMapIntensity: options.envMapIntensity,
    toneMapped: options.toneMapped ?? true,
  });

  if (options.surface) {
    material.normalScale.set(options.normalScale, options.normalScale);
  }

  if (options.nightLights) {
    material.emissive = new Color('#ffd9a0');
    material.emissiveMap = options.nightLights.map;
    material.emissiveIntensity = options.nightLights.intensity;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirectionView = sunDirectionView;
      shader.fragmentShader = `uniform vec3 uSunDirectionView;\n${shader.fragmentShader}`;
      // `normal` is the view-space shading normal, already resolved with the
      // normal map by the time the emissive stage runs.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float sunAlignment = dot(normalize(normal), normalize(uSunDirectionView));
         float nightMask = smoothstep(0.18, -0.18, sunAlignment);
         totalEmissiveRadiance *= nightMask;`,
      );
    };
    material.userData.sunDirectionView = sunDirectionView;
    // A custom shader chunk makes this material unique; never share its program.
    material.customProgramCacheKey = () => 'nexus-night-lights';
  }

  return material;
}

/**
 * The lit cloud deck: a thin shell above the surface.
 *
 * `map` rather than `alphaMap` on purpose — three reads an alpha map's green
 * channel, while our cloud texture carries its coverage in the alpha channel.
 */
export function createCloudMaterial(map: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color('#f4f8ff'),
    map,
    transparent: true,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.6,
  });
}
