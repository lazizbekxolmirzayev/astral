'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Sprite } from 'three';
import { createNebulaTexture, GLOW_BLENDING } from './proceduralTextures';

/**
 * A volumetric nebula: a billboarded sprite whose alpha is the fractal cloud
 * mask, lit by a soft radial gradient so it reads as a gas cloud rather than a
 * decal. The cloud drifts slowly, giving the void motion.
 *
 * PROVENANCE: entirely artistic.
 */
export function NebulaCloud({
  position,
  scale,
  palette,
  seed,
  drift = 0.05,
  opacity = 0.6,
}: {
  position: [number, number, number];
  scale: number;
  palette: readonly string[];
  seed: number;
  drift?: number;
  opacity?: number;
}) {
  const spriteRef = useRef<Sprite>(null);
  const texture = useMemo(() => createNebulaTexture(palette, seed), [palette, seed]);

  useFrame(({ clock }) => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const t = clock.elapsedTime * drift;
    sprite.position.x = position[0] + Math.sin(t) * 2;
    sprite.position.z = position[2] + Math.cos(t * 0.7) * 2.5;
  });

  return (
    <sprite ref={spriteRef} position={position} scale={[scale, scale, 1]} raycast={() => null}>
      <spriteMaterial map={texture} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={opacity} />
    </sprite>
  );
}