'use client';

import { useSceneFade } from '@/game/sceneFade';

/** A short dip through black so the cut from one flight scene to the next is not abrupt. */
export function SceneFade() {
  const key = useSceneFade();
  if (key === 0) return null;
  return <div key={key} aria-hidden data-testid="scene-fade" className="scene-fade pointer-events-none absolute inset-0 z-[8] bg-[#02040a]" />;
}
