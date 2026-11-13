'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace, type Group } from 'three';
import { capDprForTier, detectQualityTier } from '@/lib/performance';
import { LAUNCHERS } from '@/mission';
import { blip, unlock } from '@/game/audio';
import { gameStore, useGameStore } from '@/game/gameStore';
import { useMissionStore, missionStore } from '@/stores/missionStore';
import { useSimStore } from '@/stores/simStore';
import { setLauncher } from '@/mission';
import { NebulaBackdrop } from '../3d/NebulaBackdrop';
import { SceneEffects } from '../3d/SceneEffects';
import { SceneEnvironment } from '../3d/SceneEnvironment';
import { Starfield } from '../3d/Starfield';
import { createGlowTexture, GLOW_BLENDING } from '../3d/proceduralTextures';
import { FlightScene, SimDriver } from './FlightScene';
import { HangarScene } from './HangarScene';
import { LabelProjector } from './labels';
import { MapScene } from './MapScene';
import type { RocketClass } from './RocketModel';
import { useEffect } from 'react';

/** Stars and nebulae ride with the camera, so they stay at infinity in every scene. */
function Backdrop({ visible }: { visible: boolean }) {
  const group = useRef<Group>(null);
  const tints = useMemo(() => [createGlowTexture('#6b4bd6', 'rgba(40,20,90,0)'), createGlowTexture('#1f7fd0', 'rgba(10,40,90,0)'), createGlowTexture('#d6568a', 'rgba(90,20,50,0)')], []);
  useEffect(() => () => tints.forEach((texture) => texture.dispose()), [tints]);
  useFrame(({ camera }) => {
    if (group.current) group.current.position.copy(camera.position);
  });
  return (
    <group ref={group} visible={visible}>
      <Starfield />
      <NebulaBackdrop />
      {[[-90, 40, -110, 0], [110, -20, -90, 1], [20, 60, 120, 2]].map(([x, y, z, index]) => (
        <sprite key={index} position={[x!, y!, z!]} scale={[150, 110, 1]} raycast={() => null}>
          <spriteMaterial map={tints[index!]} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.32} />
        </sprite>
      ))}
    </group>
  );
}

/**
 * The game's one WebGL canvas. The scene that is shown follows the phase of the game. Text labels are DOM
 * elements placed by `LabelLayer`, so nothing here needs the translation context.
 */
export default function GameCanvas({ onReady }: { onReady?: () => void }) {
  const phase = useGameStore((state) => state.phase);
  const focus = useGameStore((state) => state.focus);
  const missionId = useGameStore((state) => state.missionId);
  const hangarView = useGameStore((state) => state.hangarView);
  const mission = useMissionStore((state) => (missionId ? state.missions[missionId] : undefined));
  const plan = useSimStore((state) => state.plan);
  const tier = useMemo(() => detectQualityTier(), []);
  const dprMax = useMemo(() => capDprForTier(tier), [tier]);

  const rocketClass: RocketClass = LAUNCHERS.find((launcher) => launcher.id === (plan?.mission.launch.vehicleId ?? mission?.launch.vehicleId))?.sizeClass ?? 'medium';

  return (
    <Canvas
      dpr={[1, dprMax]}
      camera={{ position: [-4, 19, 50], fov: 46, near: 0.05, far: 4000 }}
      gl={{ antialias: tier !== 'low', toneMapping: ACESFilmicToneMapping, powerPreference: tier === 'low' ? 'default' : 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(gl.getPixelRatio(), dprMax));
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMappingExposure = 1.1;
        onReady?.();
      }}
    >
      <Backdrop visible={phase !== 'hangar'} />
      <SceneEnvironment qualityTier={tier} />
      <SimDriver />
      <LabelProjector />
      {phase === 'map' ? (
        <MapScene focus={focus} onFocus={(id) => {
            unlock();
            blip(880, 0.06);
            gameStore.getState().focusDestination(id);
          }} />
      ) : null}
      {phase === 'hangar' && mission ? (
        <HangarScene
          mission={mission}
          view={hangarView}
          onPickRocket={(id) => {
            if (!missionId) return;
            unlock();
            blip(620, 0.07);
            missionStore.getState().edit(missionId, (current) => setLauncher(current, id));
          }}
        />
      ) : null}
      {(phase === 'flight' || phase === 'result' || phase === 'replay') && plan ? <FlightScene plan={plan} rocket={rocketClass} /> : null}
      <SceneEffects qualityTier={tier} />
    </Canvas>
  );
}

