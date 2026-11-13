/* eslint-disable react-hooks/immutability -- the camera, the canvas element and the pointer state are mutable three.js / DOM objects owned by the render loop */
'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

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
type Look = { yaw: number; pitch: number; zoom: number; active: boolean; releasedAt: number };

/**
 * Free look, the way driving games do it: drag with a finger or the mouse and the camera swings around what it is
 * looking at; the wheel or a two-finger pinch zooms. A few seconds after the drag ends the view eases back to the
 * director's shot.
 */
function useFreeLook(enabled: boolean) {
  const gl = useThree((state) => state.gl);
  const look = useRef<Look>({ yaw: 0, pitch: 0, zoom: 1, active: false, releasedAt: 0 });
  useEffect(() => {
    if (!enabled) return;
    const element = gl.domElement;
    const previous = element.style.touchAction;
    element.style.touchAction = 'none';
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      look.current.active = true;
      try { element.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
    };
    const move = (event: PointerEvent) => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0) look.current.zoom = MathUtils.clamp(look.current.zoom * (pinch / Math.max(1, distance)), 0.3, 4);
        pinch = distance;
        return;
      }
      look.current.yaw -= dx * 0.006;
      look.current.pitch = MathUtils.clamp(look.current.pitch + dy * 0.005, -1.15, 1.15);
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinch = 0;
      if (pointers.size === 0) { look.current.active = false; look.current.releasedAt = performance.now(); }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      look.current.zoom = MathUtils.clamp(look.current.zoom * Math.exp(event.deltaY * 0.0012), 0.3, 4);
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.removeEventListener('wheel', wheel);
      element.style.touchAction = previous;
      look.current = { yaw: 0, pitch: 0, zoom: 1, active: false, releasedAt: 0 };
    };
  }, [enabled, gl]);
  return look;
}

const OFFSET = new Vector3();
export function CameraDirector({ getPose, damping = 2.2, sway = 0.35, snapKey, freeLook = false }: { getPose: (time: number) => CameraPose; damping?: number; sway?: number; snapKey?: string; freeLook?: boolean }) {
  const free = useFreeLook(freeLook);
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
    if (freeLook) {
      const user = free.current;
      if (!user.active && performance.now() - user.releasedAt > 3000) {
        const ease = Math.exp(-delta * 1.4);
        user.yaw *= ease;
        user.pitch *= ease;
      }
      if (Math.abs(user.yaw) > 1e-4 || Math.abs(user.pitch) > 1e-4 || Math.abs(user.zoom - 1) > 1e-4) {
        OFFSET.copy(base.current).sub(look.current);
        const radius = OFFSET.length() * user.zoom;
        const azimuth = Math.atan2(OFFSET.x, OFFSET.z) + user.yaw;
        const elevation = MathUtils.clamp(Math.asin(OFFSET.y / Math.max(1e-6, OFFSET.length())) + user.pitch, -1.4, 1.4);
        camera.position.set(look.current.x + radius * Math.cos(elevation) * Math.sin(azimuth), look.current.y + radius * Math.sin(elevation), look.current.z + radius * Math.cos(elevation) * Math.cos(azimuth));
      }
    }
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
