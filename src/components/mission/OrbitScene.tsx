'use client';

import { Line, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import type { OrbitLayout } from '@/mission/orbitLayout';

const BODY_COLORS: Record<OrbitLayout['body'], string> = { earth: '#2f6fb5', moon: '#9a9a9a', mars: '#b5532f', sun: '#f2b632' };

function circle(radius: number, segments = 96): Array<[number, number, number]> {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
  });
}

export default function OrbitScene({ layout }: { layout: OrbitLayout }) {
  const distance = Math.max(layout.extent, 1.2) * 2.6;
  const path = useMemo(() => layout.path.map((point) => [point[0], point[1], point[2]] as [number, number, number]), [layout.path]);
  const marker = Math.max(layout.extent, 1) * 0.035;
  const nodeLine: Array<[number, number, number]> = [[-layout.extent * 1.15, 0, 0], [layout.extent * 1.15, 0, 0]];
  return (
    <Canvas camera={{ position: [distance * 0.7, distance * 0.55, distance * 0.8], fov: 40, near: 0.001, far: distance * 60 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#070a10']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 8, 5]} intensity={1.5} />
      <mesh>
        <sphereGeometry args={[layout.bodyRadius, 48, 32]} />
        <meshStandardMaterial color={BODY_COLORS[layout.body]} emissive={layout.body === 'sun' ? '#f2b632' : '#000000'} emissiveIntensity={layout.body === 'sun' ? 0.8 : 0} roughness={0.8} />
      </mesh>
      {layout.references.map((reference) => (
        <Line key={reference.kind} points={circle(reference.radius)} color={reference.kind === 'earth-orbit' ? '#3b82f6' : '#475569'} lineWidth={1} dashed={reference.kind === 'earth-orbit'} dashSize={reference.radius * 0.04} gapSize={reference.radius * 0.03} />
      ))}
      <Line points={nodeLine} color="#64748b" lineWidth={1} />
      <Line points={path} color="#00f0ff" lineWidth={2.2} />
      <mesh position={layout.periapsis as [number, number, number]}>
        <sphereGeometry args={[marker, 16, 12]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>
      <mesh position={layout.apoapsis as [number, number, number]}>
        <sphereGeometry args={[marker, 16, 12]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>
      <OrbitControls makeDefault enableDamping minDistance={Math.max(layout.bodyRadius * 1.2, 0.05)} maxDistance={distance * 5} />
    </Canvas>
  );
}
