'use client';

import { Edges, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import type { PartShape, ShapeRole } from '@/mission/spacecraftLayout';

/** Colours by role. Artistic choices for legibility, not physical colours. */
export const ROLE_COLORS: Record<ShapeRole, string> = {
  bus: '#8c9bb0',
  tank: '#c9a227',
  nozzle: '#6b7280',
  panel: '#2563eb',
  dish: '#e5e7eb',
  mast: '#9ca3af',
  battery: '#34d399',
  computer: '#8b7cf6',
  attitude: '#fb923c',
  instrument: '#22d3ee',
};

type Props = {
  shapes: PartShape[];
  extent: number;
  selectedId: string | null;
  onSelect: (itemId: string | null) => void;
};

function Shape({ shape, selected, onSelect }: { shape: PartShape; selected: boolean; onSelect: (itemId: string | null) => void }) {
  const [hovered, setHovered] = useState(false);
  const isBus = shape.role === 'bus';
  const color = ROLE_COLORS[shape.role];
  const [sx, sy, sz] = shape.size;
  const emphasis = selected ? 0.65 : hovered ? 0.3 : 0;

  const geometry =
    shape.geometry === 'box' ? <boxGeometry args={[sx, sy, sz]} /> : <cylinderGeometry args={[sx, sx, sy, 32]} />;
  const rotation: [number, number, number] = shape.role === 'dish' || shape.role === 'mast' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  // Dish and mast are cylinders whose own axis is y; they are turned so the axis runs along z.

  return (
    <group position={shape.position} rotation={rotation}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(shape.itemId);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        {geometry}
        {isBus ? <Edges color={selected ? '#00f0ff' : '#9fb0c8'} /> : null}
        <meshStandardMaterial
          color={color}
          transparent={isBus}
          opacity={isBus ? 0.28 : 1}
          emissive={selected ? '#00f0ff' : color}
          emissiveIntensity={emphasis}
          metalness={0.35}
          roughness={0.55}
          depthWrite={!isBus}
        />
      </mesh>
      {shape.role === 'tank' && shape.fill !== undefined && shape.fill > 0 ? (
        <mesh position={[0, -sy / 2 + (sy * shape.fill) / 2, 0]} raycast={() => null}>
          <cylinderGeometry args={[sx * 0.9, sx * 0.9, sy * shape.fill, 24]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.25} />
        </mesh>
      ) : null}
    </group>
  );
}

export default function SpacecraftScene({ shapes, extent, selectedId, onSelect }: Props) {
  const distance = Math.max(extent, 0.5) * 2.1;
  return (
    <Canvas
      camera={{ position: [distance * 0.8, distance * 0.55, distance], fov: 40, near: 0.05, far: distance * 40 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#070a10']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 5]} intensity={1.6} />
      <directionalLight position={[-5, -3, -4]} intensity={0.35} color="#6c5ce7" />
      <gridHelper args={[Math.max(10, extent * 6), 20, '#1f2937', '#111827']} position={[0, -Math.max(extent, 0.5) * 1.05, 0]} />
      {shapes.map((shape) => (
        <Shape key={shape.key} shape={shape} selected={selectedId === shape.itemId} onSelect={onSelect} />
      ))}
      <OrbitControls makeDefault enableDamping minDistance={Math.max(extent, 0.5) * 0.8} maxDistance={distance * 4} />
    </Canvas>
  );
}
