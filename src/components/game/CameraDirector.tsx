'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';

export type CameraPose = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Vertical field of view in degrees; defaults to 46 (the game camera). */
  fov?: number;
  /** Camera shake 0..1 (jitter of the position and a little roll). */
  shake?: number;
};

/**
 * Flies the camera: every frame it eases toward the pose `getPose` returns, with a slow handheld sway so
 * the picture is never frozen. Scenes decide where the camera should be; this decides how it gets there.
 * The shake a pose asks for is added after the easing, so it never accumulates into the camera's path.
 */
export function CameraDirector({ getPose, damping = 2.2, sway = 0.35, snapKey }: { getPose: (time: number) => CameraPose; damping?: number; sway?: number; snapKey?: string }) {
  const base = useRef(new Vector3());
  const look = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const target = useRef(new Vector3());
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
    target.current.set(...pose.target);
    const snap = first.current !== (snapKey ?? '');
    first.current = snapKey ?? '';
    if (snap) {
      base.current.copy(desired.current);
      look.current.copy(target.current);
    } else {
      base.current.lerp(desired.current, k);
      look.current.lerp(target.current, k);
    }
    camera.position.copy(base.current);
    const shake = pose.shake ?? 0;
    if (shake > 0) {
      const amount = shake * 0.16;
      camera.position.x += (Math.random() - 0.5) * amount;
      camera.position.y += (Math.random() - 0.5) * amount;
      camera.position.z += (Math.random() - 0.5) * amount;
    }
    camera.lookAt(look.current);
    if (shake > 0) camera.rotateZ((Math.random() - 0.5) * shake * 0.012);
    const perspective = camera as PerspectiveCamera;
    const fov = pose.fov ?? 46;
    if (perspective.isPerspectiveCamera && Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov += (fov - perspective.fov) * Math.min(1, k * 1.5);
      perspective.updateProjectionMatrix();
    }
  });
  return null;
}
