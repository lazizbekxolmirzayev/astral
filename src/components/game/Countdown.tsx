'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';

/** The big pad countdown: every new number punches in with GSAP, and the last three glow hotter. */
export function Countdown({ seconds, label }: { seconds: number; label: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const hot = seconds <= 3;
    const tween = gsap.fromTo(ref.current, { scale: hot ? 1.5 : 1.25, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)' });
    return () => { tween.kill(); };
  }, [seconds]);
  return <p ref={ref} data-testid="countdown" className={`font-mono text-7xl font-bold sm:text-9xl ${seconds <= 3 ? 'text-orange-100 drop-shadow-[0_0_40px_rgba(255,120,40,0.95)]' : 'text-white drop-shadow-[0_0_30px_rgba(255,180,90,0.7)]'}`}>{label}</p>;
}
