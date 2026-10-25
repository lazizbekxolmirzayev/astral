'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, type Mesh } from 'three';
import { catalogEntries } from '@/data/catalog/entries';
import { simulation } from '@/lib/simulation';
import { CelestialBody } from './CelestialBody';
import { projectToScene } from './layout';

const SMALL_BODY_LOOKS = {
  vesta: { radius: 0.17, color: '#b8a99a', orbitColor: '#e5c89f', inclination: 7.1, phase: 1.8, palette: ['#625d58', '#8b8176', '#b7a99b', '#ddd0c1'], seed: 122 },
  apophis: { radius: 0.1, color: '#d8a579', orbitColor: '#ffb779', inclination: 3.3, phase: 2.6, palette: ['#704d39', '#a86f4c', '#d8a579', '#edc7a1'], seed: 233 },
  bennu: { radius: 0.11, color: '#9d7961', orbitColor: '#d8a77e', inclination: 6, phase: 5.4, palette: ['#493c33', '#725b4b', '#9d7961', '#c49d7e'], seed: 344 },
  halley: { radius: 0.14, color: '#a8c7d9', orbitColor: '#8fd7ff', inclination: 162.3, phase: 0.25, palette: ['#3b424d', '#697786', '#a8c7d9', '#e0f4ff'], seed: 455 },
} as const;

type SmallBodyId = keyof typeof SMALL_BODY_LOOKS;
const SMALL_BODIES = Object.keys(SMALL_BODY_LOOKS).map((id) => {
  const entry = catalogEntries.find((candidate) => candidate.id === id);
  if (!entry?.semiMajorAxisAu || !entry.eccentricity || !entry.orbitalPeriodDays) throw new Error(`Missing orbit data for ${id}`);
  return { id: id as SmallBodyId, a: entry.semiMajorAxisAu.value, e: entry.eccentricity.value, period: entry.orbitalPeriodDays.value, ...SMALL_BODY_LOOKS[id as SmallBodyId], name: entry.name };
});

function getPosition(body: (typeof SMALL_BODIES)[number], elapsedDays: number): [number, number, number] {
  const meanAnomaly = (elapsedDays / body.period * Math.PI * 2 + body.phase) % (Math.PI * 2);
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 6; i += 1) eccentricAnomaly -= (eccentricAnomaly - body.e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - body.e * Math.cos(eccentricAnomaly));
  const xOrbit = body.a * (Math.cos(eccentricAnomaly) - body.e);
  const yOrbit = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(eccentricAnomaly);
  const inclination = body.inclination * Math.PI / 180;
  return projectToScene([xOrbit, yOrbit * Math.cos(inclination), yOrbit * Math.sin(inclination)]);
}

function buildOrbit(body: (typeof SMALL_BODIES)[number]) {
  const positions = new Float32Array(161 * 3);
  for (let i = 0; i <= 160; i += 1) {
    const anomaly = i / 160 * Math.PI * 2;
    const xOrbit = body.a * (Math.cos(anomaly) - body.e);
    const yOrbit = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(anomaly);
    const inclination = body.inclination * Math.PI / 180;
    positions.set(projectToScene([xOrbit, yOrbit * Math.cos(inclination), yOrbit * Math.sin(inclination)]), i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const line = new Line(geometry, new LineBasicMaterial({ color: body.orbitColor, transparent: true, opacity: 0.2, depthWrite: false }));
  line.raycast = () => null;
  return line;
}

/** Individually selectable asteroid/comet catalog objects with representative, not epoch-exact, phases. */
export function CatalogSmallBodies() {
  const meshes = useRef<Array<Mesh | null>>([]);
  const orbits = useMemo(() => SMALL_BODIES.map(buildOrbit), []);
  useEffect(() => () => orbits.forEach((orbit) => { orbit.geometry.dispose(); orbit.material.dispose(); }), [orbits]);

  useFrame(() => {
    SMALL_BODIES.forEach((body, index) => {
      const mesh = meshes.current[index];
      if (mesh) mesh.position.set(...getPosition(body, simulation.elapsedDays));
    });
  });

  return (
    <group>
      {SMALL_BODIES.map((body, index) => (
        <group key={body.id}>
          <primitive object={orbits[index]} />
          <CelestialBody
            id={body.id}
            label={body.name}
            color={body.color}
            radius={body.radius}
            position={getPosition(body, simulation.elapsedDays)}
            registerMesh={(mesh) => { meshes.current[index] = mesh; }}
            look={{ mode: 'blobs', palette: [...body.palette], seed: body.seed, scale: 3.5, seaLevel: 0.48 }}
            focusRadius={body.radius}
            labelGap={0.28}
            spin={body.id === 'halley' ? -0.12 : 0.16}
          />
        </group>
      ))}
    </group>
  );
}
