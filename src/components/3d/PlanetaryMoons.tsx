'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { simulation } from '@/lib/simulation';
import { projectToScene } from './layout';

type MoonLook = {
  name: string;
  radius: number;
  orbit: number;
  speed: number;
  phase: number;
  color: string;
  inclination: number;
};

/** Decorative moons; these are visual companions and are not in the N-body state. */
const MOON_SYSTEMS: Record<string, readonly MoonLook[]> = {
  earth: [{ name: 'Moon', radius: 0.14, orbit: 1.9, speed: 0.22, phase: 0.8, color: '#b9b8b4', inclination: 0.09 }],
  jupiter: [
    { name: 'Io', radius: 0.1, orbit: 2.55, speed: 0.42, phase: 0.1, color: '#e7bd70', inclination: 0.03 },
    { name: 'Europa', radius: 0.09, orbit: 3.25, speed: 0.31, phase: 2.1, color: '#c9bca5', inclination: 0.05 },
    { name: 'Ganymede', radius: 0.15, orbit: 4.25, speed: 0.23, phase: 3.7, color: '#a89a83', inclination: 0.02 },
    { name: 'Callisto', radius: 0.13, orbit: 5.5, speed: 0.16, phase: 5.2, color: '#85796f', inclination: 0.07 },
  ],
  saturn: [
    { name: 'Enceladus', radius: 0.055, orbit: 2.3, speed: 0.34, phase: 0.4, color: '#e5f1f2', inclination: 0.02 },
    { name: 'Tethys', radius: 0.075, orbit: 2.8, speed: 0.27, phase: 2.6, color: '#c7c9c5', inclination: 0.03 },
    { name: 'Rhea', radius: 0.09, orbit: 3.8, speed: 0.2, phase: 4.4, color: '#b9b8b0', inclination: 0.04 },
    { name: 'Titan', radius: 0.15, orbit: 5.65, speed: 0.13, phase: 1.5, color: '#d19b57', inclination: 0.06 },
  ],
  uranus: [
    { name: 'Titania', radius: 0.09, orbit: 2.1, speed: 0.2, phase: 0.7, color: '#a8a8a2', inclination: 0.08 },
    { name: 'Oberon', radius: 0.08, orbit: 2.7, speed: 0.14, phase: 3.5, color: '#898981', inclination: 0.1 },
  ],
  neptune: [{ name: 'Triton', radius: 0.11, orbit: 2.35, speed: -0.18, phase: 2.3, color: '#c3d1cf', inclination: 0.14 }],
};

export function PlanetaryMoons({ planetId }: { planetId: keyof typeof MOON_SYSTEMS }) {
  const parentIndex = useRef(simulation.indexFor(planetId));
  const groupRef = useRef<Group>(null);
  const moonRefs = useRef<Array<Mesh | null>>([]);
  const moons = MOON_SYSTEMS[planetId];

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const bodyIndex = parentIndex.current * 3;
    const { positions } = simulation.state;
    group.position.set(...projectToScene([
      positions[bodyIndex] as number,
      positions[bodyIndex + 1] as number,
      positions[bodyIndex + 2] as number,
    ]));
    moons.forEach((moon, index) => {
      const mesh = moonRefs.current[index];
      if (!mesh) return;
      const angle = clock.elapsedTime * moon.speed + moon.phase;
      mesh.position.set(
        moon.orbit * Math.cos(angle),
        moon.orbit * Math.sin(angle) * Math.sin(moon.inclination),
        moon.orbit * Math.sin(angle) * Math.cos(moon.inclination),
      );
    });
  });

  return (
    <group ref={groupRef}>
      {moons.map((moon, index) => (
        <group key={moon.name}>
          <mesh
            ref={(mesh) => { moonRefs.current[index] = mesh; }}
            raycast={() => null}
          >
            <sphereGeometry args={[moon.radius, 24, 16]} />
            <meshStandardMaterial color={moon.color} roughness={0.92} metalness={0} />
          </mesh>
          <mesh rotation={[Math.PI / 2 + moon.inclination, 0, 0]} raycast={() => null}>
            <torusGeometry args={[moon.orbit, 0.006, 3, 80]} />
            <meshBasicMaterial color={moon.color} transparent opacity={0.12} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
