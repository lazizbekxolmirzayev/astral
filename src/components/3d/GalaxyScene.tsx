'use client';

import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, MeshBasicMaterial } from 'three';
import { galaxyMarkers, MILKY_WAY_RADIUS } from '@/lib/universeLayout';
import { CelestialBody } from './CelestialBody';
import { GalaxyCore } from './GalaxyCore';
import { GalaxyField } from './GalaxyField';
import { NebulaCloud } from './NebulaCloud';
import { BlackHoleAccretionDisk } from './BlackHoleAccretionDisk';
import { PulsarBeams } from './PulsarBeams';
import { createGlowTexture, createNebulaTexture, GLOW_BLENDING } from './proceduralTextures';
import type { GalaxyShape } from './galaxyBuilder';

const MILKY_WAY: GalaxyShape = {
  kind: 'spiral',
  radius: MILKY_WAY_RADIUS,
  count: 42000,
  seed: 4242,
  arms: 4,
  armWeights: [1.45, 1.45, 0.55, 0.55],
  localSpur: true,
  bulgeFraction: 0.28,
  twist: 3.8,
  thickness: 0.03,
  coreColor: '#ffe3a6',
  armColor: '#8fb0ff',
  bulgeRadius: 0.2,
  coreBrightness: 2.2,
  dust: 0.34,
  waveStrength: 0.7,
  waveWidth: 0.13,
};

const SATELLITE_SHAPES: Record<'lmc' | 'smc', GalaxyShape> = {
  lmc: { kind: 'irregular', radius: 8, count: 4200, seed: 1601, thickness: 0.22, coreColor: '#f2d5ff', armColor: '#b6a0ff', bulgeRadius: 0.28, coreBrightness: 1.8, bulgeFraction: 0.16 },
  smc: { kind: 'irregular', radius: 5.5, count: 2800, seed: 2001, thickness: 0.28, coreColor: '#c9e9ff', armColor: '#77baff', bulgeRadius: 0.2, coreBrightness: 1.55, bulgeFraction: 0.1 },
};

function buildMilkyWayDustLanes() {
  const armCount = 4;
  const segments = 160;
  const positions = new Float32Array(armCount * (segments + 1) * 2 * 3);
  const indices: number[] = [];
  let vertex = 0;
  for (let arm = 0; arm < armCount; arm += 1) {
    const majorArm = arm < 2;
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const radius = 18 + t * (MILKY_WAY_RADIUS - 18);
      const angle = (arm / armCount) * Math.PI * 2 + (radius / MILKY_WAY_RADIUS) * MILKY_WAY.twist! - 0.045;
      const prevRadius = Math.max(18, radius - 0.25);
      const nextRadius = Math.min(MILKY_WAY_RADIUS, radius + 0.25);
      const prevAngle = (arm / armCount) * Math.PI * 2 + (prevRadius / MILKY_WAY_RADIUS) * MILKY_WAY.twist!;
      const nextAngle = (arm / armCount) * Math.PI * 2 + (nextRadius / MILKY_WAY_RADIUS) * MILKY_WAY.twist!;
      const tx = Math.cos(nextAngle) * nextRadius - Math.cos(prevAngle) * prevRadius;
      const tz = Math.sin(nextAngle) * nextRadius - Math.sin(prevAngle) * prevRadius;
      const tangentLength = Math.hypot(tx, tz) || 1;
      const nx = -tz / tangentLength;
      const nz = tx / tangentLength;
      const width = (majorArm ? 1.15 : 0.7) * Math.sin(Math.PI * (0.06 + t * 0.88));
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 0.12 + Math.sin(radius * 0.3 + arm) * 0.045;
      positions.set([x - nx * width, y, z - nz * width], vertex * 3);
      positions.set([x + nx * width, y, z + nz * width], (vertex + 1) * 3);
      if (segment < segments) indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
      vertex += 2;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

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
  const dustGeometry = useMemo(() => buildMilkyWayDustLanes(), []);
  const dustMaterial = useMemo(() => new MeshBasicMaterial({ color: '#090b18', transparent: true, opacity: 0.38, depthWrite: false, side: DoubleSide }), []);
  const nebulae = useMemo(() => NEBULA_PALETTES.map((palette, index) => createNebulaTexture(palette, 99 + index * 47, 384)), []);
  useEffect(() => () => { halo.dispose(); dustGeometry.dispose(); dustMaterial.dispose(); nebulae.forEach((texture) => texture.dispose()); }, [halo, dustGeometry, dustMaterial, nebulae]);

  return (
    <group>
      <ambientLight intensity={0.5} />
      {/* Distant nebula cloud behind the galaxy — gives the void colour instead of black. */}
      <sprite scale={[MILKY_WAY_RADIUS * 6, MILKY_WAY_RADIUS * 6, 1]} position={[0, 0, -MILKY_WAY_RADIUS * 2]} raycast={() => null}>
        <spriteMaterial map={nebulae[0]} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.5} />
      </sprite>
      <GalaxyCore />
      <GalaxyField shape={MILKY_WAY} size={1.15} coreGlow={0.8} rotationSpeed={0} />
      <mesh geometry={dustGeometry} material={dustMaterial} frustumCulled={false} raycast={() => null} />
      {DUST_CLOUDS.map((cloud, index) => (
        <NebulaCloud
          key={`nebula-${index}`}
          position={cloud.position}
          scale={cloud.scale * 1.6}
          palette={NEBULA_PALETTES[cloud.palette]}
          seed={99 + index * 47}
          drift={0.02 + (index % 3) * 0.008}
          opacity={cloud.opacity}
        />
      ))}
      {markers.map((marker) => (
        <group key={marker.id}>
          {marker.kind === 'galaxy' && (marker.id === 'lmc' || marker.id === 'smc') ? (
            <group position={marker.position} rotation={[0.22, marker.id === 'lmc' ? 0.6 : -0.4, marker.id === 'lmc' ? 0.18 : -0.3]}>
              <GalaxyField shape={SATELLITE_SHAPES[marker.id]} size={0.9} coreGlow={0.45} alpha={0.82} rotationSpeed={0} />
            </group>
          ) : null}
          <CelestialBody
            id={marker.id}
            label={names[marker.id] ?? marker.name}
            color={marker.kind === 'black_hole' ? '#03040a' : marker.color}
            radius={marker.kind === 'galaxy' ? 0.16 : marker.radius}
            emissiveIntensity={marker.kind === 'black_hole' ? 0 : 1}
            position={marker.position}
            focusRadius={marker.kind === 'black_hole' ? 0.6 : marker.kind === 'pulsar' ? 2.8 : Math.max(marker.radius, 0.006)}
            labelGap={marker.kind === 'pulsar' ? 4.8 : marker.kind === 'galaxy' ? marker.radius : marker.radius * 0.6}
            spin={marker.kind === 'black_hole' ? 0 : 0.2}
          />
          {marker.kind === 'black_hole' ? <BlackHoleAccretionDisk position={marker.position} radius={marker.radius} seed={marker.id.length * 37} /> : null}
          {marker.kind === 'pulsar' ? <PulsarBeams position={marker.position} seed={marker.id.length * 29} /> : null}
          {marker.kind === 'star' || marker.kind === 'sun' ? (
            <sprite position={marker.position} scale={[marker.radius * 14, marker.radius * 14, 1]} raycast={() => null}>
              <spriteMaterial map={halo} color={marker.color} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.55} />
            </sprite>
          ) : null}
          {/* Constant on-screen size, so every marker (and "you are here") stays findable from across the galaxy. */}
          <sprite position={marker.position} scale={marker.kind === 'sun' ? [0.07, 0.07, 1] : marker.kind === 'black_hole' ? [0.05, 0.05, 1] : marker.kind === 'galaxy' ? [0.045, 0.045, 1] : [0.028, 0.028, 1]} raycast={() => null}>
            <spriteMaterial map={halo} color={marker.color} sizeAttenuation={false} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={marker.kind === 'black_hole' ? 0.48 : 0.85} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
