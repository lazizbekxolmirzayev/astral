'use client';

import { useEffect, useMemo } from 'react';
import { createRingGeometry, createRingTexture, GLOW_BLENDING, RING_SIDE } from './proceduralTextures';

/** A hot, tilted accretion disk and dark event horizon for black hole markers. */
export function BlackHoleAccretionDisk({ radius, seed, position = [0, 0, 0] }: {
  radius: number;
  seed: number;
  position?: [number, number, number];
}) {
  const inner = useMemo(() => createRingGeometry(radius * 1.15, radius * 2.9), [radius]);
  const outer = useMemo(() => createRingGeometry(radius * 1.75, radius * 3.8), [radius]);
  const innerMap = useMemo(() => createRingTexture('#ff9b52', seed), [seed]);
  const outerMap = useMemo(() => createRingTexture('#947eff', seed + 29), [seed]);

  useEffect(() => () => {
    inner.dispose();
    outer.dispose();
    innerMap.dispose();
    outerMap.dispose();
  }, [inner, outer, innerMap, outerMap]);

  return (
    <group position={position} rotation={[0.96, 0.18, 0.22]}>
      <mesh geometry={outer} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <meshBasicMaterial map={outerMap} side={RING_SIDE} transparent opacity={0.56} depthWrite={false} blending={GLOW_BLENDING} toneMapped={false} />
      </mesh>
      <mesh geometry={inner} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <meshBasicMaterial map={innerMap} side={RING_SIDE} transparent opacity={0.92} depthWrite={false} blending={GLOW_BLENDING} toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius * 0.8, 32, 24]} />
        <meshBasicMaterial color="#02030a" toneMapped={false} />
      </mesh>
    </group>
  );
}
