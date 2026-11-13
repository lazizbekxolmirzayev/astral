'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { useSceneFade } from '@/game/sceneFade';

/** A dip through black so the cut from one flight scene to the next is not abrupt (GSAP). */
export function SceneFade() {
  const key = useSceneFade();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (key === 0 || !ref.current) return;
    const tween = gsap.fromTo(ref.current, { opacity: 1 }, { opacity: 0, duration: 1.2, ease: 'power2.out' });
    return () => { tween.kill(); };
  }, [key]);
  if (key === 0) return null;
  return <div ref={ref} aria-hidden data-testid="scene-fade" className="pointer-events-none absolute inset-0 z-[8] bg-[#02040a]" />;
}
