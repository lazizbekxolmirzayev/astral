'use client';

import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, TextureLoader } from 'three';
import { mulberry32 } from '@/lib/random';
import { createNebulaTexture, GLOW_BLENDING } from './proceduralTextures';
import { universeMarkers } from '@/lib/universeLayout';
import { CelestialBody } from './CelestialBody';
import { GalaxyField } from './GalaxyField';
import type { GalaxyShape } from './galaxyBuilder';

type Look = { shape: Omit<GalaxyShape, 'radius' | 'seed'>; tilt: [number, number, number]; count: number };

/** Galaxy type and tilt per catalogue id (type is real; tilts are artistic). */
const LOOKS: Record<string, Look> = {
  'milky-way': { shape: { kind: 'spiral', count: 0, arms: 4, twist: 4.2, thickness: 0.035, coreColor: '#ffe3a6', armColor: '#8fb0ff' }, tilt: [0.5, 0, 0.2], count: 9000 },
  andromeda: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 3.4, thickness: 0.03, coreColor: '#ffe6bd', armColor: '#9fb8ff' }, tilt: [1.2, 0.3, 0.1], count: 12000 },
  triangulum: { shape: { kind: 'spiral', count: 0, arms: 3, twist: 3, thickness: 0.04, coreColor: '#ffe0c0', armColor: '#a8c0ff' }, tilt: [0.3, 0, 0.5], count: 5000 },
  lmc: { shape: { kind: 'irregular', count: 0, coreColor: '#ffeacb', armColor: '#bcd0ff' }, tilt: [0.7, 0.4, 0], count: 3500 },
  whirlpool: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 5, thickness: 0.03, coreColor: '#ffe9c4', armColor: '#8fb0ff' }, tilt: [0.1, 0, 0.2], count: 9000 },
  sombrero: { shape: { kind: 'spiral', count: 0, arms: 2, twist: 1.2, thickness: 0.025, coreColor: '#fff0d0', armColor: '#e8d8b8' }, tilt: [1.45, 0.2, 0], count: 9000 },
  'm87-star': { shape: { kind: 'elliptical', count: 0, coreColor: '#ffe2b0', armColor: '#ffd29a' }, tilt: [0.2, 0.6, 0], count: 10000 },
};

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

/**
 * Milky Way at the centre and the catalogue galaxies around it, in their real
 * directions. Distances are compressed (d^0.45) and galaxy sizes exaggerated so
 * all of them fit one screen; the background galaxies are decoration.
 */
export function UniverseScene({ names }: { names: Record<string, string> }) {
  const markers = useMemo(() => universeMarkers(), []);
  const background = useMemo(() => backgroundGalaxies(), []);
  const nebula = useMemo(
    () =>
      createNebulaTexture(
        ['rgba(30,20,50,1)', 'rgba(80,40,110,1)', 'rgba(40,100,170,1)', 'rgba(255,200,140,1)'],
        313,
      ),
    [],
  );

  return (
    <group>
      <ambientLight intensity={0.5} />
      <points geometry={background} frustumCulled={false} raycast={() => null}>
        <pointsMaterial size={1.2} sizeAttenuation color={BACKGROUND_COLOR} transparent opacity={0.45} depthWrite={false} />
      </points>
      <sprite position={[0, 0, -400]} scale={[800, 800, 1]} raycast={() => null}>
        <spriteMaterial map={nebula} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.45} />
      </sprite>
      {markers.map((marker, index) => {
        const look = LOOKS[marker.id];
        return (
          <group key={marker.id} position={marker.position}>
            {look ? (
              <GalaxyField
                shape={{ ...look.shape, radius: marker.radius, count: look.count, seed: 100 + index * 13 }}
                size={Math.max(0.3, marker.radius / 16)}
                alpha={0.28}
                tilt={look.tilt}
                coreGlow={marker.kind === 'black_hole' ? 0.5 : 0.55}
              />
            ) : null}
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