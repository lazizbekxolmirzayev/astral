'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Object3D, Vector3, type Group, type Mesh, type MeshBasicMaterial, type SpriteMaterial } from 'three';
import { createGlowTexture, GLOW_BLENDING } from './proceduralTextures';

function makeFieldLine(radius: number, phase: number) {
  const points: number[] = [];
  const start = 0.14;
  const end = Math.PI - start;
  for (let index = 0; index <= 120; index += 1) {
    const theta = start + (end - start) * index / 120;
    const r = radius * Math.pow(Math.sin(theta), 2);
    points.push(r * Math.sin(theta) * Math.cos(phase), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phase));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
}

/** A stylized, rotating neutron star with dipole field lines and sweeping beams. */
export function PulsarBeams({ position, seed }: { position: [number, number, number]; seed: number }) {
  const beams = useRef<Group>(null);
  const field = useRef<Group>(null);
  const caps = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const beamMaterials = useRef<Array<MeshBasicMaterial | null>>([]);
  const fieldLines = useMemo(
    () => [makeFieldLine(0.72, 0), makeFieldLine(0.98, 0.7), makeFieldLine(1.3, 0), makeFieldLine(1.72, 0.7)].map((geometry, index) => {
      const line = new Line(geometry, new LineBasicMaterial({ color: index % 2 ? '#829aff' : '#5ee8ff', transparent: true, opacity: index > 1 ? 0.25 : 0.48, depthWrite: false, blending: 2, toneMapped: false }));
      line.raycast = () => null;
      return line;
    }),
    [],
  );

  useEffect(() => () => fieldLines.forEach((line) => { line.geometry.dispose(); line.material.dispose(); }), [fieldLines]);

  const glowTexture = useMemo(() => createGlowTexture('#e8fdff', 'rgba(60,200,255,0)'), []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);
  const flash = useRef<SpriteMaterial>(null);
  const tipA = useRef<Object3D>(null);
  const tipB = useRef<Object3D>(null);
  const rings = useRef<Array<Mesh | null>>([]);
  const scratch = useMemo(() => ({ tip: new Vector3(), origin: new Vector3(), toCamera: new Vector3() }), []);

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    // Lighthouse effect: the star flares when a beam sweeps toward the viewer.
    if (beams.current && flash.current && tipA.current && tipB.current) {
      beams.current.getWorldPosition(scratch.origin);
      scratch.toCamera.copy(camera.position).sub(scratch.origin).normalize();
      let best = 0;
      for (const tip of [tipA.current, tipB.current]) {
        tip.getWorldPosition(scratch.tip);
        scratch.tip.sub(scratch.origin).normalize();
        best = Math.max(best, Math.max(0, scratch.tip.dot(scratch.toCamera)));
      }
      flash.current.opacity = 0.18 + Math.pow(best, 10) * 0.82;
    }
    rings.current.forEach((ring, index) => {
      if (!ring) return;
      const t = ((time * 0.35 + index / 3) % 1);
      ring.scale.setScalar(0.5 + t * 3.2);
      (ring.material as MeshBasicMaterial).opacity = (1 - t) * 0.22;
    });
    const spin = time * (0.8 + (seed % 7) * 0.08);
    if (beams.current) beams.current.rotation.y = spin;
    if (field.current) field.current.rotation.y = -spin * 0.65;
    if (caps.current) caps.current.rotation.y = spin * 1.15;
    if (core.current) core.current.rotation.y = spin * 1.2;
    if (halo.current) halo.current.scale.setScalar(1 + (0.5 + 0.5 * Math.sin(time * 3.4 + seed)) * 0.2);
    const pulse = 0.5 + 0.5 * Math.sin(time * 5.2 + seed);
    for (const material of beamMaterials.current) if (material) material.opacity = 0.08 + pulse * 0.1;
  });

  return (
    <group position={position}>
      <pointLight color="#54dfff" intensity={1.2} distance={5} decay={2} />
      <mesh ref={core} raycast={() => null}>
        <sphereGeometry args={[0.085, 32, 24]} />
        <meshBasicMaterial color="#12406d" toneMapped={false} />
      </mesh>
      <mesh ref={halo} raycast={() => null}>
        <sphereGeometry args={[0.13, 24, 18]} />
        <meshBasicMaterial color="#36dfff" transparent opacity={0.16} depthWrite={false} blending={2} toneMapped={false} />
      </mesh>
      <group ref={caps} rotation={[0, 0, 0.44]}>
        <mesh position={[0, 0.076, 0]} scale={[0.42, 0.2, 0.42]} raycast={() => null}>
          <sphereGeometry args={[0.085, 20, 14]} />
          <meshBasicMaterial color="#e5fbff" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.076, 0]} scale={[0.42, 0.2, 0.42]} raycast={() => null}>
          <sphereGeometry args={[0.085, 20, 14]} />
          <meshBasicMaterial color="#bdaaff" toneMapped={false} />
        </mesh>
      </group>
      <group ref={field} rotation={[0, 0, 0.44]}>
        {fieldLines.map((line, index) => <primitive key={index} object={line} />)}
      </group>
      <sprite scale={[1.1, 1.1, 1]} raycast={() => null}>
        <spriteMaterial ref={flash} map={glowTexture} color="#bff6ff" transparent opacity={0.2} depthWrite={false} blending={GLOW_BLENDING} toneMapped={false} />
      </sprite>
      {[0, 1, 2].map((index) => (
        <mesh key={index} ref={(mesh) => { rings.current[index] = mesh; }} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[1, 0.012, 8, 96]} />
          <meshBasicMaterial color="#7fdcff" transparent opacity={0.15} depthWrite={false} blending={GLOW_BLENDING} toneMapped={false} />
        </mesh>
      ))}
      <group ref={beams} rotation={[0, 0, 0.44]}>
        <object3D ref={tipA} position={[-0.408, 0.913, 0]} />
        <object3D ref={tipB} position={[0.408, -0.913, 0]} />
        {[1, 0.62, 0.34].map((width, layer) => (
          <group key={layer}>
            <mesh rotation={[0, 0, 0.42]} raycast={() => null}>
              <coneGeometry args={[0.19 * width, 5.2, 24, 1, true]} />
              <meshBasicMaterial ref={(material) => { if (layer === 0) beamMaterials.current[0] = material; }} color={layer === 2 ? '#e8fdff' : '#59e7ff'} transparent opacity={0.05 + layer * 0.05} depthWrite={false} side={2} blending={2} toneMapped={false} />
            </mesh>
            <mesh rotation={[Math.PI, 0, -0.42]} raycast={() => null}>
              <coneGeometry args={[0.19 * width, 5.2, 24, 1, true]} />
              <meshBasicMaterial ref={(material) => { if (layer === 0) beamMaterials.current[1] = material; }} color={layer === 2 ? '#e6e0ff' : '#9487ff'} transparent opacity={0.04 + layer * 0.05} depthWrite={false} side={2} blending={2} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
