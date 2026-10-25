'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, type Mesh } from 'three';
import { simulation } from '@/lib/simulation';
import { CelestialBody } from './CelestialBody';
import { projectToScene } from './layout';

type DwarfPlanet = {
  id: string;
  a: number;
  e: number;
  period: number;
  inclination: number;
  node: number;
  phase: number;
  radius: number;
  color: string;
  orbitColor: string;
  palette: string[];
  seed: number;
};

/** Orbit elements are representative; starting phases and rendered sizes are illustrative. */
const DWARF_PLANETS: readonly DwarfPlanet[] = [
  { id: 'ceres', a: 2.768, e: 0.0758, period: 1682, inclination: 10.59, node: 80, phase: 1.2, radius: 0.24, color: '#b4a99b', orbitColor: '#d8c5a8', palette: ['#625e5a', '#858079', '#b4a99b', '#d2c8ba'], seed: 107, },
  { id: 'pluto', a: 39.482, e: 0.2488, period: 90560, inclination: 17.14, node: 110.3, phase: 3.7, radius: 0.34, color: '#d3ae91', orbitColor: '#c6a7ff', palette: ['#76645b', '#a18070', '#d3ae91', '#ead7c6'], seed: 211, },
  { id: 'haumea', a: 43.13, e: 0.195, period: 104000, inclination: 28.2, node: 122, phase: 5.1, radius: 0.31, color: '#d8d1c6', orbitColor: '#a8dcff', palette: ['#89857f', '#b8b1a5', '#e0d9cb', '#f3eee4'], seed: 307, },
  { id: 'makemake', a: 45.79, e: 0.159, period: 113200, inclination: 29, node: 79, phase: 2.4, radius: 0.3, color: '#c98c68', orbitColor: '#ffbd91', palette: ['#754d3b', '#a96e50', '#cb8c66', '#e1b496'], seed: 401, },
  { id: 'eris', a: 67.67, e: 0.442, period: 203400, inclination: 44.2, node: 35, phase: 0.6, radius: 0.32, color: '#d8e2ed', orbitColor: '#a9c9ff', palette: ['#707982', '#a3adb9', '#d8e2ed', '#f1f6ff'], seed: 503, },
];

function orbitalPosition(body: DwarfPlanet, elapsedDays: number): [number, number, number] {
  const meanAnomaly = (elapsedDays * (Math.PI * 2 / body.period) + body.phase) % (Math.PI * 2);
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    eccentricAnomaly -= (eccentricAnomaly - body.e * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - body.e * Math.cos(eccentricAnomaly));
  }

  const xOrbit = body.a * (Math.cos(eccentricAnomaly) - body.e);
  const yOrbit = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(eccentricAnomaly);
  const inclination = body.inclination * Math.PI / 180;
  const node = body.node * Math.PI / 180;
  const x = xOrbit * Math.cos(node) - yOrbit * Math.cos(inclination) * Math.sin(node);
  const y = xOrbit * Math.sin(node) + yOrbit * Math.cos(inclination) * Math.cos(node);
  const z = yOrbit * Math.sin(inclination);
  return projectToScene([x, y, z]);
}

function orbitLine(body: DwarfPlanet): Line<BufferGeometry, LineBasicMaterial> {
  const positions = new Float32Array(161 * 3);
  for (let index = 0; index <= 160; index += 1) {
    const anomaly = index / 160 * Math.PI * 2;
    const xOrbit = body.a * (Math.cos(anomaly) - body.e);
    const yOrbit = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(anomaly);
    const inclination = body.inclination * Math.PI / 180;
    const node = body.node * Math.PI / 180;
    const x = xOrbit * Math.cos(node) - yOrbit * Math.cos(inclination) * Math.sin(node);
    const y = xOrbit * Math.sin(node) + yOrbit * Math.cos(inclination) * Math.cos(node);
    const z = yOrbit * Math.sin(inclination);
    positions.set(projectToScene([x, y, z]), index * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const line = new Line(geometry, new LineBasicMaterial({ color: body.orbitColor, transparent: true, opacity: 0.16, depthWrite: false }));
  line.raycast = () => null;
  return line;
}

export function DwarfPlanets({ names }: { names: Record<string, string> }) {
  const meshes = useRef<Array<Mesh | null>>([]);
  const orbits = useMemo(() => DWARF_PLANETS.map(orbitLine), []);

  useEffect(() => () => orbits.forEach((orbit) => { orbit.geometry.dispose(); orbit.material.dispose(); }), [orbits]);

  useFrame(() => {
    DWARF_PLANETS.forEach((body, index) => {
      const mesh = meshes.current[index];
      if (mesh) mesh.position.set(...orbitalPosition(body, simulation.elapsedDays));
    });
  });

  return (
    <group>
      {DWARF_PLANETS.map((body, index) => (
        <group key={body.id}>
          <primitive object={orbits[index]} />
          <CelestialBody
            id={body.id}
            label={names[body.id] ?? body.id}
            color={body.color}
            radius={body.radius}
            roughness={0.9}
            position={orbitalPosition(body, simulation.elapsedDays)}
            registerMesh={(mesh) => { meshes.current[index] = mesh; }}
            look={{ mode: 'blobs', palette: body.palette, seed: body.seed, scale: 3.2, seaLevel: 0.48 }}
            focusRadius={body.radius}
            labelGap={0.35}
            spin={body.id === 'haumea' ? 1.1 : 0.08}
          />
        </group>
      ))}
    </group>
  );
}
