'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, ShaderMaterial, Vector3, type Group, type Mesh } from 'three';
import { useSelectionStore } from '@/stores/selectionStore';
import { labelReach } from './layout';
import { createPlanetTexture, createRingGeometry, createRingTexture, GLOW_BLENDING, RING_SIDE, type TextureLook } from './proceduralTextures';

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
  /** Procedural surface map; without it the body is a flat color. */
  look?: TextureLook;
  /** Rim-light color for an atmosphere. */
  atmosphere?: string;
  ring?: { inner: number; outer: number; color: string; tilt: number };
  /** Spin in radians per second. */
  spin?: number;
  /** Clickable and labelled but not drawn (a hit target over a galaxy). */
  hidden?: boolean;
  /** Radius the camera frames when this body is selected; defaults to the drawn radius. */
  focusRadius?: number;
  /** Height of the name label above the sphere's top; small markers need a small gap. */
  labelGap?: number;
};

const ATMOSPHERE_VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const ATMOSPHERE_FRAGMENT = `
uniform vec3 glow;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(0.72 - dot(vNormal, vView), 3.0);
  gl_FragColor = vec4(glow, 1.0) * clamp(rim * 0.55, 0.0, 1.0);
}`;

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
  look,
  atmosphere,
  ring,
  spin = 0,
  hidden = false,
  focusRadius,
  labelGap = 1.1,
}: CelestialBodyProps) {
  const isSelected = useSelectionStore((state) => state.selectedId === id);
  const isHovered = useSelectionStore((state) => state.hoveredId === id);
  const select = useSelectionStore((state) => state.select);
  const hover = useSelectionStore((state) => state.hover);
  const leaveHover = useSelectionStore((state) => state.leaveHover);

  const meshRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const ringGroupRef = useRef<Group>(null);
  const active = isSelected || isHovered;

  const map = useMemo(() => (look ? createPlanetTexture(look) : null), [look]);
  useEffect(() => () => map?.dispose(), [map]);
  const ringTexture = useMemo(() => (ring ? createRingTexture(ring.color, look?.seed ?? 1) : null), [ring, look]);
  const ringGeometry = useMemo(() => (ring ? createRingGeometry(radius * ring.inner, radius * ring.outer) : null), [ring, radius]);
  useEffect(() => () => { ringTexture?.dispose(); ringGeometry?.dispose(); }, [ringTexture, ringGeometry]);
  const atmosphereMaterial = useMemo(
    () => (atmosphere ? new ShaderMaterial({ uniforms: { glow: { value: new Color(atmosphere) } }, vertexShader: ATMOSPHERE_VERTEX, fragmentShader: ATMOSPHERE_FRAGMENT, side: BackSide, blending: GLOW_BLENDING, transparent: true, depthWrite: false }) : null),
    [atmosphere],
  );
  useEffect(() => () => atmosphereMaterial?.dispose(), [atmosphereMaterial]);

  useEffect(() => {
    registerMesh?.(meshRef.current);
    return () => {
      registerMesh?.(null);
      const mesh = meshRef.current;
      if (!mesh) return;
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    };
  }, [registerMesh]);

  useFrame(({ camera }, delta) => {
    const element = labelRef.current;
    const mesh = meshRef.current;
    if (!element || !mesh) return;
    if (spin !== 0) {
      mesh.rotation.y += spin * delta;
      // The ring must not turn with the surface, or its tilt would wobble.
      if (ringGroupRef.current) ringGroupRef.current.rotation.y = -mesh.rotation.y;
    }
    const closeEnough = camera.position.distanceTo(mesh.getWorldPosition(scratch)) <= labelReach(radius);
    element.style.visibility = active || closeEnough ? 'visible' : 'hidden';
  });

  return (
    <mesh
      name={id}
      ref={meshRef}
      userData={{ focusRadius: focusRadius ?? radius }}
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
        color={map ? '#ffffff' : color}
        map={map}
        roughness={0.8}
        metalness={0}
        emissive={map && emissiveIntensity > 0 ? '#ffffff' : color}
        emissiveMap={map && emissiveIntensity > 0 ? map : null}
        emissiveIntensity={emissiveIntensity + (active ? 0.7 : 0)}
        toneMapped={emissiveIntensity > 0}
        visible={!hidden}
      />
      {atmosphereMaterial ? (
        <mesh scale={1.09} raycast={() => null}>
          <sphereGeometry args={[radius, 32, 24]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      ) : null}
      {ring && ringGeometry && ringTexture ? (
        <group ref={ringGroupRef}>
          <mesh rotation={[Math.PI / 2 + ring.tilt, 0, 0]} geometry={ringGeometry} raycast={() => null}>
            <meshBasicMaterial map={ringTexture} side={RING_SIDE} transparent depthWrite={false} />
          </mesh>
        </group>
      ) : null}
      <Html position={[0, radius + labelGap, 0]} center pointerEvents="none" zIndexRange={[6, 0]}>
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
