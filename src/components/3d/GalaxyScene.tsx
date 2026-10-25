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
};

/** Dust and ionised gas knots threaded through the spiral arms; position is illustrative. */
const DUST_CLOUDS = Array.from({ length: 11 }, (_, index) => {
  const arm = index % 4;
  const radius = 18 + index * 7.1;
  const angle = arm * (Math.PI / 2) + (radius / MILKY_WAY_RADIUS) * MILKY_WAY.twist! + index * 0.17;
  const scale = 13 + (index % 3) * 4;
  return {
    position: [Math.cos(angle) * radius, ((index % 3) - 1) * 1.8, Math.sin(angle) * radius] as [number, number, number],
    scale,
    rotation: angle,
    opacity: 0.16 + (index % 4) * 0.035,
  };
});

/**
 * The Milky Way, with the Sun and the catalogue's stars and black holes at their
 * real directions and distances (1 unit = 500 ly). The arm pattern is
 * illustrative, not a measured map of the real arms.
 */
export function GalaxyScene({ names }: { names: Record<string, string> }) {
  const markers = useMemo(() => galaxyMarkers(), []);
  const halo = useMemo(() => createGlowTexture('#ffd166', 'rgba(255,170,60,0)'), []);
  const nebula = useMemo(
    () =>
      createNebulaTexture(
        ['rgba(70,30,90,1)', 'rgba(120,50,140,1)', 'rgba(60,120,180,1)', 'rgba(255,210,150,1)'],
        99,
      ),
    [],
  );
  useEffect(() => () => { halo.dispose(); nebula.dispose(); }, [halo, nebula]);

  return (
    <group>
      <ambientLight intensity={0.5} />
      {/* Distant nebula cloud behind the galaxy — gives the void colour instead of black. */}
      <sprite scale={[MILKY_WAY_RADIUS * 6, MILKY_WAY_RADIUS * 6, 1]} position={[0, 0, -MILKY_WAY_RADIUS * 2]} raycast={() => null}>
        <spriteMaterial map={nebula} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.5} />
      </sprite>
      <GalaxyField shape={MILKY_WAY} size={1.15} coreGlow={0.8} />
      {DUST_CLOUDS.map((cloud, index) => (
        <sprite key={`dust-${index}`} position={cloud.position} scale={[cloud.scale * 1.6, cloud.scale, 1]} rotation={[0, 0, cloud.rotation]} raycast={() => null}>
          <spriteMaterial map={nebula} color={index % 3 === 0 ? '#9fcaff' : '#e3a2ff'} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={cloud.opacity} />
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
