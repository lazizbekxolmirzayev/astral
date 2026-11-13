'use client';

import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three';
import { mulberry32 } from '@/lib/random';
import { planets } from '../3d/layout';
import { BELT_MAX_AU, BELT_MIN_AU } from '../3d/layout';
import { GamePlanet } from './GamePlanet';

/**
 * The rest of the Solar System around a heliocentric flight, so the spacecraft really is "out in the cosmos": the other
 * planets on circles of their real mean distance, the main asteroid belt, and faint orbit lines.
 *
 * PROVENANCE: distances and orbital periods are real mean values (JPL "Keplerian elements for approximate positions",
 * J2000 mean longitude + mean motion); orbits are drawn as circles, so a planet may be a few percent off its true place.
 * Planet sizes are exaggerated to be visible and the surfaces are procedural.
 */
const ELEMENTS: Record<string, { au: number; longitude0: number; degPerDay: number }> = {
  mercury: { au: 0.387, longitude0: 252.25, degPerDay: 4.0923 },
  venus: { au: 0.723, longitude0: 181.98, degPerDay: 1.6021 },
  jupiter: { au: 5.203, longitude0: 34.4, degPerDay: 0.0831 },
  saturn: { au: 9.537, longitude0: 49.94, degPerDay: 0.0335 },
  uranus: { au: 19.19, longitude0: 313.23, degPerDay: 0.0117 },
  neptune: { au: 30.07, longitude0: 304.88, degPerDay: 0.006 },
};
const J2000_MS = Date.UTC(2000, 0, 1, 12);

const ring = (radius: number): [number, number, number][] => Array.from({ length: 129 }, (_, index) => {
  const angle = (index / 128) * Math.PI * 2;
  return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
});

/** `scale` converts AU to scene units; `extent` is the frame's size in AU (planets are drawn relative to it). */
export function Cosmos({ scale, extent, epochMs }: { scale: number; extent: number; epochMs: number }) {
  const days = (epochMs - J2000_MS) / 86_400_000;
  const belt = useMemo(() => {
    const random = mulberry32(4242);
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = BELT_MIN_AU + (BELT_MAX_AU - BELT_MIN_AU) * Math.sqrt(random());
      const angle = random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius * scale;
      positions[index * 3 + 1] = (random() - 0.5) * 0.18 * scale;
      positions[index * 3 + 2] = Math.sin(angle) * radius * scale;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return geometry;
  }, [scale]);
  useEffect(() => () => belt.dispose(), [belt]);
  const beltColor = useMemo(() => new Color('#b9a890'), []);
  return (
    <group>
      <points geometry={belt} frustumCulled={false} raycast={() => null}>
        <pointsMaterial size={0.09} sizeAttenuation color={beltColor} transparent opacity={0.7} depthWrite={false} />
      </points>
      {planets.filter((planet) => ELEMENTS[planet.id]).map((planet) => {
        const element = ELEMENTS[planet.id]!;
        const angle = ((element.longitude0 + element.degPerDay * days) * Math.PI) / 180;
        const radius = element.au * scale;
        const drawn = Math.max(0.1, extent * scale * 0.02 * (planet.radius / 0.66) * 0.8);
        return (
          <group key={planet.id}>
            <Line points={ring(radius)} color="#5b6b85" lineWidth={1} transparent opacity={0.35} raycast={() => null} />
            <GamePlanet radius={drawn} look={planet.look} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} spin={planet.spin * 0.2} atmosphere={planet.atmosphere} />
            {planet.ring ? (
              <mesh position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} rotation={[Math.PI / 2 - planet.ring.tilt, 0, 0]} raycast={() => null}>
                <ringGeometry args={[drawn * planet.ring.inner, drawn * planet.ring.outer, 72]} />
                <meshBasicMaterial color={planet.ring.color} transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
