'use client';

import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { SUN_GM_AU3_PER_DAY2, initialConditions } from '@/data/initialConditions';
import { osculatingElements, spatialOrbitPath } from '@/physics/orbits';
import { ORBIT_SEGMENTS, planets, projectToScene } from './layout';

/**
 * One outline per planet: the osculating Kepler ellipse of its real JPL state
 * vector at the epoch — the two-body path it would follow if only the Sun
 * pulled at it.
 *
 * Because it is derived from the same numbers the simulation starts from, the
 * integrated planets stay on their lines; the small wobble you can see at
 * Jupiter and Saturn is the real n-body perturbation, not drift.
 *
 * Built once at mount and never touched per frame. A body that is unbound has
 * no ellipse, so no line is drawn for it.
 */
export function OrbitLines() {
  const orbits = useMemo(() => {
    const [sun, ...rest] = initialConditions;
    const byId = new Map(rest.map((body, index) => [body.id, index + 1]));
    return planets
      .map((planet) => {
        const body = initialConditions[byId.get(planet.id) ?? -1];
        if (!body || !sun) return null;
        const elements = osculatingElements(body.position, body.velocity, SUN_GM_AU3_PER_DAY2);
        if (!elements) return null;
        return {
          id: planet.id,
          color: planet.color,
          points: spatialOrbitPath(elements, ORBIT_SEGMENTS).map(projectToScene),
        };
      })
      .filter((orbit): orbit is { id: string; color: string; points: [number, number, number][] } => orbit !== null);
  }, []);

  return (
    <group>
      {orbits.map((orbit) => (
        <Line
          key={orbit.id}
          points={orbit.points}
          color={orbit.color}
          transparent
          opacity={0.32}
          lineWidth={1}
        />
      ))}
    </group>
  );
}
