'use client';

import { Line, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { isWebGLAvailable } from '@/lib/webgl';
import { TARGETS } from '@/mission/data';
import { orbitPosition } from '@/physics/orbits';
import type { FlightPhase, TargetId } from '@/mission/types';

/** Not to scale: the planet and orbit sizes are chosen to read clearly on screen. */
const PLANET_RADIUS = 2;
const ORBIT_RADIUS = 3;
const ORBIT_TURNS_PER_SECOND = 0.12;
const TRANSFER_VIEW_RADIUS = 6;
const TRANSFER_PATH_POINTS = 64;

function Ring({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.012, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

function Craft({ alive }: { alive: boolean }) {
  return (
    <mesh>
      <boxGeometry args={[0.16, 0.16, 0.16]} />
      <meshBasicMaterial color={alive ? '#7df9ff' : '#fb7185'} />
    </mesh>
  );
}

function OrbitView({ target, alive }: { target: TargetId; alive: boolean }) {
  const craft = useRef<Group>(null);
  const planet = useRef<Mesh>(null);
  useFrame(({ clock }, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.05;
    if (!craft.current || !alive) return;
    const angle = clock.getElapsedTime() * ORBIT_TURNS_PER_SECOND * Math.PI * 2;
    craft.current.position.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);
  });
  return (
    <>
      <mesh ref={planet}>
        <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
        <meshStandardMaterial color={TARGETS[target].color} roughness={0.85} />
      </mesh>
      <Ring radius={ORBIT_RADIUS} color="#7df9ff" />
      <group ref={craft} position={[ORBIT_RADIUS, 0, 0]}><Craft alive={alive} /></group>
    </>
  );
}

/** The real transfer ellipse, drawn from the same Kepler solver as the simulator. */
function TransferView({ target, progress }: { target: TargetId; progress: number }) {
  const destination = TARGETS[target].sunDistanceAu;
  const scale = TRANSFER_VIEW_RADIUS / destination;
  const semiMajorAxis = (1 + destination) / 2;
  const eccentricity = (destination - 1) / (destination + 1);
  const elements = useMemo(() => ({ semiMajorAxis, eccentricity, period: 2, phase: 0 }), [semiMajorAxis, eccentricity]);
  const position = orbitPosition(elements, progress);
  const path = useMemo(() => Array.from({ length: TRANSFER_PATH_POINTS + 1 }, (_, index) => {
    const point = orbitPosition(elements, index / TRANSFER_PATH_POINTS);
    return [point.x * scale, 0, point.z * scale] as [number, number, number];
  }), [elements, scale]);
  return (
    <>
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
      <Ring radius={scale} color={TARGETS.earth.color} />
      <Ring radius={destination * scale} color={TARGETS[target].color} />
      <Line points={path} color="#7df9ff" lineWidth={1.5} dashed dashSize={0.25} gapSize={0.15} />
      <group position={[position.x * scale, 0, position.z * scale]}><Craft alive /></group>
    </>
  );
}

export type MissionSceneProps = {
  target: TargetId;
  phase: FlightPhase;
  /** 0 at departure, 1 on arrival. */
  cruiseProgress: number;
  alive: boolean;
  fallback: string;
};

export default function MissionScene({ target, phase, cruiseProgress, alive, fallback }: MissionSceneProps) {
  if (!isWebGLAvailable()) return <p className="grid h-full place-items-center p-6 text-center text-sm text-foreground/70">{fallback}</p>;
  const crossingSpace = phase === 'cruise' && TARGETS[target].sunDistanceAu !== 1;
  return (
    <Canvas camera={{ position: crossingSpace ? [0, 12, 8] : [0, 3.2, 8], fov: 45 }} key={crossingSpace ? 'transfer' : 'orbit'}>
      <color attach="background" args={['#05070c']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 4, 5]} intensity={2.4} />
      <Stars radius={60} depth={30} count={1500} factor={3} fade />
      {crossingSpace ? <TransferView target={target} progress={cruiseProgress} /> : <OrbitView target={target} alive={alive} />}
    </Canvas>
  );
}
