'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { PartShape, ShapeRole } from '@/mission/spacecraftLayout';

/** A solar-cell texture: dark blue cells with thin silver grid lines. Artistic. */
function cellTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#0d2a5c';
    context.fillRect(0, 0, 128, 128);
    const gradient = context.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, 'rgba(90,150,255,0.35)');
    gradient.addColorStop(1, 'rgba(20,40,120,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = 'rgba(190,210,240,0.7)';
    context.lineWidth = 2;
    for (let index = 0; index <= 128; index += 32) {
      context.beginPath(); context.moveTo(index, 0); context.lineTo(index, 128); context.stroke();
      context.beginPath(); context.moveTo(0, index); context.lineTo(128, index); context.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

const ROLE_COLOR: Record<ShapeRole, string> = {
  bus: '#f0c860',
  tank: '#b8bec9',
  nozzle: '#6b7280',
  panel: '#ffffff',
  dish: '#eef1f6',
  mast: '#9ca3af',
  battery: '#34d399',
  computer: '#8b7cf6',
  attitude: '#fb923c',
  instrument: '#22d3ee',
};

/**
 * The player's spacecraft, drawn from `layoutSpacecraft` (see src/mission/spacecraftLayout.ts): the same
 * shapes the Engineer pages show, with game materials. It is a picture of the design, not a structural model.
 * Metres in, scene units out: the model is scaled so its farthest corner is `radius` scene units from the centre.
 */
export function ShipModel({ shapes, extent, radius = 1.6, glow = 0, selectedItemId = null, deploy }: { shapes: PartShape[]; extent: number; radius?: number; glow?: number; selectedItemId?: string | null; deploy?: () => number }) {
  const cells = useMemo(() => cellTexture(), []);
  const panels = useRef(new Map<string, Group>());
  // solar panels unfold from the bus: 0 = folded against it, 1 = fully out (only when the scene asks for it)
  useFrame(() => {
    if (!deploy) return;
    const amount = Math.min(1, Math.max(0, deploy()));
    const eased = amount * amount * (3 - 2 * amount);
    for (const shape of shapes) {
      const group = panels.current.get(shape.key);
      if (!group) continue;
      group.position.set(shape.position[0] * eased, shape.position[1] * eased, shape.position[2] * eased);
      group.scale.set(Math.max(0.02, eased), 1, Math.max(0.02, eased));
    }
  });
  useEffect(() => () => cells.dispose(), [cells]);
  const scale = radius / Math.max(extent, 0.3);

  return (
    <group scale={scale}>
      {shapes.map((shape) => {
        const [sx, sy, sz] = shape.size;
        const chosen = selectedItemId === shape.itemId;
        const color = ROLE_COLOR[shape.role];
        const rotation: [number, number, number] = shape.role === 'dish' || shape.role === 'mast' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        let geometry: React.ReactNode;
        let material: React.ReactNode;
        if (shape.role === 'bus') {
          geometry = <boxGeometry args={[sx, sy, sz]} />;
          material = <meshStandardMaterial color={color} metalness={0.75} roughness={0.35} emissive="#8a6310" emissiveIntensity={0.45 + glow * 0.3} />;
        } else if (shape.role === 'panel') {
          geometry = <boxGeometry args={[sx, Math.max(sy, 0.012), sz]} />;
          material = <meshStandardMaterial map={cells} color={color} metalness={0.7} roughness={0.35} emissive="#1d4ed8" emissiveIntensity={0.18 + glow * 0.3} />;
        } else if (shape.role === 'dish') {
          geometry = <cylinderGeometry args={[sx, sx * 0.18, Math.max(sy, sx * 0.25), 36, 1, true]} />;
          material = <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} side={2} />;
        } else if (shape.geometry === 'cylinder') {
          geometry = <cylinderGeometry args={[sx, sx, sy, 28]} />;
          material = <meshStandardMaterial color={color} metalness={0.75} roughness={0.4} emissive={shape.role === 'instrument' ? '#22d3ee' : '#000000'} emissiveIntensity={shape.role === 'instrument' ? 0.5 : 0} />;
        } else {
          geometry = <boxGeometry args={[sx, sy, sz]} />;
          material = <meshStandardMaterial color={color} metalness={0.5} roughness={0.45} emissive={shape.role === 'instrument' ? '#22d3ee' : color} emissiveIntensity={shape.role === 'instrument' ? 0.6 : 0.12} />;
        }
        return (
          <group key={shape.key} position={shape.position} rotation={rotation} ref={shape.role === 'panel' && deploy ? (group) => { if (group) panels.current.set(shape.key, group); else panels.current.delete(shape.key); } : undefined}>
            <mesh raycast={() => null}>
              {geometry}
              {material}
            </mesh>
            {chosen ? (
              <mesh raycast={() => null} scale={1.08}>
                {geometry}
                <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.6} />
              </mesh>
            ) : null}
            {shape.role === 'tank' && shape.fill !== undefined && shape.fill > 0 ? (
              <mesh position={[0, -sy / 2 + (sy * shape.fill) / 2, 0]} raycast={() => null}>
                <cylinderGeometry args={[sx * 0.9, sx * 0.9, sy * shape.fill, 24]} />
                <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.35} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
