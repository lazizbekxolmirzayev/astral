'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type Mesh } from 'three';
import { useSelectionStore } from '@/stores/selectionStore';
import { labelReach } from './layout';

// Reused every frame so the label check allocates nothing.
const scratch = new Vector3();

type CelestialBodyProps = {
  /** Also the three.js object name: the camera rig looks bodies up by it. */
  id: string;
  /** Localized display name, passed in already translated. */
  label: string;
  color: string;
  radius: number;
  /** Emissive strength: 0 for lit bodies, high for the Sun. */
  emissiveIntensity?: number;
  /** Placement before the first frame writes the animated position. */
  position?: [number, number, number];
  /** Lets the orbit loop keep writing positions onto this mesh. */
  registerMesh?: (mesh: Mesh | null) => void;
};

/**
 * One selectable, hoverable sphere with a distance-limited name label.
 *
 * Hover and selection are React state (pointer events only, never per frame).
 * Label visibility is written straight to the element inside `useFrame`, so the
 * distance check does not re-render anything.
 */
export function CelestialBody({
  id,
  label,
  color,
  radius,
  emissiveIntensity = 0,
  position = [0, 0, 0],
  registerMesh,
}: CelestialBodyProps) {
  const isSelected = useSelectionStore((state) => state.selectedId === id);
  const isHovered = useSelectionStore((state) => state.hoveredId === id);
  const select = useSelectionStore((state) => state.select);
  const hover = useSelectionStore((state) => state.hover);
  const leaveHover = useSelectionStore((state) => state.leaveHover);

  const meshRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const active = isSelected || isHovered;

  useEffect(() => {
    registerMesh?.(meshRef.current);
    return () => registerMesh?.(null);
  }, [registerMesh]);

  useFrame(({ camera }) => {
    const element = labelRef.current;
    const mesh = meshRef.current;
    if (!element || !mesh) return;
    const closeEnough = camera.position.distanceTo(mesh.getWorldPosition(scratch)) <= labelReach(radius);
    element.style.visibility = active || closeEnough ? 'visible' : 'hidden';
  });

  return (
    <mesh
      name={id}
      ref={meshRef}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        hover(id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        leaveHover(id);
        document.body.style.cursor = 'auto';
      }}
      onClick={(event) => {
        event.stopPropagation();
        select(id);
      }}
    >
      <sphereGeometry args={[radius, 32, 24]} />
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        metalness={0}
        emissive={color}
        emissiveIntensity={emissiveIntensity + (active ? 0.7 : 0)}
        toneMapped={emissiveIntensity > 0}
      />
      <Html position={[0, radius + 1.1, 0]} center pointerEvents="none" zIndexRange={[6, 0]}>
        <div
          ref={labelRef}
          style={{ visibility: 'hidden' }}
          className={`pointer-events-none whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            isSelected
              ? 'border-accent-cyan/60 bg-background/80 text-accent-cyan'
              : 'border-panel-border bg-background/70 text-foreground/60'
          }`}
        >
          {label}
        </div>
      </Html>
    </mesh>
  );
}
