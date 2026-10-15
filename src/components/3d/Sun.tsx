'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { CENTRAL_BODY_INDEX, simulation } from '@/lib/simulation';
import { SUN_RADIUS, projectToScene } from './layout';
import { CelestialBody } from './CelestialBody';

/**
 * Emissive sphere plus the point light it casts, both sitting at the Sun's
 * integrated position. The Sun is a real body in the simulation, so it wobbles
 * as the planets pull on it — that is why the light is parented to the same
 * group instead of staying at the origin.
 *
 * Color and brightness are artistic; the Sun's real values live in `src/data`
 * with a source.
 *
 * `label` is passed in rather than read with `useTranslations` here: this
 * component renders inside the R3F reconciler, which does not inherit the
 * next-intl context from the DOM tree.
 */
export function Sun({ label }: { label: string }) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const { positions } = simulation.state;
    group.position.set(
      ...projectToScene([
        positions[CENTRAL_BODY_INDEX * 3] as number,
        positions[CENTRAL_BODY_INDEX * 3 + 1] as number,
        positions[CENTRAL_BODY_INDEX * 3 + 2] as number,
      ]),
    );
  });

  return (
    <group ref={groupRef}>
      <CelestialBody id="sun" label={label} color="#f5b041" radius={SUN_RADIUS} emissiveIntensity={2.4} />
      <pointLight intensity={1400} distance={0} decay={2} color="#fff4e0" />
    </group>
  );
}
