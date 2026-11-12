'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';

export type CameraPose = { position: readonly [number, number, number]; target: readonly [number, number, number] };

/**
 * Flies the camera: every frame it eases toward the pose `getPose` returns, with a slow handheld sway so
 * the picture is never frozen. Scenes decide where the camera should be; this decides how it gets there.
 */
export function CameraDirector({ getPose, damping = 2.2, sway = 0.35, snapKey }: { getPose: (time: number) => CameraPose; damping?: number; sway?: number; snapKey?: string }) {
  const look = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const first = useRef<string | null>(null);

  useFrame(({ camera, clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const time = clock.elapsedTime;
    const pose = getPose(time);
    const k = 1 - Math.exp(-damping * delta);
    desired.current.set(
      pose.position[0] + Math.sin(time * 0.17) * sway,
      pose.position[1] + Math.sin(time * 0.23 + 1) * sway * 0.5,
      pose.position[2] + Math.cos(time * 0.13) * sway,
    );
    const snap = first.current !== (snapKey ?? '');
    first.current = snapKey ?? '';
    if (snap) {
      camera.position.copy(desired.current);
      look.current.set(...pose.target);
    } else {
      camera.position.lerp(desired.current, k);
      look.current.lerp(new Vector3(...pose.target), k);
    }
    camera.lookAt(look.current);
  });
  return null;
}
