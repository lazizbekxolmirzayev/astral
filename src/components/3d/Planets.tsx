'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { simulation } from '@/lib/simulation';
import { CelestialBody } from './CelestialBody';
import { PlanetaryMoons } from './PlanetaryMoons';
import { planets, projectToScene } from './layout';
import { useFutureStore } from '@/stores/futureStore';

/** Engine index per drawn planet, resolved once. */
const indices = planets.map((planet) => simulation.indexFor(planet.id));

/** Scene position of one body, read straight from the integrated state. */
export function scenePositionOf(index: number): [number, number, number] {
  const { positions } = simulation.state;
  return projectToScene([
    positions[index * 3] as number,
    positions[index * 3 + 1] as number,
    positions[index * 3 + 2] as number,
  ]);
}

/**
 * The eight planets, placed from the n-body simulation.
 *
 * Positions are written straight onto mesh refs inside `useFrame`, so no React
 * state changes and no re-render per frame. `scenePositionOf` is exported for
 * the reset path, which needs a body's start position without a render.
 *
 * `bodyNames` (id → localized label) is passed from outside the Canvas because
 * the R3F reconciler does not inherit the next-intl context.
 */
export function Planets({ bodyNames, atmosphereHaze = true }: { bodyNames: Record<string, string>; atmosphereHaze?: boolean }) {
  const futureYears = useFutureStore((state) => state.yearsFromNow);
  const meshRefs = useRef<Array<Mesh | null>>([]);

  // Stable callback identities, so a hover re-render never detaches a mesh ref.
  const registrars = useMemo(
    () =>
      planets.map(
        (_planet, index) =>
          (mesh: Mesh | null) => {
            meshRefs.current[index] = mesh;
          },
      ),
    [],
  );

  useFrame(() => {
    for (let i = 0; i < indices.length; i += 1) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      mesh.position.set(...scenePositionOf(indices[i] as number));
    }
  });

  return (
    <group>
      {planets.map((planet, index) => {
        // Illustrative red-giant scenario only; Earth's engulfment is uncertain.
        if (planet.id === 'earth' && futureYears >= 7_500_000_000) return null;
        const start = scenePositionOf(indices[index] as number);
        return (
          <group key={planet.id}>
          <CelestialBody
            id={planet.id}
            label={bodyNames[planet.id] ?? planet.name}
            color={planet.color}
            radius={planet.radius}
            look={planet.look}
            atmosphere={planet.atmosphere}
            atmosphereHaze={atmosphereHaze}
            cloudCover={planet.cloudCover}
            nightLights={planet.nightLights}
            ring={planet.ring}
            spin={planet.spin}
            labelGap={planet.radius * 0.5 + 0.25}
            position={start}
            registerMesh={registrars[index]!}
          />
          {planet.id in MOON_SYSTEM_IDS ? <PlanetaryMoons planetId={planet.id as keyof typeof MOON_SYSTEM_IDS} /> : null}
          </group>
        );
      })}
    </group>
  );
}

const MOON_SYSTEM_IDS = { earth: true, jupiter: true, saturn: true, uranus: true, neptune: true } as const;
