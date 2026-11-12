'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';

/**
 * Text labels for things in the 3D scene. The labels are ordinary DOM elements (so they use the page's
 * translations and fonts); the scene only publishes where each anchor is on the screen. This replaces drei's
 * `Html`, which mounts a React root per label and logs warnings under React 19.
 */
type Screen = { x: number; y: number; visible: boolean };
const anchors = new Map<string, [number, number, number]>();
const screen = new Map<string, Screen>();

/** Registers a point of the scene that a DOM label follows. Render it inside the `<Canvas>`. */
export function LabelAnchor({ id, position }: { id: string; position: readonly [number, number, number] }) {
  const [x, y, z] = position;
  useEffect(() => {
    anchors.set(id, [x, y, z]);
    return () => {
      anchors.delete(id);
      screen.delete(id);
    };
  }, [id, x, y, z]);
  return null;
}

const scratch = new Vector3();

/** Projects every anchor to the screen once per frame. Render it once inside the `<Canvas>`. */
export function LabelProjector() {
  const size = useThree((state) => state.size);
  useFrame(({ camera }) => {
    camera.updateMatrixWorld();
    anchors.forEach((position, id) => {
      scratch.set(position[0], position[1], position[2]).project(camera);
      const entry = screen.get(id) ?? { x: 0, y: 0, visible: false };
      entry.x = ((scratch.x + 1) / 2) * size.width;
      entry.y = ((1 - scratch.y) / 2) * size.height;
      entry.visible = scratch.z > -1 && scratch.z < 1 && Math.abs(scratch.x) < 1.15 && Math.abs(scratch.y) < 1.15;
      screen.set(id, entry);
    });
  });
  return null;
}

export type LabelSpec = { id: string; text: string; selected: boolean; testId: string };

/** The DOM side: places each label on its anchor every animation frame. */
export function LabelLayer({ labels }: { labels: readonly LabelSpec[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const root = container.current;
      if (root) {
        for (const element of Array.from(root.children) as HTMLElement[]) {
          const entry = screen.get(element.dataset.labelId ?? '');
          if (entry?.visible) {
            element.style.transform = `translate(${entry.x.toFixed(1)}px, ${entry.y.toFixed(1)}px) translate(-50%, -100%)`;
            element.style.opacity = '1';
          } else element.style.opacity = '0';
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={container} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {labels.map((label) => (
        <div
          key={label.id}
          data-label-id={label.id}
          {...{ [label.testId]: label.id.split(':')[1] }}
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0, willChange: 'transform' }}
          className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-sm ${label.selected ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_18px_rgba(0,240,255,0.45)]' : 'border-white/15 bg-black/40 text-white/75'}`}
        >
          {label.text}
        </div>
      ))}
    </div>
  );
}
