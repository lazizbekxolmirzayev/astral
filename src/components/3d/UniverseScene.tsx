'use client';

import { useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import { BufferAttribute, BufferGeometry, Color, QuadraticBezierCurve3, Vector3 } from 'three';
import { mulberry32 } from '@/lib/random';
import { universeMarkers } from '@/lib/universeLayout';
import { CelestialBody } from './CelestialBody';
import { GalaxyField } from './GalaxyField';
import { BlackHoleAccretionDisk } from './BlackHoleAccretionDisk';
import type { GalaxyShape } from './galaxyBuilder';

type Look = {
  shape: Omit<GalaxyShape, 'radius' | 'seed'>;
  tilt: [number, number, number];
  count: number;
  feature?: 'dust-lane' | 'starburst-wind';
};

/** Galaxy type and tilt per catalogue id (type is real; tilts are artistic). */
const LOOKS: Record<string, Look> = {
  'milky-way': { shape: { kind: 'spiral', count: 0, arms: 4, twist: 4.2, thickness: 0.035, bulgeFraction: 0.3, barStrength: 0.16, coreColor: '#ffe3a6', armColor: '#8fb0ff' }, tilt: [0.5, 0, 0.2], count: 11000 },
  andromeda: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 3.4, thickness: 0.03, bulgeFraction: 0.34, coreColor: '#ffe6bd', armColor: '#9fb8ff' }, tilt: [1.2, 0.3, 0.1], count: 13000 },
  triangulum: { shape: { kind: 'spiral', count: 0, arms: 3, twist: 3, thickness: 0.05, bulgeFraction: 0.1, knotFrequency: 0.42, coreColor: '#ffe0c0', armColor: '#a8c0ff' }, tilt: [0.3, 0, 0.5], count: 6000 },
  lmc: { shape: { kind: 'irregular', count: 0, coreColor: '#ffeacb', armColor: '#bcd0ff' }, tilt: [0.7, 0.4, 0], count: 4500 },
  smc: { shape: { kind: 'irregular', count: 0, coreColor: '#ffdba8', armColor: '#9ebfff' }, tilt: [0.45, 0.2, 0.65], count: 2800 },
  whirlpool: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 5, thickness: 0.03, knotFrequency: 0.36, armAsymmetry: 0.14, coreColor: '#ffe9c4', armColor: '#8fb0ff' }, tilt: [0.1, 0, 0.2], count: 10500 },
  sombrero: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 1.2, thickness: 0.018, bulgeFraction: 0.46, coreColor: '#fff0d0', armColor: '#e8d8b8' }, tilt: [1.5, 0.2, 0], count: 10500, feature: 'dust-lane' },
  'm87-star': { shape: { kind: 'elliptical', count: 0, flattening: 0.5, coreColor: '#ffe2b0', armColor: '#ffd29a' }, tilt: [0.2, 0.6, 0], count: 12000 },
  m81: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 3.2, thickness: 0.035, bulgeFraction: 0.3, coreColor: '#ffe9c7', armColor: '#9cbaff' }, tilt: [1.18, 0.25, 0.12], count: 9000 },
  m82: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 2.4, thickness: 0.025, bulgeFraction: 0.42, knotFrequency: 0.3, coreColor: '#ffcb8a', armColor: '#ff8295' }, tilt: [1.53, 0.18, 0.08], count: 7000, feature: 'starburst-wind' },
  pinwheel: { shape: { kind: 'spiral', count: 0, arms: 5, twist: 4.6, thickness: 0.045, bulgeFraction: 0.14, armAsymmetry: 0.24, knotFrequency: 0.42, coreColor: '#ffe7b8', armColor: '#8bc8ff' }, tilt: [0.28, 0.1, 0.35], count: 11000 },
  'centaurus-a': { shape: { kind: 'elliptical', count: 0, flattening: 0.34, coreColor: '#ffe0b0', armColor: '#a7b9dc' }, tilt: [0.55, 0.15, 0.3], count: 8500, feature: 'dust-lane' },
};

function GalaxyFeature({ feature, radius, tilt }: { feature: NonNullable<Look['feature']>; radius: number; tilt: [number, number, number] }) {
  if (feature === 'dust-lane') {
    return (
      <group rotation={tilt}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={() => null}>
          <planeGeometry args={[radius * 1.9, radius * 0.075]} />
          <meshBasicMaterial color="#090a13" transparent opacity={0.72} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
    );
  }

  const height = radius * 2.25;
  return (
    <group rotation={tilt}>
      {[1, -1].map((direction) => (
        <mesh key={direction} position={[0, direction * height * 0.5, 0]} rotation={[direction < 0 ? Math.PI : 0, 0, 0]}>
          <coneGeometry args={[radius * 0.31, height, 24, 3, true]} />
          <meshBasicMaterial color={direction === 1 ? '#ff8c68' : '#ad72ff'} transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** A faint scatter of far-off galaxies so the dark between the near ones is not empty. */
function backgroundGalaxies() {
  const random = mulberry32(777);
  const count = 3500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 220 + random() * 600;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.7;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

const BACKGROUND_COLOR = new Color('#9fb0d8');

/** Faint, illustrative filaments make the nearby galaxy group read as a 3D structure. */
function buildCosmicWeb(markers: ReturnType<typeof universeMarkers>) {
  const byId = new Map(markers.map((marker) => [marker.id, marker]));
  const links = [['milky-way', 'andromeda'], ['milky-way', 'triangulum'], ['milky-way', 'lmc'], ['milky-way', 'smc'], ['andromeda', 'triangulum'], ['m81', 'm82']] as const;
  const coordinates: number[] = [];
  for (const [fromId, toId] of links) {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) continue;
    const start = new Vector3(...from.position);
    const end = new Vector3(...to.position);
    const offset = new Vector3(0, start.distanceTo(end) * 0.07, 0);
    const curve = new QuadraticBezierCurve3(start, start.clone().lerp(end, 0.5).add(offset), end);
    const samples = curve.getPoints(36);
    for (let index = 0; index < samples.length - 1; index += 1) {
      coordinates.push(...samples[index]!.toArray(), ...samples[index + 1]!.toArray());
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(coordinates), 3));
  return geometry;
}

/**
 * Milky Way at the centre and the catalogue galaxies around it, in their real
 * directions. Distances are compressed (d^0.45) and galaxy sizes exaggerated so
 * all of them fit one screen; the background galaxies are decoration.
 */
export function UniverseScene({ names }: { names: Record<string, string> }) {
  const markers = useMemo(() => universeMarkers(), []);
  const background = useMemo(() => backgroundGalaxies(), []);
  const cosmicWeb = useMemo(() => buildCosmicWeb(markers), [markers]);

  useEffect(() => () => {
    background.dispose();
    cosmicWeb.dispose();
  }, [background, cosmicWeb]);

  return (
    <group>
      <ambientLight intensity={0.5} />
      <points geometry={background} frustumCulled={false} raycast={() => null}>
        <pointsMaterial size={1.2} sizeAttenuation color={BACKGROUND_COLOR} transparent opacity={0.45} depthWrite={false} />
      </points>
      <lineSegments geometry={cosmicWeb} frustumCulled={false} raycast={() => null}>
        <lineBasicMaterial color="#738dff" transparent opacity={0.16} depthWrite={false} />
      </lineSegments>
      {markers.map((marker, index) => {
        const look = LOOKS[marker.id];
        return (
          <group key={marker.id} position={marker.position}>
            {look ? (
              <>
              <GalaxyField
                shape={{ ...look.shape, radius: marker.radius, count: look.count, seed: 100 + index * 13 }}
                size={Math.max(0.3, marker.radius / 16)}
                alpha={0.28}
                tilt={look.tilt}
                coreGlow={marker.kind === 'black_hole' ? 0.5 : 0.55}
              />
              {look.feature ? <GalaxyFeature feature={look.feature} radius={marker.radius} tilt={look.tilt} /> : null}
              </>
            ) : null}
            {marker.kind === 'black_hole' ? <BlackHoleAccretionDisk radius={Math.max(0.35, marker.radius * 0.065)} seed={marker.id.length * 53} /> : null}
            <CelestialBody
              id={marker.id}
              label={names[marker.id] ?? marker.name}
              color={marker.color}
              radius={marker.radius * 1.1}
              position={[0, 0, 0]}
              hidden
              focusRadius={marker.radius}
            />
          </group>
        );
      })}
    </group>
  );
}
