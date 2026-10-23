'use client';

import { useEffect, useMemo } from 'react';
import { Color } from 'three';
import { galaxyMarkers, MILKY_WAY_RADIUS } from '@/lib/universeLayout';
import { CelestialBody } from './CelestialBody';
import { GalaxyField } from './GalaxyField';
import { createGlowTexture, GLOW_BLENDING } from './proceduralTextures';
import type { GalaxyShape } from './galaxyBuilder';
import type { TextureLook } from './proceduralTextures';

/** A churning surface in the star's own colour, so a close-up is not a flat disc. */
function starLook(hex: string, seed: number): TextureLook {
  const base = new Color(hex);
  return { mode: 'granules', palette: [`#${base.clone().multiplyScalar(0.55).getHexString()}`, hex, `#${base.clone().lerp(new Color('#ffffff'), 0.55).getHexString()}`], seed, scale: 2.6 };
}

const MILKY_WAY: GalaxyShape = {
  kind: 'spiral',
  radius: MILKY_WAY_RADIUS,
  count: 42000,
  seed: 4242,
  arms: 4,
  twist: 4.2,
  thickness: 0.035,
  coreColor: '#ffe3a6',
  armColor: '#8fb0ff',
};

/**
 * The Milky Way, with the Sun and the catalogue's stars and black holes at their
 * real directions and distances (1 unit = 500 ly). The arm pattern is
 * illustrative, not a measured map of the real arms.
 */
export function GalaxyScene({ names }: { names: Record<string, string> }) {
  const markers = useMemo(() => galaxyMarkers(), []);
  const halo = useMemo(() => createGlowTexture('#ffd166', 'rgba(255,170,60,0)'), []);
  useEffect(() => () => halo.dispose(), [halo]);

  return (
    <group>
      <ambientLight intensity={0.5} />
      <GalaxyField shape={MILKY_WAY} size={1.15} coreGlow={0.8} />
      {markers.map((marker) => (
        <group key={marker.id}>
          <CelestialBody
            id={marker.id}
            label={names[marker.id] ?? marker.name}
            color={marker.color}
            radius={marker.radius}
            emissiveIntensity={marker.kind === 'black_hole' ? 0.9 : 1}
            position={marker.position}
            focusRadius={marker.kind === 'black_hole' ? 0.6 : Math.max(marker.radius, 0.006)}
            labelGap={marker.radius * 0.6}
            look={marker.kind === 'black_hole' ? undefined : starLook(marker.color, marker.id.length * 7)}
            spin={marker.kind === 'black_hole' ? 0 : 0.2}
          />
          {marker.kind !== 'black_hole' ? (
            <sprite position={marker.position} scale={[marker.radius * 14, marker.radius * 14, 1]} raycast={() => null}>
              <spriteMaterial map={halo} color={marker.color} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.55} />
            </sprite>
          ) : null}
          {/* Constant on-screen size, so every marker (and "you are here") stays findable from across the galaxy. */}
          <sprite position={marker.position} scale={marker.kind === 'sun' ? [0.07, 0.07, 1] : marker.kind === 'black_hole' ? [0.05, 0.05, 1] : [0.028, 0.028, 1]} raycast={() => null}>
            <spriteMaterial map={halo} color={marker.color} sizeAttenuation={false} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.85} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
