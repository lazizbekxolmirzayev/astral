'use client';

import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/components/ui/ReducedMotion';
import { Vector3 } from 'three';
import type CameraControlsImpl from 'camera-controls';
import { focusView } from '@/lib/cameraFocus';
import { useSelectionStore } from '@/stores/selectionStore';
import { bodyRadiusById, VIEWS } from './layout';

type PanAction = 'forward' | 'back' | 'left' | 'right';

const KEY_ACTIONS: Record<string, PanAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Held keys cover this fraction of the camera-to-target distance per second. */
const PAN_SPEED = 0.7;
const MIN_PAN_PER_SECOND = 3;

const scratch = new Vector3();
const cameraPosition = new Vector3();
const cameraTarget = new Vector3();

/**
 * Mouse: left drag rotates, wheel zooms, right drag pans (camera-controls
 * defaults). Keyboard: WASD and the arrow keys fly the camera. Selecting a body
 * glides the camera onto it; the toolbar reset returns to the default view.
 */
export function CameraRig() {
  const controls = useThree((state) => state.controls) as CameraControlsImpl | null;
  const scene = useThree((state) => state.scene);
  const selectedId = useSelectionStore((state) => state.selectedId);
  const viewResetNonce = useSelectionStore((state) => state.viewResetNonce);
  const scale = useSelectionStore((state) => state.scale);
  const view = VIEWS[scale];
  const pressed = useRef(new Set<PanAction>());
  const reducedMotion = useReducedMotion();

  // Glide onto whatever the user selected, keeping the current viewing angle.
  useEffect(() => {
    if (!controls || !selectedId) return;
    const body = scene.getObjectByName(selectedId);
    const radius = bodyRadiusById[selectedId] ?? (typeof body?.userData.focusRadius === 'number' ? body.userData.focusRadius : undefined);
    if (!body || radius === undefined) return;
    const center = body.getWorldPosition(scratch);
    const framing = focusView(
      { x: center.x, y: center.y, z: center.z },
      radius,
      controls.getPosition(cameraPosition),
      bodyRadiusById[selectedId] === undefined ? { min: radius * 5, max: radius * 30 } : undefined,
      // Look down at ~24° so rings open up and orbits read as ellipses, not lines.
      0.42,
    );
    void controls.setLookAt(
      framing.position.x,
      framing.position.y,
      framing.position.z,
      framing.target.x,
      framing.target.y,
      framing.target.z,
      true,
    );
  }, [controls, scene, selectedId]);

  // Default view on mount and whenever the toolbar asks for a reset.
  useEffect(() => {
    if (!controls) return;
    void controls.setLookAt(
      view.position[0],
      view.position[1],
      view.position[2],
      view.target[0],
      view.target[1],
      view.target[2],
      true,
    );
  }, [controls, viewResetNonce, view]);

  useEffect(() => {
    function editableTarget(event: KeyboardEvent) {
      const target = event.target;
      return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      const action = KEY_ACTIONS[event.code];
      if (!action || event.metaKey || event.ctrlKey || event.altKey || editableTarget(event)) return;
      pressed.current.add(action);
      // Stop the arrow keys from scrolling the page behind the viewport.
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }

    function onKeyUp(event: KeyboardEvent) {
      const action = KEY_ACTIONS[event.code];
      if (action) pressed.current.delete(action);
    }

    function onLeave() {
      pressed.current.clear();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  useFrame((_, delta) => {
    if (!controls || pressed.current.size === 0) return;
    const distance = controls
      .getPosition(cameraPosition)
      .distanceTo(controls.getTarget(cameraTarget));
    const step = Math.max(MIN_PAN_PER_SECOND, distance * PAN_SPEED) * delta;
    for (const action of pressed.current) {
      if (action === 'forward') void controls.forward(step, false);
      else if (action === 'back') void controls.forward(-step, false);
      else if (action === 'left') void controls.truck(-step, 0, false);
      else void controls.truck(step, 0, false);
    }
  });

  return <CameraControls makeDefault minDistance={view.minDistance} maxDistance={view.maxDistance} />;
}
