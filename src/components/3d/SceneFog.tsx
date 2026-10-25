'use client';

import { useEffect, useMemo } from 'react';
import { FogExp2 } from 'three';
import { useThree } from '@react-three/fiber';

/**
 * UE5-style exponential distance fog. Density is tuned per scale so the galaxy
 * view keeps its depth while the system view stays crisp close to the Sun.
 *
 * PROVENANCE: artistic — the colour and density are chosen for readability,
 * not measured.
 */
export function SceneFog({ scale }: { scale: 'system' | 'galaxy' | 'universe' }) {
  const { scene } = useThree();
  const settings = useMemo(() => {
    if (scale === 'galaxy') return { color: '#10142a', density: 0.00045 };
    if (scale === 'universe') return { color: '#0a0d22', density: 0.00018 };
    return { color: '#0c0f24', density: 0.00028 };
  }, [scale]);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = new FogExp2(settings.color, settings.density);
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, settings]);

  return null;
}
