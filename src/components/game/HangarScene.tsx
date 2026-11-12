'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { AdditiveBlending, DoubleSide, type Group } from 'three';
import { LAUNCHERS, type Mission } from '@/mission';
import { layoutSpacecraft } from '@/mission/spacecraftLayout';
import type { HangarView } from '@/game/gameStore';
import { CameraDirector } from './CameraDirector';
import { LabelAnchor } from './labels';
import { RocketModel, ROCKET_LOOKS } from './RocketModel';
import { ShipModel } from './ShipModel';

export const SHIP_STAND: [number, number, number] = [-5, 0, 0];
const RACK_Z = -6;
/** Where each launcher stands in the rocket bay (x), left to right by size. */
const RACK_X: Record<string, number> = { 'launcher-small': 2, 'launcher-medium': 6.4, 'launcher-heavy': 11.6, 'launcher-super-heavy': 17.8 };

function Beam({ position, color = '#7fd8ff', height = 14 }: { position: [number, number, number]; color?: string; height?: number }) {
  return (
    <mesh position={[position[0], height / 2, position[2]]} raycast={() => null}>
      <cylinderGeometry args={[0.15, 2.2, height, 32, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.022} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

function PadRing({ radius, color, intensity }: { radius: number; color: string; intensity: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} raycast={() => null}>
      <ringGeometry args={[radius * 0.92, radius, 64]} />
      <meshBasicMaterial color={color} transparent opacity={intensity} />
    </mesh>
  );
}

function RocketStand({ id, selected, onPick }: { id: string; selected: boolean; onPick: (id: string) => void }) {
  const launcher = LAUNCHERS.find((entry) => entry.id === id)!;
  const look = ROCKET_LOOKS[launcher.sizeClass];
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = selected ? 0.18 + Math.sin(clock.elapsedTime * 1.6) * 0.06 : 0;
  });
  const x = RACK_X[id] ?? 0;
  return (
    <group position={[x, 0, RACK_Z]}>
      <mesh position={[0, 0.12, 0]} raycast={() => null}>
        <cylinderGeometry args={[look.radius * 2.6, look.radius * 2.9, 0.24, 40]} />
        <meshStandardMaterial color="#141a26" metalness={0.8} roughness={0.35} />
      </mesh>
      <PadRing radius={look.radius * 2.6} color={selected ? '#00f0ff' : hovered ? '#ffffff' : '#334155'} intensity={selected ? 1 : hovered ? 0.8 : 0.6} />
      <group ref={group} position={[0, 0.24, 0]}>
        <RocketModel rocket={launcher.sizeClass} highlight={selected ? 1 : hovered ? 0.5 : 0} />
      </group>
      {selected ? <pointLight position={[0, look.height * 0.6, 3]} intensity={30} distance={14} color="#7fe9ff" /> : null}
      <mesh
        position={[0, look.height / 2, 0]}
        onClick={(event) => { event.stopPropagation(); onPick(id); }}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
      >
        <cylinderGeometry args={[look.radius * 2.4 + 0.4, look.radius * 2.4 + 0.4, look.height + 0.6, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <LabelAnchor id={`rocket:${id}`} position={[x, look.height + 1.2, RACK_Z]} />
    </group>
  );
}

/** The hangar: the spacecraft on its stand and the four launch vehicles in the rocket bay. */
export function HangarScene({ mission, view, onPickRocket }: { mission: Mission; view: HangarView; onPickRocket: (id: string) => void }) {
  const layout = useMemo(() => layoutSpacecraft(mission), [mission]);
  const ship = useRef<Group>(null);
  const holo = useRef<Group>(null);
  useFrame((_state, delta) => {
    if (ship.current) ship.current.rotation.y += delta * 0.32;
    if (holo.current) holo.current.rotation.y -= delta * 0.5;
  });
  const shipPose = { position: [-3.2, 4.2, 7.4] as const, target: [SHIP_STAND[0] + 0.4, 2.5, 0] as const };
  const rackPose = { position: [14.5, 8.5, 27] as const, target: [14.5, 7.4, RACK_Z] as const };

  return (
    <>
      <CameraDirector getPose={() => (view === 'ship' ? shipPose : rackPose)} damping={1.9} sway={0.2} snapKey="hangar" />
      <color attach="background" args={['#05080f']} />
      <fog attach="fog" args={['#05080f', 28, 70]} />
      <ambientLight intensity={0.35} />
      <spotLight position={[-5, 16, 6]} angle={0.5} penumbra={0.8} intensity={900} distance={50} color="#cfe7ff" />
      <spotLight position={[10, 18, 6]} angle={0.7} penumbra={0.9} intensity={700} distance={60} color="#ffe2c2" />
      <pointLight position={[-9, 3, 5]} intensity={45} distance={22} color="#5ad0ff" />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, -0.01, -3]} raycast={() => null}>
        <circleGeometry args={[46, 72]} />
        <meshStandardMaterial color="#0b111c" metalness={0.85} roughness={0.28} />
      </mesh>
      <gridHelper args={[90, 90, '#16304a', '#0f1d2e']} position={[3, 0.005, -3]} />

      {/* the back wall of the hangar: ribs and a glowing strip */}
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[-14 + index * 5.2, 9, -15]} raycast={() => null}>
          <boxGeometry args={[0.5, 18, 1]} />
          <meshStandardMaterial color="#111826" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[8, 17.5, -15]} raycast={() => null}>
        <boxGeometry args={[48, 0.6, 1.2]} />
        <meshStandardMaterial color="#0e1522" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[8, 0.9, -14.4]} raycast={() => null}>
        <boxGeometry args={[46, 0.12, 0.1]} />
        <meshBasicMaterial color="#1cc8ff" />
      </mesh>

      {/* spacecraft stand */}
      <group position={SHIP_STAND}>
        <mesh position={[0, 0.25, 0]} raycast={() => null}>
          <cylinderGeometry args={[2.4, 2.7, 0.5, 48]} />
          <meshStandardMaterial color="#121a28" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[2.0, 2.2, 64]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <Beam position={[0, 0, 0]} />
        <group ref={holo} position={[0, 2.5, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
            <torusGeometry args={[2.35, 0.012, 8, 96]} />
            <meshBasicMaterial color="#5ad0ff" transparent opacity={0.55} />
          </mesh>
          <mesh rotation={[Math.PI / 2.6, 0, 0]} raycast={() => null}>
            <torusGeometry args={[2.0, 0.008, 8, 96]} />
            <meshBasicMaterial color="#9d8bff" transparent opacity={0.4} />
          </mesh>
        </group>
        <group ref={ship} position={[0, 2.5, 0]}>
          <ShipModel shapes={layout.shapes} extent={layout.extent} radius={2.3} />
        </group>
      </group>

      {/* rocket bay */}
      {LAUNCHERS.map((launcher) => (
        <RocketStand key={launcher.id} id={launcher.id} selected={mission.launch.vehicleId === launcher.id} onPick={onPickRocket} />
      ))}
    </>
  );
}
