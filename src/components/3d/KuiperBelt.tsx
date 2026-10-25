'use client';

import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, PointsMaterial } from 'three';
import { mulberry32 } from '@/lib/random';
import type { QualityTier } from '@/lib/performance';
import { sceneRadiusFor } from './layout';

const COUNT_BY_TIER: Record<QualityTier, number> = { low: 500, medium: 1100, high: 1900, ultra: 2800 };

/** A dim, illustrative Kuiper belt beyond Neptune; these particles are not individually integrated. */
export function KuiperBelt({ qualityTier }: { qualityTier: QualityTier }) {
  const geometry = useMemo(() => {
    const count = COUNT_BY_TIER[qualityTier];
    const random = mulberry32(7142026);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const distanceAu = 30 + random() * 20;
      const radius = sceneRadiusFor(distanceAu);
      const angle = random() * Math.PI * 2;
      const inclination = (random() + random() - 1) * 0.035;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(inclination) * radius;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(positions, 3));
    return result;
  }, [qualityTier]);

  const material = useMemo(() => new PointsMaterial({
    color: '#b9a88f',
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
