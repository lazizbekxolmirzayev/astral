'use client';

import { BufferAttribute, BufferGeometry } from 'three';
import { useEffect, useMemo } from 'react';
import { mulberry32, randomUnitVector } from '@/lib/random';
import {
  STAR_COUNT,
  STAR_POINT_SIZE,
  STAR_SHELL_MAX,
  STAR_SHELL_MIN,
} from './layout';

/**
 * `STAR_COUNT` points on a spherical shell around the scene. Positions come
 * from a seeded PRNG, so the sky is identical on every load.
 */
export function Starfield() {
  const geometry = useMemo(() => {
    const random = mulberry32(20261014);
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const [x, y, z] = randomUnitVector(random);
      const radius =
        STAR_SHELL_MIN + random() * (STAR_SHELL_MAX - STAR_SHELL_MIN);
      positions[i * 3] = x * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = z * radius;
    }

    const next = new BufferGeometry();
    next.setAttribute('position', new BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={STAR_POINT_SIZE}
        sizeAttenuation
        color="#ffffff"
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
