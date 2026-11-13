'use client';

import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Group, Sprite } from 'three';
import { mulberry32 } from '@/lib/random';
import { skyLevel } from '@/game/skyLevel';
import { createGlowTexture } from '../3d/proceduralTextures';

/**
 * A layer of cumulus around the first kilometres of the climb. Nothing here is physical: the puffs are what makes the
 * speed readable (they stream past the vehicle) and what makes it look like a sky. They fade out with the daylight.
 */
export function CloudField() {
  const group = useRef<Group>(null);
  const puff = useMemo(() => createGlowTexture('#ffffff', 'rgba(255,255,255,0)'), []);
  useEffect(() => () => puff.dispose(), [puff]);
  const clouds = useMemo(() => {
    const random = mulberry32(2026);
    return Array.from({ length: 38 }, () => {
      const angle = random() * Math.PI * 2;
      const radius = 30 + random() * 260;
      const width = 40 + random() * 90;
      return { x: Math.cos(angle) * radius, y: 22 + random() * 80, z: Math.sin(angle) * radius - 20, width, height: width * (0.22 + random() * 0.14), opacity: 0.16 + random() * 0.26 };
    });
  }, []);
  useFrame(() => {
    if (!group.current) return;
    const level = skyLevel.value;
    group.current.visible = level > 0.05;
    for (const child of group.current.children) {
      const sprite = child as Sprite;
      (sprite.material as { opacity: number }).opacity = (sprite.userData.opacity as number) * Math.min(1, level * 1.4);
    }
  });
  return (
    <group ref={group}>
      {clouds.map((cloud, index) => (
        <sprite key={index} position={[cloud.x, cloud.y, cloud.z]} scale={[cloud.width, cloud.height, 1]} userData={{ opacity: cloud.opacity }} raycast={() => null}>
          <spriteMaterial map={puff} transparent depthWrite={false} opacity={cloud.opacity} color="#ffffff" fog={false} />
        </sprite>
      ))}
    </group>
  );
}

type Vec = [number, number, number];

/** A white trail of exhaust behind the vehicle while it is in the air; it thins out as the air does. */
export function Contrail({ source, active }: { source: RefObject<Group | null>; active: () => boolean }) {
  const line = useRef<{ geometry: { setPositions: (positions: number[]) => void }; material: { opacity: number } } | null>(null);
  const points = useRef<Vec[]>([]);
  const last = useRef<Vec | null>(null);
  useFrame(() => {
    const body = source.current;
    if (!body || !line.current) return;
    if (!active()) { points.current = []; last.current = null; line.current.material.opacity = 0; return; }
    const p: Vec = [body.position.x, body.position.y, body.position.z];
    if (!last.current || Math.hypot(p[0] - last.current[0], p[1] - last.current[1]) > 0.8) {
      last.current = p;
      points.current.push(p);
      if (points.current.length > 160) points.current.shift();
      if (points.current.length >= 2) line.current.geometry.setPositions(points.current.flat());
    }
    line.current.material.opacity = 0.55 * Math.min(1, skyLevel.value * 1.6);
  });
  useEffect(() => () => { points.current = []; }, []);
  return <Line ref={line as never} points={[[0, 0, 0], [0.001, 0, 0]]} color="#f4f7ff" lineWidth={3.2} transparent opacity={0} raycast={() => null} />;
}
