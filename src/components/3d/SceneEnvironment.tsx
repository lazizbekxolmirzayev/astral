'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PMREMGenerator } from 'three';
import type { QualityTier } from '@/lib/performance';
import { createSkyProbeTexture } from './proceduralTextures';

/**
 * How much of the scene's ambient light comes from the environment probe.
 *
 * The probe is what lets metal, ice and ocean reflect *something* instead of a
 * flat black void, so a stronger tier also gets a stronger probe. The Sun's
 * point light still does all the direct lighting; this only fills the shadows.
 */
const ENVIRONMENT_INTENSITY: Record<QualityTier, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
  ultra: 1.15,
};

/**
 * An image-based lighting probe built from a procedural sky.
 *
 * Why PMREM: a roughness-blurred cubemap is what `meshStandardMaterial` samples
 * for both reflections and diffuse ambient. Generating it once from a tiny
 * equirectangular canvas costs a few milliseconds at mount and replaces a
 * hand-tuned ambient light that could never vary by viewing angle.
 */
export function SceneEnvironment({ qualityTier }: { qualityTier: QualityTier }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const source = createSkyProbeTexture();
    const pmrem = new PMREMGenerator(gl);
    const probe = pmrem.fromEquirectangular(source);
    pmrem.dispose();
    source.dispose();

    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = probe.texture;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY[qualityTier];

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      probe.dispose();
    };
  }, [gl, scene, qualityTier]);

  return null;
}
