'use client';

import { useMemo } from 'react';
import { LatheGeometry, Vector2 } from 'three';

export type RocketClass = 'small' | 'medium' | 'heavy' | 'super-heavy';

/** Drawn dimensions in scene units (artistic; the catalog sets capacity and price, not the picture). */
export const ROCKET_LOOKS: Record<RocketClass, { height: number; radius: number; boosters: number; engines: number; tint: string }> = {
  small: { height: 6.5, radius: 0.34, boosters: 0, engines: 1, tint: '#e8edf5' },
  medium: { height: 9.5, radius: 0.5, boosters: 0, engines: 3, tint: '#f2f4f8' },
  heavy: { height: 11.5, radius: 0.55, boosters: 2, engines: 3, tint: '#f6f1e6' },
  'super-heavy': { height: 15.5, radius: 0.95, boosters: 0, engines: 7, tint: '#cfd5de' },
};

const STEEL = '#c9d1dc';
const DARK = '#1b2230';

function Ogive({ radius, height, color }: { radius: number; height: number; color: string }) {
  const geometry = useMemo(() => {
    const points: Vector2[] = [];
    for (let index = 0; index <= 14; index += 1) {
      const t = index / 14;
      points.push(new Vector2(radius * Math.sqrt(Math.max(0, 1 - t ** 1.7)), t * height));
    }
    return new LatheGeometry(points, 32);
  }, [radius, height]);
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.35} />
    </mesh>
  );
}

function Bell({ radius, position }: { radius: number; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, radius * 0.9, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 0.55, radius, radius * 1.8, 20, 1, true]} />
        <meshStandardMaterial color="#3a3f4a" metalness={0.9} roughness={0.35} side={2} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[radius * 0.95, 20]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.0} />
      </mesh>
    </group>
  );
}

/**
 * A stylised launch vehicle for the hangar and the launch scene. The base of the engines is the origin, the
 * nose points up (+y). `glow` brightens the engine bells (set while the engines fire).
 */
export function RocketModel({ rocket, highlight = 0 }: { rocket: RocketClass; highlight?: number }) {
  const look = ROCKET_LOOKS[rocket];
  const { height, radius, boosters, engines, tint } = look;
  const noseHeight = radius * (rocket === 'super-heavy' ? 3.2 : 3.6);
  const body = height - noseHeight;
  const firstStage = body * 0.62;
  const interstage = body * 0.05;
  const secondStage = body - firstStage - interstage;
  const engineRadius = radius * (engines > 3 ? 0.2 : engines > 1 ? 0.3 : 0.5);
  const engineBase = radius * 0.5;
  const emissive = highlight > 0 ? '#00f0ff' : '#000000';
  const mat = { metalness: 0.2, roughness: 0.4, emissive, emissiveIntensity: highlight * 0.06 } as const;

  const enginePositions = useMemo<[number, number, number][]>(() => {
    if (engines === 1) return [[0, 0, 0]];
    const ring = Math.min(radius * 0.58, radius - engineRadius);
    const list: [number, number, number][] = engines === 7 ? [[0, 0, 0]] : [];
    const count = engines === 7 ? 6 : engines;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      list.push([Math.cos(angle) * ring, 0, Math.sin(angle) * ring]);
    }
    return list;
  }, [engines, radius, engineRadius]);

  return (
    <group>
      {/* first stage, with a dark band near the top */}
      <mesh position={[0, engineBase + firstStage / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius, radius * 1.02, firstStage, 36]} />
        <meshStandardMaterial color={tint} {...mat} />
      </mesh>
      <mesh position={[0, engineBase + firstStage * 0.86, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 1.005, radius * 1.005, firstStage * 0.08, 36]} />
        <meshStandardMaterial color={DARK} {...mat} />
      </mesh>
      <mesh position={[0, engineBase + firstStage * 0.18, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 1.025, radius * 1.025, firstStage * 0.02, 36]} />
        <meshStandardMaterial color="#e5602b" {...mat} />
      </mesh>
      {/* interstage and second stage */}
      <mesh position={[0, engineBase + firstStage + interstage / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 0.94, radius, interstage, 36]} />
        <meshStandardMaterial color={DARK} {...mat} />
      </mesh>
      <mesh position={[0, engineBase + firstStage + interstage + secondStage / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 0.94, radius * 0.94, secondStage, 36]} />
        <meshStandardMaterial color={tint} {...mat} />
      </mesh>
      {/* fairing */}
      <group position={[0, engineBase + body, 0]}>
        <Ogive radius={radius * 0.94} height={noseHeight} color={rocket === 'super-heavy' ? STEEL : '#f4f6fa'} />
      </group>
      {/* engines */}
      <mesh position={[0, engineBase / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[radius * 0.97, radius * 0.9, engineBase, 24]} />
        <meshStandardMaterial color="#2a303c" metalness={0.6} roughness={0.5} />
      </mesh>
      {enginePositions.map((position, index) => (
        <Bell key={index} radius={engineRadius} position={position} />
      ))}
      {/* grid fins / legs */}
      {rocket !== 'small'
        ? [0, 1, 2, 3].map((index) => (
            <mesh key={index} position={[Math.cos((index * Math.PI) / 2 + 0.78) * radius * 1.12, engineBase + 0.4, Math.sin((index * Math.PI) / 2 + 0.78) * radius * 1.12]} rotation={[0, -((index * Math.PI) / 2 + 0.78), 0]} raycast={() => null}>
              <boxGeometry args={[radius * 0.5, radius * 1.3, 0.04]} />
              <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
            </mesh>
          ))
        : null}
      {/* strap-on boosters */}
      {Array.from({ length: boosters }, (_, index) => {
        const side = index === 0 ? -1 : 1;
        const boosterRadius = radius * 0.34;
        const boosterHeight = body * 0.55;
        return (
          <group key={index} position={[side * (radius + boosterRadius * 1.02), 0, 0]}>
            <mesh position={[0, engineBase + boosterHeight / 2, 0]} raycast={() => null}>
              <cylinderGeometry args={[boosterRadius, boosterRadius, boosterHeight, 24]} />
              <meshStandardMaterial color={tint} {...mat} />
            </mesh>
            <group position={[0, engineBase + boosterHeight, 0]}>
              <Ogive radius={boosterRadius} height={boosterRadius * 2.6} color="#e5602b" />
            </group>
            <Bell radius={boosterRadius * 0.7} position={[0, 0.02, 0]} />
          </group>
        );
      })}
    </group>
  );
}
