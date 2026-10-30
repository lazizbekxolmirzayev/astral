'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { DoubleSide, type Group } from 'three';
import { isWebGLAvailable } from '@/lib/webgl';
import { commsById, instrumentById, powerById, propulsionById } from '@/mission/data';
import type { Capability, MissionDesign } from '@/mission/types';

/** Sizes follow the chosen parts but are compressed so a small and a large craft both fit. */
const BUS_SIZE: Record<string, number> = { 'bus-small': 0.7, 'bus-medium': 1, 'bus-large': 1.35 };
const WING_LENGTH_PER_ROOT_M2 = 0.42;
const WING_WIDTH = 0.6;
const DISH_SCALE = 0.42;
const INSTRUMENT_COLUMNS = 3;
const SPIN_RADIANS_PER_SECOND = 0.35;

const CAPABILITY_COLOR: Record<Capability, string> = {
  imaging: '#7df9ff',
  spectroscopy: '#c084fc',
  radar: '#fb7185',
  fields: '#4ade80',
  particles: '#facc15',
  thermal: '#fb923c',
  topography: '#60a5fa',
};

function Wing({ side, length, offset }: { side: 1 | -1; length: number; offset: number }) {
  return (
    <group position={[side * (offset + length / 2), 0, 0]}>
      <mesh>
        <boxGeometry args={[length, 0.02, WING_WIDTH]} />
        <meshStandardMaterial color="#2f6fe0" emissive="#123a8a" emissiveIntensity={0.5} metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh position={[-side * (length / 2 + 0.1), 0, 0]}>
        <boxGeometry args={[0.2, 0.03, 0.03]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
    </group>
  );
}

function Craft({ design }: { design: MissionDesign }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * SPIN_RADIANS_PER_SECOND;
  });

  const size = BUS_SIZE[design.busId] ?? 1;
  const source = powerById(design.powerId);
  const dish = commsById(design.commsId).dishDiameterM * DISH_SCALE;
  const nozzle = propulsionById(design.propulsionId).ispS > 200 ? 0.22 : 0.12;
  const instruments = design.instrumentIds.map(instrumentById);
  const wingLength = Math.sqrt(source.arrayAreaM2 ?? 0) * WING_LENGTH_PER_ROOT_M2;
  const face = size / 2;

  return (
    <group ref={group} rotation={[0.25, 0, 0]}>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color="#d9b23a" metalness={0.25} roughness={0.5} />
      </mesh>

      {source.rtgW ? (
        <mesh position={[0, -face - 0.45, -face]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.7, 16]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.3} roughness={0.5} />
        </mesh>
      ) : (
        <>
          <Wing side={1} length={wingLength} offset={face + 0.2} />
          <Wing side={-1} length={wingLength} offset={face + 0.2} />
        </>
      )}

      <mesh position={[0, face + 0.12 + dish, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[dish, 32, 16, 0, Math.PI * 2, 0, Math.PI / 4]} />
        <meshStandardMaterial color="#e5e7eb" side={DoubleSide} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, face + 0.06, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[0, -face - nozzle * 0.6, 0]}>
        <coneGeometry args={[nozzle, nozzle * 1.4, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.3} roughness={0.5} />
      </mesh>

      {instruments.map((instrument, index) => {
        const box = 0.12 + Math.sqrt(instrument.massKg) * 0.016;
        const spacing = size / INSTRUMENT_COLUMNS;
        const column = index % INSTRUMENT_COLUMNS;
        const row = Math.floor(index / INSTRUMENT_COLUMNS);
        return (
          <mesh key={instrument.id} position={[(column - 1) * spacing, face - spacing * (row + 0.5), face + box / 2]}>
            <boxGeometry args={[box, box, box]} />
            <meshStandardMaterial color={CAPABILITY_COLOR[instrument.capability]} emissive={CAPABILITY_COLOR[instrument.capability]} emissiveIntensity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function SpacecraftPreview({ design, label }: { design: MissionDesign; label: string }) {
  if (!isWebGLAvailable()) return null;
  return (
    <div role="img" aria-label={label} data-testid="spacecraft-preview" className="mt-3 h-56 overflow-hidden rounded-2xl border border-panel-border bg-black sm:h-64">
      <Canvas camera={{ position: [0, 1.1, 5.5], fov: 40 }}>
        <color attach="background" args={['#05070c']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 5, 6]} intensity={2.6} />
        <directionalLight position={[-5, -2, 3]} intensity={0.7} color="#7dd3fc" />
        <Craft design={design} />
      </Canvas>
    </div>
  );
}
