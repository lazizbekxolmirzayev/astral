'use client';

import { Line, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Vec3 } from '@/physics/orbits';
import type { SceneFrame } from '@/mission/sim';

const BODY_COLORS: Record<string, string> = { earth: '#2f6fb5', moon: '#9a9a9a', mars: '#b5532f', sun: '#f2b632' };
const PATH_STYLE: Record<string, { color: string; width: number }> = {
  operational: { color: '#00f0ff', width: 2.2 },
  transfer: { color: '#fbbf24', width: 2.2 },
  parking: { color: '#64748b', width: 1.2 },
  reference: { color: '#475569', width: 1 },
};

const triple = (point: Vec3): [number, number, number] => [point[0], point[1], point[2]];

/**
 * The simulation drawn from `SceneFrame` and the spacecraft position. It owns no motion: every
 * position is passed in, so what is drawn is exactly what the simulation state says.
 */
export default function SimulationScene({ frame, craft, trail, lost }: { frame: SceneFrame; craft: Vec3; trail: Vec3[]; lost: boolean }) {
  const distance = Math.max(frame.extent, 1.2) * 2.6;
  const marker = Math.max(frame.extent, 1) * 0.025;
  const trailPoints = useMemo(() => trail.map(triple), [trail]);
  return (
    <Canvas camera={{ position: [distance * 0.7, distance * 0.55, distance * 0.8], fov: 40, near: distance * 1e-5, far: distance * 80 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#070a10']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 8, 5]} intensity={1.5} />
      {frame.bodies.map((body) => (
        <mesh key={`${body.id}-${body.position.join(',')}`} position={triple(body.position)}>
          <sphereGeometry args={[body.radius, 40, 28]} />
          <meshStandardMaterial color={BODY_COLORS[body.id] ?? '#888888'} emissive={body.id === 'sun' ? '#f2b632' : '#000000'} emissiveIntensity={body.id === 'sun' ? 0.8 : 0} roughness={0.8} />
        </mesh>
      ))}
      {frame.paths.map((path, index) => {
        const style = PATH_STYLE[path.kind] ?? PATH_STYLE.reference!;
        return <Line key={`${path.kind}-${index}`} points={path.points.map(triple)} color={style.color} lineWidth={style.width} dashed={path.dashed} dashSize={frame.extent * 0.03} gapSize={frame.extent * 0.02} />;
      })}
      {frame.target ? (
        <mesh position={triple(frame.target)}>
          <sphereGeometry args={[marker * 0.8, 14, 10]} />
          <meshBasicMaterial color="#34d399" wireframe />
        </mesh>
      ) : null}
      {trailPoints.length > 1 ? <Line points={trailPoints} color="#f472b6" lineWidth={2} /> : null}
      <mesh position={triple(craft)}>
        <octahedronGeometry args={[marker, 0]} />
        <meshBasicMaterial color={lost ? '#f87171' : '#ffffff'} />
      </mesh>
      <OrbitControls makeDefault enableDamping minDistance={Math.max(frame.extent * 0.02, 0.002)} maxDistance={distance * 6} />
    </Canvas>
  );
}
