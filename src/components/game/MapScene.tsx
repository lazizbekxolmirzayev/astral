'use client';

import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import type { DestinationId } from '@/mission';
import { DESTINATION_IDS } from '@/mission';
import { planets, SUN_LOOK } from '../3d/layout';
import { MAP_ANCHORS, MAP_EARTH, MAP_EARTH_ORBIT_RADIUS, MAP_MARS, MAP_MOON, MAP_OVERVIEW, MAP_RINGS, MAP_SUN, ringPoint, ringPoints, type Vec3 } from '@/game/mapLayout';
import { CameraDirector } from './CameraDirector';
import { GamePlanet, GameSun } from './GamePlanet';
import { LabelAnchor } from './labels';

const EARTH_LOOK = planets.find((planet) => planet.id === 'earth')!;
const MARS_LOOK = planets.find((planet) => planet.id === 'mars')!;
const MOON_LOOK = { mode: 'blobs' as const, palette: ['#3b3b3d', '#6d6d70', '#9c9c9f', '#c4c4c6'], seed: 77, scale: 5, seaLevel: 0.45 };

const RING_COLOR: Record<'leo' | 'sso' | 'geo', string> = { leo: '#5cf2ff', sso: '#9d8bff', geo: '#ffd166' };

/** A satellite dot that circles one of the Earth rings, so the map is alive. */
function Satellite({ radius, tilt, speed, phase, color }: { radius: number; tilt: number; speed: number; phase: number; color: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const [x, y, z] = ringPoint(radius, tilt, phase + clock.elapsedTime * speed);
    ref.current.position.set(x, y, z);
  });
  return (
    <mesh ref={ref} raycast={() => null}>
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Marker({ id, selected, hovered, onPick, onHover }: { id: DestinationId; selected: boolean; hovered: boolean; onPick: (id: DestinationId) => void; onHover: (id: DestinationId | null) => void }) {
  const anchor = MAP_ANCHORS[id];
  const pulse = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const wave = 1 + 0.16 * Math.sin(clock.elapsedTime * 2.6 + id.length);
    pulse.current.scale.setScalar(wave * (selected ? 1.35 : hovered ? 1.2 : 1));
    pulse.current.rotation.y = clock.elapsedTime * 0.8;
  });
  const color = selected ? '#00f0ff' : hovered ? '#ffffff' : '#7dd3fc';
  return (
    <group position={anchor.position}>
      <group ref={pulse}>
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[0.55, 0.035, 8, 48]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh raycast={() => null}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {/* a generous invisible target, so the marker is easy to hit */}
      <mesh
        onClick={(event) => { event.stopPropagation(); onPick(id); }}
        onPointerOver={(event) => { event.stopPropagation(); onHover(id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
      >
        <sphereGeometry args={[1.15, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <LabelAnchor id={`dest:${id}`} position={[anchor.position[0], anchor.position[1] + 1.25, anchor.position[2]]} />
    </group>
  );
}

/**
 * The solar-system map: the player's first screen. The destinations are objects in the scene; clicking one
 * flies the camera to it. Stylised and not to scale (see `src/game/mapLayout.ts`).
 */
export function MapScene({ focus, onFocus }: { focus: DestinationId | null; onFocus: (id: DestinationId) => void }) {
  const [hover, setHover] = useState<DestinationId | null>(null);
  const moonPosition = useMemo(() => ringPoint(MAP_MOON.orbitRadius, MAP_MOON.tilt, MAP_MOON.angle), []);
  const rings = useMemo(
    () => ({
      leo: ringPoints(MAP_RINGS.leo.radius, MAP_RINGS.leo.tilt),
      sso: ringPoints(MAP_RINGS.sso.radius, MAP_RINGS.sso.tilt),
      geo: ringPoints(MAP_RINGS.geo.radius, MAP_RINGS.geo.tilt),
      moon: ringPoints(MAP_MOON.orbitRadius, MAP_MOON.tilt, [0, 0, 0], 160),
      helio: ringPoints(MAP_RINGS.helio.radius, MAP_RINGS.helio.tilt, MAP_SUN.position, 200),
      earthOrbit: ringPoints(MAP_EARTH_ORBIT_RADIUS, 0, MAP_SUN.position, 240),
      marsOrbit: ringPoints(Math.hypot(MAP_MARS.position[0] - MAP_SUN.position[0], MAP_MARS.position[2] - MAP_SUN.position[2]), 0, MAP_SUN.position, 240),
    }),
    [],
  );
  const pose = (id: DestinationId | null) => (id ? MAP_ANCHORS[id].camera : MAP_OVERVIEW);
  const line = (points: Vec3[], color: string, width: number, opacity: number, dashed = false) => (
    <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} dashed={dashed} dashSize={0.5} gapSize={0.5} raycast={() => null} />
  );

  return (
    <>
      <CameraDirector getPose={() => pose(focus)} damping={1.8} sway={0.25} snapKey="map" />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-30, 8, 14]} intensity={3.4} color="#fff2dd" />
      <pointLight position={[MAP_SUN.position[0] + 12, 2, MAP_SUN.position[2] + 4]} intensity={500} distance={140} color="#ffcf8a" />

      <GameSun radius={MAP_SUN.radius} look={SUN_LOOK} position={MAP_SUN.position} intensity={1.5} />
      <GamePlanet radius={MAP_EARTH.radius} look={EARTH_LOOK.look} position={MAP_EARTH.position} spin={0.06} atmosphere={EARTH_LOOK.atmosphere} cloudCover={EARTH_LOOK.cloudCover} nightLights />
      <GamePlanet radius={MAP_MOON.radius} look={MOON_LOOK} position={moonPosition} spin={0.02} />
      <GamePlanet radius={MAP_MARS.radius} look={MARS_LOOK.look} position={MAP_MARS.position} spin={0.05} atmosphere={MARS_LOOK.atmosphere} />

      {line(rings.leo, RING_COLOR.leo, focus === 'leo' ? 2.6 : 1.4, focus === 'leo' ? 1 : 0.55)}
      {line(rings.sso, RING_COLOR.sso, focus === 'sso' ? 2.6 : 1.4, focus === 'sso' ? 1 : 0.55)}
      {line(rings.geo, RING_COLOR.geo, focus === 'geo' ? 2.6 : 1.4, focus === 'geo' ? 1 : 0.55)}
      {line(rings.moon, '#9fb1c8', focus === 'moon' ? 2 : 1, focus === 'moon' ? 0.8 : 0.3, true)}
      {line(rings.helio, '#ffb347', focus === 'helio' ? 2.6 : 1.4, focus === 'helio' ? 1 : 0.5)}
      {line(rings.earthOrbit, '#4b6a96', 0.8, 0.28, true)}
      {line(rings.marsOrbit, '#8a5a48', 0.8, 0.28, true)}

      <Satellite radius={MAP_RINGS.leo.radius} tilt={MAP_RINGS.leo.tilt} speed={0.9} phase={0.2} color={RING_COLOR.leo} />
      <Satellite radius={MAP_RINGS.leo.radius} tilt={MAP_RINGS.leo.tilt} speed={0.9} phase={3.4} color={RING_COLOR.leo} />
      <Satellite radius={MAP_RINGS.sso.radius} tilt={MAP_RINGS.sso.tilt} speed={0.7} phase={1.1} color={RING_COLOR.sso} />
      <Satellite radius={MAP_RINGS.geo.radius} tilt={MAP_RINGS.geo.tilt} speed={0.25} phase={0.4} color={RING_COLOR.geo} />
      <Satellite radius={MAP_RINGS.geo.radius} tilt={MAP_RINGS.geo.tilt} speed={0.25} phase={2.5} color={RING_COLOR.geo} />

      {DESTINATION_IDS.map((id) => (
        <Marker key={id} id={id} selected={focus === id} hovered={hover === id} onPick={onFocus} onHover={setHover} />
      ))}
    </>
  );
}
