'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Object3D,
  type Group,
  type InstancedMesh,
} from 'three';
import { mulberry32 } from '@/lib/random';
import { fbm3 } from '@/lib/noise';
import type { QualityTier } from '@/lib/performance';
import { BELT_MAX_AU, BELT_MIN_AU, sceneRadiusFor } from './layout';

/** Rocks per silhouette: three shapes read as a population, one reads as a pattern. */
const SHAPE_COUNT = 3;

const TOTAL_BY_TIER: Record<QualityTier, number> = {
  low: 220,
  medium: 480,
  high: 820,
  ultra: 1200,
};

/** A lumpy rock: a low-poly solid pushed in and out along its own vertices. */
function createRockGeometry(shape: number, seed: number) {
  const geometry =
    shape === 0
      ? new IcosahedronGeometry(1, 0)
      : shape === 1
        ? new DodecahedronGeometry(1, 0)
        : new DodecahedronGeometry(1, 1);
  const position = geometry.attributes.position!;
  const random = mulberry32(seed);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const bump = 0.66 + fbm3(x * 2.4 + 7, y * 2.4 - 3, z * 2.4 + 11, seed, 3) * 0.72 + random() * 0.06;
    position.setXYZ(i, x * bump, y * bump, z * bump);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

type Placement = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  tint: number;
};

/**
 * The main belt between Mars and Jupiter.
 *
 * PROVENANCE: a rendered population, not a list of named asteroids. The band's
 * inner and outer edges use the real 2.1-3.4 AU range pushed through the same
 * artistic radial compression as the planets, so it sits where the planets sit.
 * Individual rocks, their shapes and the rigid rotation are illustrative — the
 * n-body engine does not integrate them and none of it is measured data.
 *
 * Instancing rather than meshes: a thousand rocks cost one draw call per shape,
 * which is the difference between a detail and a slideshow.
 */
export function AsteroidBelt({ qualityTier }: { qualityTier: QualityTier }) {
  const groupRef = useRef<Group>(null);
  const meshes = useRef<Array<InstancedMesh | null>>([]);
  const count = Math.ceil(TOTAL_BY_TIER[qualityTier] / SHAPE_COUNT);

  const geometries = useMemo(
    () => Array.from({ length: SHAPE_COUNT }, (_unused, shape) => createRockGeometry(shape, 4000 + shape * 977)),
    [],
  );

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#8d8175'),
        roughness: 0.95,
        metalness: 0.06,
        flatShading: true,
        envMapIntensity: 0.8,
      }),
    [],
  );

  const placements = useMemo<Placement[]>(() => {
    const random = mulberry32(20261024);
    const total = count * SHAPE_COUNT;
    const rocks: Placement[] = [];
    for (let i = 0; i < total; i += 1) {
      const distanceAu = BELT_MIN_AU + Math.pow(random(), 0.8) * (BELT_MAX_AU - BELT_MIN_AU);
      const angle = random() * Math.PI * 2;
      const radius = sceneRadiusFor(distanceAu);
      // A flattened torus: mostly in the ecliptic plane, a little scatter above
      // and below so the band has thickness when seen edge-on. Three summed draws
      // give the believable clumping rather than a hard-edged slab.
      const vertical = (random() + random() + random() - 1.5) / 1.5;
      const radialJitter = (random() - 0.5) * radius * 0.02;
      const sideJitter = (random() - 0.5) * radius * 0.02;
      rocks.push({
        position: [
          Math.cos(angle) * radius + sideJitter,
          vertical * radius * 0.038,
          Math.sin(angle) * radius + radialJitter,
        ],
        rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
        scale: 0.02 + Math.pow(random(), 3.2) * 0.16,
        // Regolith varies from warm grey to faintly red, never bright.
        tint: 0.7 + random() * 0.5,
      });
    }
    return rocks;
  }, [count]);

  // Written once: only the group turns after this.
  useEffect(() => {
    const dummy = new Object3D();
    const tint = new Color();
    meshes.current.forEach((mesh, shape) => {
      if (!mesh) return;
      const start = shape * count;
      const slice = placements.slice(start, start + count);
      slice.forEach((entry, index) => {
        dummy.position.set(...entry.position);
        dummy.rotation.set(...entry.rotation);
        dummy.scale.setScalar(entry.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, tint.setScalar(entry.tint));
      });
      mesh.count = slice.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [placements, count]);

  useFrame((_state, delta) => {
    // Rigid rotation stands in for orbital motion: from this far out the band
    // drifts as one.
    if (groupRef.current) groupRef.current.rotation.y -= delta * 0.016;
  });

  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    },
    [geometries, material],
  );

  return (
    <group ref={groupRef}>
      {geometries.map((geometry, shape) => (
        <instancedMesh
          key={shape}
          ref={(node: InstancedMesh | null) => {
            meshes.current[shape] = node;
          }}
          args={[geometry, material, count]}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
