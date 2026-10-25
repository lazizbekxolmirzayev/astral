'use client';

import { useEffect, useMemo } from 'react';
import { galaxyMarkers, MILKY_WAY_RADIUS } from '@/lib/universeLayout';
import { CelestialBody } from './CelestialBody';
import { GalaxyField } from './GalaxyField';
import { BlackHoleAccretionDisk } from './BlackHoleAccretionDisk';
import { createGlowTexture, createNebulaTexture, GLOW_BLENDING } from './proceduralTextures';
import type { GalaxyShape } from './galaxyBuilder';

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
  bulgeRadius: 0.2,
  coreBrightness: 2.2,
  dust: 0.22,
};

/** Artistic star-forming regions threaded along the Milky Way's spiral arms. */
const DUST_CLOUDS = Array.from({ length: 18 }, (_, index) => {
  const arm = index % 4;
  const radius = 15 + Math.floor(index / 4) * 17 + (index % 3) * 3.2;
  const angle = arm * (Math.PI / 2) + (radius / MILKY_WAY_RADIUS) * MILKY_WAY.twist! + index * 0.17;
  const scale = 9 + (index % 4) * 3.5;
  return {
    position: [Math.cos(angle) * radius, Math.sin(index * 2.13) * 2.7, Math.sin(angle) * radius] as [number, number, number],
    scale,
    rotation: angle,
    opacity: 0.11 + (index % 4) * 0.025,
    palette: index % 3,
  };
});

const NEBULA_PALETTES = [
  ['rgba(44,22,86,1)', 'rgba(108,45,154,1)', 'rgba(58,128,194,1)', 'rgba(255,194,143,1)'],
  ['rgba(28,42,94,1)', 'rgba(50,112,177,1)', 'rgba(119,89,190,1)', 'rgba(240,204,174,1)'],
  ['rgba(76,25,68,1)', 'rgba(163,54,116,1)', 'rgba(94,89,182,1)', 'rgba(255,186,125,1)'],
] as const;

/**
 * The Milky Way, with the Sun and the catalogue's stars and black holes at their
 * real directions and distances (1 unit = 500 ly). The arm pattern is
 * illustrative, not a measured map of the real arms.
 */
export function GalaxyScene({ names }: { names: Record<string, string> }) {
  const markers = useMemo(() => galaxyMarkers(), []);
  const halo = useMemo(() => createGlowTexture('#ffd166', 'rgba(255,170,60,0)'), []);
  const nebulae = useMemo(() => NEBULA_PALETTES.map((palette, index) => createNebulaTexture(palette, 99 + index * 47, 384)), []);
  useEffect(() => () => { halo.dispose(); nebulae.forEach((texture) => texture.dispose()); }, [halo, nebulae]);

  return (
    <group>
      <ambientLight intensity={0.5} />
      {/* Distant nebula cloud behind the galaxy — gives the void colour instead of black. */}
      <sprite scale={[MILKY_WAY_RADIUS * 6, MILKY_WAY_RADIUS * 6, 1]} position={[0, 0, -MILKY_WAY_RADIUS * 2]} raycast={() => null}>
        <spriteMaterial map={nebulae[0]} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.5} />
      </sprite>
      <GalaxyField shape={MILKY_WAY} size={1.15} coreGlow={0.8} />
      {DUST_CLOUDS.map((cloud, index) => (
        <sprite key={`dust-${index}`} position={cloud.position} scale={[cloud.scale * 1.6, cloud.scale, 1]} rotation={[0, 0, cloud.rotation]} raycast={() => null}>
          <spriteMaterial map={nebulae[cloud.palette]} color={index % 3 === 0 ? '#9fcaff' : index % 3 === 1 ? '#e3a2ff' : '#ffd09f'} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={cloud.opacity} />
        </sprite>
      ))}
      {markers.map((marker) => (
        <group key={marker.id}>
          <CelestialBody
            id={marker.id}
            label={names[marker.id] ?? marker.name}
            color={marker.kind === 'black_hole' ? '#03040a' : marker.color}
            radius={marker.radius}
            emissiveIntensity={marker.kind === 'black_hole' ? 0 : 1}
            position={marker.position}
            focusRadius={marker.kind === 'black_hole' ? 0.6 : Math.max(marker.radius, 0.006)}
            labelGap={marker.radius * 0.6}
            spin={marker.kind === 'black_hole' ? 0 : 0.2}
          />
          {marker.kind === 'black_hole' ? <BlackHoleAccretionDisk position={marker.position} radius={marker.radius} seed={marker.id.length * 37} /> : null}
          {marker.kind !== 'black_hole' ? (
            <sprite position={marker.position} scale={[marker.radius * 14, marker.radius * 14, 1]} raycast={() => null}>
              <spriteMaterial map={halo} color={marker.color} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.55} />
            </sprite>
          ) : null}
          {/* Constant on-screen size, so every marker (and "you are here") stays findable from across the galaxy. */}
          <sprite position={marker.position} scale={marker.kind === 'sun' ? [0.07, 0.07, 1] : marker.kind === 'black_hole' ? [0.05, 0.05, 1] : [0.028, 0.028, 1]} raycast={() => null}>
            <spriteMaterial map={halo} color={marker.color} sizeAttenuation={false} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={marker.kind === 'black_hole' ? 0.48 : 0.85} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
