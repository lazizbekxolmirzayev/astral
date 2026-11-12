'use client';

import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial, type Group, type Mesh, type Object3D } from 'three';
import { craftState, craftTrail, frameKeyOf, frameOf, operationalCraft, operationalTrail, type SceneFrame, type SimPlan } from '@/mission/sim';
import { blast, setThrust } from '@/game/audio';
import { usesVisualOrbit, visualOrbitSeconds } from '@/game/orbitPacing';
import { layoutSpacecraft } from '@/mission/spacecraftLayout';
import { simStore } from '@/stores/simStore';
import { planets, SUN_LOOK } from '../3d/layout';
import { createGlowTexture, GLOW_BLENDING } from '../3d/proceduralTextures';
import { CameraDirector, type CameraPose } from './CameraDirector';
import { GamePlanet, GameSun } from './GamePlanet';
import { ascentPose, padThrottle, skyAmount } from './launchPath';
import { Plume } from './Particles';
import { RocketModel, ROCKET_LOOKS, type RocketClass } from './RocketModel';
import { ShipModel } from './ShipModel';

const EARTH = planets.find((planet) => planet.id === 'earth')!;
const MARS = planets.find((planet) => planet.id === 'mars')!;
/** The rocket is drawn larger than life on the pad so it reads on screen next to the tower. */
const LAUNCH_SCALE = 2.3;
const MOON_LOOK = { mode: 'blobs' as const, palette: ['#3b3b3d', '#6d6d70', '#9c9c9f', '#c4c4c6'], seed: 77, scale: 5, seaLevel: 0.45 };

/** Advances the simulation from the frame clock; the only place that drives time in the game. */
export function SimDriver() {
  useFrame((_state, delta) => simStore.getState().tick(delta));
  return null;
}

/* ------------------------------------------------------------------ the launch */

const SKY_VERTEX = `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAGMENT = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform float uAlpha;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uHorizon, uTop, pow(h, 0.7));
  gl_FragColor = vec4(c, uAlpha);
}`;

function Gantry() {
  const steel = { color: '#2b3444', metalness: 0.6, roughness: 0.55 } as const;
  return (
    <group position={[-5.2, 0, 0]} scale={[1.5, 1.7, 1.5]}>
      <mesh position={[0, 9, 0]} raycast={() => null}><boxGeometry args={[1.1, 18, 1.1]} /><meshStandardMaterial {...steel} /></mesh>
      {[3, 7, 11, 15].map((y) => (
        <mesh key={y} position={[1.2, y, 0]} raycast={() => null}><boxGeometry args={[2.4, 0.18, 0.5]} /><meshStandardMaterial {...steel} /></mesh>
      ))}
      <mesh position={[0, 18.4, 0]} raycast={() => null}><coneGeometry args={[0.5, 1.4, 4]} /><meshStandardMaterial color="#8a93a4" metalness={0.7} roughness={0.4} /></mesh>
      <mesh position={[0, 18.9, 0]} raycast={() => null}><sphereGeometry args={[0.12, 8, 8]} /><meshBasicMaterial color="#ff4040" /></mesh>
    </group>
  );
}

/**
 * Pad, ascent and the explosion of a failed launch. `progress` is read through a getter every frame, so the
 * scene follows the simulation (pre-launch / launch stage progress) without re-rendering React.
 */
export function LaunchScene({ rocket, read }: { rocket: RocketClass; read: () => LaunchRead }) {
  const { scene } = useThree();
  const rocketGroup = useRef<Group>(null);
  const flameEmitter = useRef<Object3D | null>(null);
  const smokeEmitter = useRef<Object3D | null>(null);
  const burstEmitter = useRef<Object3D | null>(null);
  const flameThrottle = useRef(0);
  const smokeThrottle = useRef(0);
  const burstThrottle = useRef(0);
  const dome = useRef<Group>(null);
  const skyRef = useRef<ShaderMaterial>(null);
  const ground = useRef<Mesh>(null);
  const failedAt = useRef<number | null>(null);
  const smokeFlash = useRef<Mesh>(null);
  const poseRef = useRef<CameraPose>({ position: [14, 4, 22], target: [0, 6, 0] });

  const sky = useMemo(
    () => new ShaderMaterial({ uniforms: { uTop: { value: new Color('#16356b') }, uHorizon: { value: new Color('#e9a27a') }, uAlpha: { value: 1 } }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, side: BackSide }),
    [],
  );
  const glow = useMemo(() => createGlowTexture('#ffd9a0', 'rgba(255,140,40,0)'), []);
  useEffect(() => () => { sky.dispose(); glow.dispose(); }, [sky, glow]);
  const earthPlanetLook = EARTH.look;
  const topNight = useMemo(() => new Color('#02040a'), []);
  const topDay = useMemo(() => new Color('#16356b'), []);
  const horizonDay = useMemo(() => new Color('#e9a27a'), []);
  const horizonNight = useMemo(() => new Color('#05070d'), []);

  useFrame(({ camera, clock }) => {
    const { stage, progress, failed } = read();
    const tau = stage === 'launch' ? progress : stage === 'later' ? 1 : 0;
    const pose = ascentPose(tau);
    const t = clock.elapsedTime;
    const exploded = failed && stage !== 'pre-launch';
    if (exploded && failedAt.current === null) failedAt.current = t;
    const sinceFail = failedAt.current === null ? -1 : t - failedAt.current;

    const group = rocketGroup.current;
    if (group) {
      const shake = stage === 'pre-launch' ? padThrottle(progress) * 0.025 : stage === 'launch' && tau < 0.08 ? 0.04 : 0;
      group.position.set(pose.x + (Math.random() - 0.5) * shake, pose.y + (Math.random() - 0.5) * shake, 0);
      group.rotation.set(0, 0, -pose.pitch);
      group.scale.setScalar(LAUNCH_SCALE);
      group.visible = sinceFail < 0 && !(stage === 'later');
    }
    const throttle = stage === 'pre-launch' ? padThrottle(progress) : stage === 'launch' ? (tau < 0.96 ? 1 : 1 - (tau - 0.96) / 0.04) : 0;
    flameThrottle.current = sinceFail < 0 ? throttle : 0;
    setThrust(flameThrottle.current);
    if (sinceFail >= 0 && sinceFail < 0.05) blast();
    smokeThrottle.current = sinceFail < 0 && pose.y < 70 ? throttle : 0;
    burstThrottle.current = sinceFail >= 0 && sinceFail < 0.35 ? 1 : 0;
    if (burstEmitter.current && sinceFail < 0) burstEmitter.current.position.set(pose.x, pose.y + 2, 0);
    if (flameEmitter.current) flameEmitter.current.position.set(pose.x, pose.y + 0.1, 0);
    if (smokeEmitter.current) smokeEmitter.current.position.set(pose.x * 0.3, Math.max(0.3, pose.y * 0.4), 0);
    if (smokeFlash.current) {
      smokeFlash.current.visible = sinceFail >= 0 && sinceFail < 1.6;
      smokeFlash.current.scale.setScalar(2 + Math.max(0, sinceFail) * 14);
      (smokeFlash.current.material as { opacity: number }).opacity = Math.max(0, 0.9 - Math.max(0, sinceFail) * 0.6);
    }

    // sky colour follows the climb; the dome rides with the camera so it is always around it
    const amount = skyAmount(tau);
    const skyMaterial = skyRef.current;
    if (skyMaterial) {
      (skyMaterial.uniforms.uTop!.value as Color).copy(topNight).lerp(topDay, amount);
      (skyMaterial.uniforms.uHorizon!.value as Color).copy(horizonNight).lerp(horizonDay, amount);
      skyMaterial.uniforms.uAlpha!.value = Math.min(1, amount * 1.15);
      if (scene.fog) (scene.fog as { color: Color }).color.copy(skyMaterial.uniforms.uHorizon!.value as Color).multiplyScalar(0.6);
    }
    if (dome.current) dome.current.position.copy(camera.position);
    if (ground.current) (ground.current.material as { opacity: number }).opacity = Math.min(1, 0.15 + amount * 1.1);

    // camera: low and wide at the pad, then riding beside the rocket
    const follow = Math.max(0, tau - 0.04);
    const height = ROCKET_LOOKS[rocket].height * LAUNCH_SCALE;
    const baseY = height * 0.5;
    const targetY = stage === 'pre-launch' ? baseY : Math.max(baseY, pose.y * 0.92 + height * 0.4);
    const targetX = stage === 'pre-launch' ? 0 : pose.x * 0.9;
    const distance = 22 + height * 0.8 + follow * 40;
    poseRef.current = {
      position: [distance * 0.45 + follow * 8, Math.max(3.5, targetY * 0.5 + 2), distance + (failed && sinceFail > 0 ? 8 : 0)],
      target: [targetX, targetY, 0],
    };
  });

  return (
    <>
      <CameraDirector getPose={() => poseRef.current} damping={3.2} sway={0.18} snapKey="launch" />
      <fog attach="fog" args={['#8a5a4a', 40, 380]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-20, 25, 30]} intensity={2.6} color="#ffd9b0" />
      <pointLight position={[8, 22, 14]} intensity={900} distance={120} color="#ffe2b8" />
      <spotLight position={[16, 10, 26]} angle={0.5} penumbra={0.9} intensity={2200} distance={120} color="#fff1dc" />
      <group ref={dome} renderOrder={-10}>
        <mesh renderOrder={-10} raycast={() => null}>
          <sphereGeometry args={[250, 32, 24]} />
          <primitive object={sky} attach="material" ref={skyRef} />
        </mesh>
      </group>

      {/* ground and the planet below it, which shows once the ground fades out at altitude */}
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} raycast={() => null}>
        <circleGeometry args={[420, 64]} />
        <meshStandardMaterial color="#1b2430" metalness={0.2} roughness={0.9} transparent opacity={1} />
      </mesh>
      <GamePlanet radius={2400} look={earthPlanetLook} position={[0, -2400.4, 0]} spin={0} segments={96} />

      {/* the pad */}
      <mesh position={[0, 0.25, 0]} raycast={() => null}>
        <boxGeometry args={[18, 0.5, 18]} />
        <meshStandardMaterial color="#444c58" metalness={0.3} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[3.6, 4.0, 48]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <Gantry />
      <mesh position={[5.5, 3, 4]} raycast={() => null}><cylinderGeometry args={[0.08, 0.08, 6, 8]} /><meshStandardMaterial color="#666" /></mesh>
      <sprite position={[5.5, 6.2, 4]} scale={[3.2, 3.2, 1]} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.8} />
      </sprite>

      <group ref={rocketGroup} position={[0, 0.5, 0]}>
        <RocketModel rocket={rocket} />
      </group>
      <object3D ref={flameEmitter} />
      <object3D ref={smokeEmitter} />
      <object3D ref={burstEmitter} />
      <Plume kind="flame" emitter={flameEmitter} throttle={flameThrottle} count={420} spread={1.2} speed={34} size={4.4} life={0.8} />
      <Plume kind="smoke" emitter={smokeEmitter} throttle={smokeThrottle} count={260} spread={6} speed={8} size={7} life={2.6} />
      <Plume kind="burst" emitter={burstEmitter} throttle={burstThrottle} count={300} spread={1.6} speed={26} size={7} life={1.8} />
      <mesh ref={smokeFlash} visible={false} raycast={() => null}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshBasicMaterial color="#ffb060" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ the flight */

const WORLD_EXTENT = 10;
const PATH_STYLE: Record<string, { color: string; width: number; opacity: number }> = {
  operational: { color: '#00f0ff', width: 2.6, opacity: 1 },
  transfer: { color: '#ffc14d', width: 2.6, opacity: 1 },
  parking: { color: '#7a8aa5', width: 1.3, opacity: 0.7 },
  reference: { color: '#5b6b85', width: 1, opacity: 0.5 },
};
const OVERVIEW_FRAMES = new Set(['earth:transfer', 'sun:transfer', 'sun:ops']);

function Body({ body, scale }: { body: SceneFrame['bodies'][number]; scale: number }) {
  const position: [number, number, number] = [body.position[0] * scale, body.position[1] * scale, body.position[2] * scale];
  const radius = Math.max(0.05, body.radius * scale);
  if (body.id === 'sun') return <GameSun radius={radius} look={SUN_LOOK} position={position} intensity={2.2} />;
  if (body.id === 'moon') return <GamePlanet radius={radius} look={MOON_LOOK} position={position} spin={0.02} />;
  if (body.id === 'mars') return <GamePlanet radius={radius} look={MARS.look} position={position} spin={0.05} atmosphere={MARS.atmosphere} />;
  return <GamePlanet radius={radius} look={EARTH.look} position={position} spin={0.05} atmosphere={EARTH.atmosphere} cloudCover={EARTH.cloudCover} nightLights />;
}

/**
 * One frame of the simulation (the central body, orbit lines and the spacecraft), drawn in a fixed world size.
 * Every position comes from `craftState`/`craftTrail` of the simulation; this component owns no motion.
 */
export function OrbitFrameView({ plan, frame, lost }: { plan: SimPlan; frame: SceneFrame; lost: () => boolean }) {
  const scale = WORLD_EXTENT / Math.max(frame.extent, 1.2);
  const layout = useMemo(() => layoutSpacecraft(plan.mission), [plan.mission]);
  const ship = useRef<Group>(null);
  const marker = useRef<Group>(null);
  const glow = useMemo(() => createGlowTexture('#9ff4ff', 'rgba(0,200,255,0)'), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const poseRef = useRef<CameraPose>({ position: [0, 6, 20], target: [0, 0, 0] });
  const trail = useRef<Vec3Like[]>([[0, 0, 0], [0.001, 0, 0]]);
  const trailKey = useRef(0);
  const overview = OVERVIEW_FRAMES.has(frame.key);
  const shipRadius = overview ? 0.4 : 0.9;

  const visualClock = useRef(0);

  useFrame(({ clock }, delta) => {
    const { plan: livePlan, sim, clockT, status } = simStore.getState();
    if (!livePlan || !sim) return;
    if (status !== 'paused') visualClock.current += Math.min(delta, 0.25);
    const stage = livePlan.stageIds[sim.stageIndex]!;
    const visual = usesVisualOrbit(livePlan, stage);
    const craft = visual ? operationalCraft(livePlan, sim, visualOrbitSeconds(livePlan, visualClock.current)) : craftState(livePlan, sim, clockT);
    const world: Vec3Like = [craft.position[0] * scale, craft.position[1] * scale, craft.position[2] * scale];
    if (ship.current) {
      ship.current.position.set(...world);
      ship.current.rotation.y = clock.elapsedTime * 0.5;
      ship.current.visible = !lost();
    }
    if (marker.current) marker.current.position.set(...world);
    // refresh the trail a few times a second
    const bucket = Math.floor(clock.elapsedTime * (visual ? 20 : 8));
    if (bucket !== trailKey.current) {
      trailKey.current = bucket;
      const points = visual ? operationalTrail(livePlan, sim, visualOrbitSeconds(livePlan, visualClock.current), 40) : craftTrail(livePlan, sim, clockT, 40);
      trail.current = points.map((point) => [point[0] * scale, point[1] * scale, point[2] * scale] as Vec3Like);
    }
    if (overview) {
      poseRef.current = { position: [0, WORLD_EXTENT * 0.72, WORLD_EXTENT * 1.25], target: [world[0] * 0.3, 0, world[2] * 0.3] };
    } else {
      // Chase view: behind the spacecraft and a little above it, looking along its path, so the planet's
      // curved horizon fills the lower part of the picture and space the upper part.
      const length = Math.hypot(...world) || 1;
      const outward: Vec3Like = [world[0] / length, world[1] / length, world[2] / length];
      const points = trail.current;
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      let along: Vec3Like = a && b ? [b[0] - a[0], b[1] - a[1], b[2] - a[2]] : [0, 0, 0];
      const alongLength = Math.hypot(...along);
      if (alongLength < 1e-6) along = [-outward[2], 0, outward[0]];
      const unit = Math.hypot(...along) || 1;
      const forward: Vec3Like = [along[0] / unit, along[1] / unit, along[2] / unit];
      poseRef.current = {
        position: [world[0] + outward[0] * 1.8 - forward[0] * 4.6, world[1] + outward[1] * 1.8 - forward[1] * 4.6, world[2] + outward[2] * 1.8 - forward[2] * 4.6],
        target: [world[0] + forward[0] * 2.6 + outward[0] * 0.1, world[1] + forward[1] * 2.6 + outward[1] * 0.1, world[2] + forward[2] * 2.6 + outward[2] * 0.1],
      };
    }
  });

  return (
    <>
      <CameraDirector getPose={() => poseRef.current} damping={overview ? 1.6 : 5} sway={0.08} snapKey={`flight-${frame.key}`} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[-30, 8, 14]} intensity={3.6} color="#fff2dd" />
      {frame.bodies.map((body) => (
        <Body key={`${body.id}-${body.position.join(',')}`} body={body} scale={scale} />
      ))}
      {frame.paths.map((path, index) => {
        const style = PATH_STYLE[path.kind] ?? PATH_STYLE.reference!;
        return <Line key={`${path.kind}-${index}`} points={path.points.map((point) => [point[0] * scale, point[1] * scale, point[2] * scale] as [number, number, number])} color={style.color} lineWidth={style.width} transparent opacity={style.opacity} dashed={path.dashed} dashSize={0.5} gapSize={0.4} raycast={() => null} />;
      })}
      {frame.target ? (
        <mesh position={[frame.target[0] * scale, frame.target[1] * scale, frame.target[2] * scale]} raycast={() => null}>
          <torusGeometry args={[0.6, 0.04, 8, 40]} />
          <meshBasicMaterial color="#34d399" />
        </mesh>
      ) : null}
      <TrailLine source={trail} />
      <group ref={ship}>
        <ShipModel shapes={layout.shapes} extent={layout.extent} radius={shipRadius} />
      </group>
      <group ref={marker}>
        <sprite scale={[shipRadius * 1.7, shipRadius * 1.7, 1]} raycast={() => null}>
          <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.22} />
        </sprite>
      </group>
    </>
  );
}

type Vec3Like = [number, number, number];

/** The spacecraft's recent path, redrawn from the simulation's `craftTrail` as the ref changes. */
function TrailLine({ source }: { source: { current: Vec3Like[] } }) {
  const ref = useRef<{ geometry: { setPositions: (positions: number[]) => void } } | null>(null);
  const last = useRef<Vec3Like[] | null>(null);
  useFrame(() => {
    if (!ref.current || last.current === source.current || source.current.length < 2) return;
    last.current = source.current;
    ref.current.geometry.setPositions(source.current.flat());
  });
  return <Line ref={ref as never} points={[[0, 0, 0], [0.001, 0, 0]]} color="#ff7ad9" lineWidth={2.4} raycast={() => null} />;
}

type LaunchRead = { stage: 'pre-launch' | 'launch' | 'later'; progress: number; failed: boolean };

/** Reads how far the simulation is through the launch stages; called every frame by the launch scene. */
function readLaunch(): LaunchRead {
  const { sim, plan, clockT } = simStore.getState();
  if (!sim || !plan) return { stage: 'pre-launch', progress: 0, failed: false };
  const id = plan.stageIds[sim.stageIndex]!;
  if (id !== 'pre-launch' && id !== 'launch') return { stage: 'later', progress: 1, failed: false };
  const planned = plan.stagePlannedS[id] ?? 0;
  const elapsed = Math.min(planned > 0 ? planned : 1, sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t));
  const progress = planned > 0 ? Math.min(1, elapsed / planned) : 1;
  const failed = Boolean(sim.ended && sim.outcome?.kind === 'failure' && sim.outcome.endedIn === 'launch');
  return { stage: id, progress, failed };
}

const isLost = () => {
  const { sim } = simStore.getState();
  return Boolean(sim?.ended && sim.outcome?.kind === 'failure');
};

/** The scene key of the current stage: the launch cinematic for the first two stages, then the stage's frame. */
function useSceneKey(plan: SimPlan): string {
  const [key, setKey] = useState('launch-cinematic');
  useFrame(() => {
    const { sim } = simStore.getState();
    if (!sim) return;
    const id = plan.stageIds[sim.stageIndex]!;
    const next = id === 'pre-launch' || id === 'launch' ? 'launch-cinematic' : frameKeyOf(plan, id);
    setKey((current) => (current === next ? current : next));
  });
  return key;
}

/**
 * What the game camera shows during the flight: the launch cinematic for the first two stages, then the frame
 * of the current stage. React re-renders only when the scene changes (a few times per mission); the motion
 * inside each scene is read from the simulation every frame.
 */
export function FlightScene({ plan, rocket }: { plan: SimPlan; rocket: RocketClass }) {
  const key = useSceneKey(plan);
  if (key === 'launch-cinematic') return <LaunchScene rocket={rocket} read={readLaunch} />;
  return <OrbitFrameView key={key} plan={plan} frame={frameOf(plan, key)} lost={isLost} />;
}
