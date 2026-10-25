'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Material,
  type Mesh,
} from 'three';
import { useSelectionStore } from '@/stores/selectionStore';
import { labelReach } from './layout';
import { sunScenePosition } from './lighting';
import { createBodyMaterial, createCloudMaterial } from './bodyMaterial';
import { AtmosphereShells, type Vector3Uniform } from './Atmosphere';
import { PlanetRing } from './PlanetRing';
import {
  createCloudTexture,
  createNightLightsTexture,
  createPlanetSurface,
  createPlanetTexture,
  createRingGeometry,
  createRingTexture,
  type TextureLook,
} from './proceduralTextures';

// Reused every frame so the label and lighting maths allocate nothing.
const scratch = new Vector3();
const sunWorld = new Vector3();
const toSun = new Vector3();
const worldToView = new Matrix4();

type CelestialBodyProps = {
  /** Also the three.js object name: the camera rig looks bodies up by it. */
  id: string;
  /** Localized display name, passed in already translated. */
  label: string;
  color: string;
  radius: number;
  /** Emissive strength: 0 for lit bodies, high for the Sun and stars. */
  emissiveIntensity?: number;
  /** Placement before the first frame writes the animated position. */
  position?: [number, number, number];
  /** Lets the orbit loop keep writing positions onto this mesh. */
  registerMesh?: (mesh: Mesh | null) => void;
  /** Procedural surface map; without it the body is a flat color. */
  look?: TextureLook;
  /** Rim-light color for an atmosphere. */
  atmosphere?: string;
  /** Draw the scattering haze over the disc as well as the limb halo. */
  atmosphereHaze?: boolean;
  /** Separate lit cloud deck above the surface, 0..1 coverage. */
  cloudCover?: number;
  /** Warm city lights, shown only on the night side. */
  nightLights?: boolean;
  ring?: { inner: number; outer: number; color: string; tilt: number };
  /** Spin in radians per second. */
  spin?: number;
  /** Clickable and labelled but not drawn (a hit target over a galaxy). */
  hidden?: boolean;
  /** Radius the camera frames when this body is selected; defaults to the drawn radius. */
  focusRadius?: number;
  /** Height of the name label above the sphere's top; small markers need a small gap. */
  labelGap?: number;
  /** Take over the surface shader entirely (the animated Sun). */
  materialOverride?: Material;
  /** PBR response of the surface; ice differs from regolith. */
  roughness?: number;
  metalness?: number;
};

/**
 * One selectable, hoverable sphere with a distance-limited name label.
 *
 * Everything that changes per frame is written into uniforms or element styles
 * inside `useFrame`, so lighting never re-renders React. This body owns the
 * sun-direction uniforms because it is the only thing that knows its own world
 * position — the atmosphere, the ring shadow and the night side all read from them.
 *
 * Hover and selection stay React state (pointer events only, never per frame).
 * The hover feedback is a soft self-illumination, which works on lit bodies and
 * on glowing ones alike, so no extra rim shell is needed per body.
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
  atmosphereHaze = true,
  cloudCover,
  nightLights = false,
  ring,
  spin = 0,
  hidden = false,
  focusRadius,
  labelGap = 1.1,
  materialOverride,
  roughness = 0.68,
  metalness = 0.02,
}: CelestialBodyProps) {
  const isSelected = useSelectionStore((state) => state.selectedId === id);
  const isHovered = useSelectionStore((state) => state.hoveredId === id);
  const select = useSelectionStore((state) => state.select);
  const hover = useSelectionStore((state) => state.hover);
  const leaveHover = useSelectionStore((state) => state.leaveHover);

  const meshRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const ringGroupRef = useRef<Group>(null);
  const active = isSelected || isHovered;

  // Shared uniform objects: written once per frame here, read by every shell.
  const sunDirectionView = useMemo<Vector3Uniform>(() => ({ value: new Vector3(0, 0, 1) }), []);
  const sunPosition = useMemo<Vector3Uniform>(() => ({ value: new Vector3() }), []);
  const bodyPosition = useMemo<Vector3Uniform>(() => ({ value: new Vector3() }), []);

  /** A body that makes its own light does not need roughness or relief maps. */
  const lit = emissiveIntensity <= 0 && !materialOverride;
  const drawn = !hidden;
  const surface = useMemo(
    () => (look && lit && drawn ? createPlanetSurface(look) : null),
    [look, lit, drawn],
  );
  const glowMap = useMemo(
    () => (look && !lit && !materialOverride && drawn ? createPlanetTexture(look) : null),
    [look, lit, materialOverride, drawn],
  );
  const nightMap = useMemo(
    () => (look && nightLights && drawn ? createNightLightsTexture(look) : null),
    [look, nightLights, drawn],
  );
  const cloudMap = useMemo(
    () => (look && cloudCover && drawn ? createCloudTexture(look.seed, cloudCover) : null),
    [look, cloudCover, drawn],
  );
  const ringTexture = useMemo(() => (ring ? createRingTexture(ring.color, look?.seed ?? 1) : null), [ring, look]);
  const ringGeometry = useMemo(
    () => (ring ? createRingGeometry(radius * ring.inner, radius * ring.outer) : null),
    [ring, radius],
  );

  useEffect(
    () => () => {
      surface?.dispose();
      glowMap?.dispose();
      nightMap?.dispose();
      cloudMap?.dispose();
      ringTexture?.dispose();
      ringGeometry?.dispose();
    },
    [surface, glowMap, nightMap, cloudMap, ringTexture, ringGeometry],
  );

  const material = useMemo(() => {
    if (materialOverride) return materialOverride;
    if (!lit) {
      return new MeshStandardMaterial({
        color: new Color(glowMap ? '#ffffff' : color),
        map: glowMap,
        emissive: new Color(glowMap ? '#ffffff' : color),
        emissiveMap: glowMap,
        emissiveIntensity,
        roughness: 1,
        metalness: 0,
      });
    }
    return createBodyMaterial({
      color,
      surface,
      roughness,
      metalness,
      // Relief is relative to the body: a small rocky world must not get the
      // same normal strength as a gas giant.
      normalScale: Math.min(1.5, Math.max(0.4, radius * 0.85)),
      nightLights: nightMap ? { map: nightMap, intensity: 1.35 } : undefined,
      envMapIntensity: 1,
    });
  }, [materialOverride, lit, glowMap, color, emissiveIntensity, surface, roughness, metalness, radius, nightMap]);

  const cloudMaterial = useMemo(() => (cloudMap ? createCloudMaterial(cloudMap) : null), [cloudMap]);
  useEffect(() => {
    if (materialOverride) return undefined;
    const owned = material;
    return () => {
      owned.dispose();
      cloudMaterial?.dispose();
    };
  }, [material, cloudMaterial, materialOverride]);

  useEffect(() => {
    registerMesh?.(meshRef.current);
    return () => {
      registerMesh?.(null);
      const mesh = meshRef.current;
      if (!mesh) return;
      mesh.geometry.dispose();
      const meshMaterial = mesh.material;
      if (Array.isArray(meshMaterial)) {
        meshMaterial.forEach((entry) => entry.dispose());
      } else if (meshMaterial) {
        meshMaterial.dispose();
      }
    };
  }, [registerMesh]);

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (spin !== 0) {
      mesh.rotation.y += spin * delta;
      // A cloud deck drifts ahead of the surface, so it must not lock to it.
      if (cloudRef.current) cloudRef.current.rotation.y = mesh.rotation.y * 1.16 + 0.4;
      // The ring must not turn with the surface, or its tilt would wobble.
      if (ringGroupRef.current) ringGroupRef.current.rotation.y = -mesh.rotation.y;
    }

    const centre = mesh.getWorldPosition(scratch);
    bodyPosition.value.copy(centre);
    sunPosition.value.copy(sunScenePosition(sunWorld));

    // Body → Sun, rotated into view space so it matches the shader normals.
    toSun.copy(sunWorld).sub(centre).normalize();
    worldToView.copy(camera.matrixWorld).invert();
    sunDirectionView.value.copy(toSun).transformDirection(worldToView);

    const element = labelRef.current;
    if (!element) return;
    const closeEnough = camera.position.distanceTo(centre) <= labelReach(radius);
    element.style.visibility = active || closeEnough ? 'visible' : 'hidden';
  });

  // Hover and selection read as a soft self-illumination on lit bodies.
  useEffect(() => {
    if (!lit || materialOverride) return;
    const standard = material as MeshStandardMaterial;
    if (!nightLights) standard.emissive = new Color(color);
    standard.emissiveIntensity = active ? 0.45 : nightLights ? 1.35 : 0;
  }, [active, color, lit, material, materialOverride, nightLights]);

  return (
    <mesh
      name={id}
      ref={meshRef}
      userData={{ focusRadius: focusRadius ?? radius }}
      position={position}
      material={material}
      visible={!hidden}
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
      <sphereGeometry args={[radius, 64, 48]} />
      {cloudMaterial ? (
        <mesh ref={cloudRef} material={cloudMaterial} scale={1.014} raycast={() => null}>
          <sphereGeometry args={[radius, 48, 32]} />
        </mesh>
      ) : null}
      {atmosphere && drawn ? (
        <AtmosphereShells
          radius={radius}
          color={atmosphere}
          sunDirectionView={sunDirectionView}
          haze={atmosphereHaze}
        />
      ) : null}
      {ring && ringGeometry && ringTexture ? (
        <group ref={ringGroupRef}>
          {/* The plate lies in the ring plane; the tilt is the planet's axial tilt. */}
          <PlanetRing
            geometry={ringGeometry}
            texture={ringTexture}
            color={ring.color}
            planetRadius={radius}
            sunPosition={sunPosition}
            planetPosition={bodyPosition}
            rotation={[Math.PI / 2 + ring.tilt, 0, 0]}
          />
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
