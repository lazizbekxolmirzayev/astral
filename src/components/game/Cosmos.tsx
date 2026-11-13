'use client';

import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Object3D, Vector3, type Group, type InstancedMesh } from 'three';
import { removeAnchors, setAnchor } from './labels';
import { skyLevel } from '@/game/skyLevel';
import type { TextureLook } from '../3d/proceduralTextures';
import { createGlowTexture, GLOW_BLENDING } from '../3d/proceduralTextures';
import { mulberry32 } from '@/lib/random';
import { planets } from '../3d/layout';
import { BELT_MAX_AU, BELT_MIN_AU } from '../3d/layout';
import { GAME_SUN_DIRECTION, GamePlanet } from './GamePlanet';

/**
 * The rest of the Solar System around a heliocentric flight, so the spacecraft really is "out in the cosmos": the other
 * planets on circles of their real mean distance, the main asteroid belt, and faint orbit lines.
 *
 * PROVENANCE: distances and orbital periods are real mean values (JPL "Keplerian elements for approximate positions",
 * J2000 mean longitude + mean motion); orbits are drawn as circles, so a planet may be a few percent off its true place.
 * Planet sizes are exaggerated to be visible and the surfaces are procedural.
 */
const ELEMENTS: Record<string, { au: number; longitude0: number; degPerDay: number }> = {
  mercury: { au: 0.387, longitude0: 252.25, degPerDay: 4.0923 },
  venus: { au: 0.723, longitude0: 181.98, degPerDay: 1.6021 },
  jupiter: { au: 5.203, longitude0: 34.4, degPerDay: 0.0831 },
  saturn: { au: 9.537, longitude0: 49.94, degPerDay: 0.0335 },
  uranus: { au: 19.19, longitude0: 313.23, degPerDay: 0.0117 },
  neptune: { au: 30.07, longitude0: 304.88, degPerDay: 0.006 },
};
const J2000_MS = Date.UTC(2000, 0, 1, 12);

const ring = (radius: number): [number, number, number][] => Array.from({ length: 129 }, (_, index) => {
  const angle = (index / 128) * Math.PI * 2;
  return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
});

/** `scale` converts AU to scene units; `extent` is the frame's size in AU (planets are drawn relative to it). */
export function Cosmos({ scale, extent, epochMs }: { scale: number; extent: number; epochMs: number }) {
  const days = (epochMs - J2000_MS) / 86_400_000;
  const belt = useMemo(() => {
    const random = mulberry32(4242);
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = BELT_MIN_AU + (BELT_MAX_AU - BELT_MIN_AU) * Math.sqrt(random());
      const angle = random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius * scale;
      positions[index * 3 + 1] = (random() - 0.5) * 0.18 * scale;
      positions[index * 3 + 2] = Math.sin(angle) * radius * scale;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return geometry;
  }, [scale]);
  useEffect(() => () => belt.dispose(), [belt]);
  const beltColor = useMemo(() => new Color('#d2c2a6'), []);
  const rocks = useRef<InstancedMesh>(null);
  const rockCount = 260;
  // asteroids: real lumpy rocks (not just dust), each its own size and tumble, spread over the main belt
  useEffect(() => {
    const mesh = rocks.current;
    if (!mesh) return;
    const random = mulberry32(9001);
    const dummy = new Object3D();
    for (let index = 0; index < rockCount; index += 1) {
      const radius = BELT_MIN_AU + (BELT_MAX_AU - BELT_MIN_AU) * Math.sqrt(random());
      const angle = random() * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius * scale, (random() - 0.5) * 0.1 * scale, Math.sin(angle) * radius * scale);
      dummy.rotation.set(random() * 6, random() * 6, random() * 6);
      const size = extent * scale * (0.0025 + random() * random() * 0.007);
      dummy.scale.set(size * (0.7 + random() * 0.6), size * (0.7 + random() * 0.6), size * (0.7 + random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, new Color().setHSL(0.08 + random() * 0.04, 0.12 + random() * 0.2, 0.32 + random() * 0.3));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [scale, extent]);
  // names for every planet, so the cosmos can be read like a map
  useEffect(() => {
    for (const planet of planets) {
      const element = ELEMENTS[planet.id];
      if (!element) continue;
      const angle = ((element.longitude0 + element.degPerDay * days) * Math.PI) / 180;
      const radius = element.au * scale;
      const drawn = Math.max(0.1, extent * scale * 0.02 * (planet.radius / 0.66) * 0.8);
      setAnchor(`flight:body-${planet.id}`, [Math.cos(angle) * radius, drawn + 0.45, Math.sin(angle) * radius]);
    }
    return () => removeAnchors('flight:body-');
  }, [days, scale, extent]);
  return (
    <group>
      <points geometry={belt} frustumCulled={false} raycast={() => null}>
        <pointsMaterial size={0.14} sizeAttenuation color={beltColor} transparent opacity={0.85} depthWrite={false} />
      </points>
      <instancedMesh ref={rocks} args={[undefined, undefined, rockCount]} frustumCulled={false} raycast={() => null}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0.05} flatShading />
      </instancedMesh>
      {planets.filter((planet) => ELEMENTS[planet.id]).map((planet) => {
        const element = ELEMENTS[planet.id]!;
        const angle = ((element.longitude0 + element.degPerDay * days) * Math.PI) / 180;
        const radius = element.au * scale;
        const drawn = Math.max(0.1, extent * scale * 0.02 * (planet.radius / 0.66) * 0.8);
        return (
          <group key={planet.id}>
            <Line points={ring(radius)} color="#5b6b85" lineWidth={1} transparent opacity={0.35} raycast={() => null} />
            <GamePlanet radius={drawn} look={planet.look} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} spin={planet.spin * 0.2} atmosphere={planet.atmosphere} />
            {planet.ring ? (
              <mesh position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} rotation={[Math.PI / 2 - planet.ring.tilt, 0, 0]} raycast={() => null}>
                <ringGeometry args={[drawn * planet.ring.inner, drawn * planet.ring.outer, 72]} />
                <meshBasicMaterial color={planet.ring.color} transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

const SUN_DIR = new Vector3(...GAME_SUN_DIRECTION).normalize();
const BRIGHTNESS: Record<string, number> = { mercury: 3.2, venus: 9, mars: 5.5, jupiter: 8, saturn: 6, uranus: 2.4, neptune: 2 };
const EARTH_ELEMENT = { au: 1, longitude0: 100.46, degPerDay: 0.9856 };

/**
 * The sky seen from Earth or the Moon: the Sun's glare in the direction the game lights the scene from, and the planets
 * as bright points at the directions they really have from Earth (circular-orbit approximation), so a flight around Earth
 * sits inside the same Solar System as the cruise to Mars.
 */
export function SkyPlanets({ epochMs, sunDirection = SUN_DIR, showSun = true, labels = true }: { epochMs: number; sunDirection?: Vector3; showSun?: boolean; labels?: boolean }) {
  const days = (epochMs - J2000_MS) / 86_400_000;
  const glow = useMemo(() => createGlowTexture('#fff2cc', 'rgba(255,200,120,0)'), []);
  const dot = useMemo(() => createGlowTexture('#ffffff', 'rgba(255,255,255,0)'), []);
  useEffect(() => () => { glow.dispose(); dot.dispose(); }, [glow, dot]);
  const sprites = useMemo(() => {
    const earthAngle = ((EARTH_ELEMENT.longitude0 + EARTH_ELEMENT.degPerDay * days) * Math.PI) / 180;
    const earth: [number, number] = [Math.cos(earthAngle), Math.sin(earthAngle)];
    // basis of the ecliptic plane that contains the game's sun direction
    const up = new Vector3(0, 1, 0);
    const normal = up.clone().sub(sunDirection.clone().multiplyScalar(up.dot(sunDirection))).normalize();
    const e2 = new Vector3().crossVectors(normal, sunDirection).normalize();
    const sunAngle = Math.atan2(-earth[1], -earth[0]);
    return planets.filter((planet) => ELEMENTS[planet.id]).map((planet) => {
      const element = ELEMENTS[planet.id]!;
      const angle = ((element.longitude0 + element.degPerDay * days) * Math.PI) / 180;
      const toward = Math.atan2(Math.sin(angle) * element.au - earth[1], Math.cos(angle) * element.au - earth[0]) - sunAngle;
      const direction = sunDirection.clone().multiplyScalar(Math.cos(toward)).add(e2.clone().multiplyScalar(Math.sin(toward))).multiplyScalar(900);
      return { id: planet.id, color: planet.color, size: BRIGHTNESS[planet.id] ?? 2, position: direction.toArray() as [number, number, number] };
    });
  }, [days, sunDirection]);
  useEffect(() => {
    if (!labels) return;
    for (const sprite of sprites) setAnchor(`flight:body-${sprite.id}`, [sprite.position[0], sprite.position[1] + sprite.size * 2.2, sprite.position[2]]);
    return () => removeAnchors('flight:body-');
  }, [sprites, labels]);
  return (
    <group>
      {showSun ? <sprite position={sunDirection.clone().multiplyScalar(900).toArray()} scale={[420, 420, 1]} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.95} fog={false} />
      </sprite> : null}
      {sprites.map((sprite) => (
        <sprite key={sprite.id} position={sprite.position} scale={[sprite.size * 5, sprite.size * 5, 1]} raycast={() => null}>
          <spriteMaterial map={dot} color={sprite.color} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.95} fog={false} />
        </sprite>
      ))}
    </group>
  );
}


/** Where the Sun, the Moon and the planets are in the launch sky: upper left, upper centre-right, in view of the pad cameras. */
const LAUNCH_SUN_DIR = new Vector3(-0.811, 0.375, -0.45).normalize();
const LAUNCH_MOON_DIR = new Vector3(-0.12, 0.5, -0.857).normalize();

/**
 * The sky of the launch: a Sun with its glare (also in daylight), the Moon (a stylised size; the real one is a quarter
 * of that), and by night/space the planets at their real directions from Earth. It rides with the camera, so it is
 * always at the same place in the sky. By day the stars and planets are hidden by the blue of the air.
 */
const PALE_MOON: Pick<TextureLook, 'palette'> = { palette: ['#8e8e90', '#b3b3b4', '#d4d4d2', '#ecece9'] };

export function LaunchSkyBodies({ epochMs, moonLook }: { epochMs: number; moonLook: TextureLook }) {
  // seen through daylight the Moon is pale, so it gets lighter greys than the close-up one
  const look = useMemo<TextureLook>(() => ({ ...moonLook, ...PALE_MOON }), [moonLook]);
  const group = useRef<Group>(null);
  const planetsGroup = useRef<Group>(null);
  const { camera } = useThree();
  const glow = useMemo(() => createGlowTexture('#fff4d6', 'rgba(255,214,140,0)'), []);
  const core = useMemo(() => createGlowTexture('#ffffff', 'rgba(255,250,235,0)'), []);
  useEffect(() => () => { glow.dispose(); core.dispose(); }, [glow, core]);
  useFrame(() => {
    if (group.current) group.current.position.copy(camera.position);
    if (planetsGroup.current) planetsGroup.current.visible = skyLevel.value < 0.55;
  });
  return (
    <group ref={group}>
      <sprite position={LAUNCH_SUN_DIR.clone().multiplyScalar(200).toArray()} scale={[150, 150, 1]} renderOrder={-8} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} depthTest={false} opacity={0.9} fog={false} />
      </sprite>
      <sprite position={LAUNCH_SUN_DIR.clone().multiplyScalar(200).toArray()} scale={[56, 56, 1]} renderOrder={-7} raycast={() => null}>
        <spriteMaterial map={core} blending={GLOW_BLENDING} transparent depthWrite={false} depthTest={false} opacity={1} fog={false} />
      </sprite>
      <GamePlanet radius={7.5} look={look} position={LAUNCH_MOON_DIR.clone().multiplyScalar(200).toArray()} spin={0.01} segments={48} selfLight={0.75} />
      <group ref={planetsGroup}>
        <SkyPlanets epochMs={epochMs} sunDirection={LAUNCH_SUN_DIR} showSun={false} labels={false} />
      </group>
    </group>
  );
}
