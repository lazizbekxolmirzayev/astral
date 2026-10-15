'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { publishDiagnostics } from '@/stores/diagnosticsStore';
import { stepSimulation } from '@/stores/timeStore';
import { updateStepRate } from '@/lib/simulation';
import { CameraRig } from './CameraRig';
import { DEFAULT_CAMERA_POSITION, planets } from './layout';
import { OrbitLines } from './OrbitLines';
import { Planets } from './Planets';
import { Starfield } from './Starfield';
import { Sun } from './Sun';

/** Advances the engine once per frame and republishes diagnostics at 4 Hz. */
function SimulationDriver() {
  useFrame((_, delta) => {
    const now = performance.now();
    updateStepRate(now);
    stepSimulation(delta);
    publishDiagnostics(now);
  });
  return null;
}

/**
 * Kept separate from `UniverseViewport` because it is loaded through
 * `dynamic(..., { ssr: false })` — nothing here may run on the server.
 *
 * Translations are resolved in this component (still in the DOM tree) and passed
 * down as plain strings, because the R3F reconciler inside `<Canvas>` does not
 * inherit the next-intl context.
 */
export default function SceneCanvas({ onReady }: { onReady?: () => void }) {
  const t = useTranslations('bodies');
  const select = useSelectionStore((state) => state.select);
  const bodyNames = useMemo(
    () => Object.fromEntries(planets.map((planet) => [planet.id, t(planet.id)])),
    [t],
  );

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [DEFAULT_CAMERA_POSITION[0], DEFAULT_CAMERA_POSITION[1], DEFAULT_CAMERA_POSITION[2]],
        fov: 50,
        near: 0.1,
        far: 400,
      }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => select(null)}
    >
      <ambientLight intensity={0.14} />
      <CameraRig />
      <SimulationDriver />
      <Starfield />
      <Sun label={t('sun')} />
      <OrbitLines />
      <Planets bodyNames={bodyNames} />
    </Canvas>
  );
}
