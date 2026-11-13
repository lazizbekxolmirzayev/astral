'use client';

import gsap from 'gsap';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { subscribeSubtitle, subtitleSnapshot } from '@/game/voice';

/** The voice-line ids that deserve a title card, and the message each one shows. */
const BANNERS: Record<string, string> = { liftoff: 'liftoff', 'maxq-1': 'maxq', boosters: 'boosters', stage1: 'stage', fairing: 'fairing', meco: 'meco', 'orbit-ok': 'orbit' };

/** A cinematic title card for the big moments of the flight, animated with GSAP. */
export function FlightBanner() {
  const t = useTranslations('game.banner');
  const line = useSyncExternalStore(subscribeSubtitle, subtitleSnapshot, () => null);
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const rule = useRef<HTMLDivElement>(null);
  const key = line ? BANNERS[line.id] : undefined;
  const at = line?.at;

  useEffect(() => {
    if (!key || !box.current || !text.current || !rule.current) return;
    const timeline = gsap.timeline();
    timeline
      .set(box.current, { autoAlpha: 1 })
      .fromTo(text.current, { y: 18, opacity: 0, letterSpacing: '0.7em' }, { y: 0, opacity: 1, letterSpacing: '0.34em', duration: 0.7, ease: 'power3.out' })
      .fromTo(rule.current, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: 'power2.out' }, '<0.1')
      .to({}, { duration: 1.5 })
      .to([text.current, rule.current], { opacity: 0, y: -10, duration: 0.5, ease: 'power2.in' })
      .set(box.current, { autoAlpha: 0 });
    return () => { timeline.kill(); };
  }, [key, at]);

  return (
    <div ref={box} aria-hidden data-testid="flight-banner" className="pointer-events-none absolute inset-x-0 top-[30%] z-10 flex flex-col items-center gap-3 opacity-0" style={{ visibility: 'hidden' }}>
      <p ref={text} className="text-3xl font-extrabold uppercase text-white drop-shadow-[0_0_24px_rgba(0,240,255,0.55)] sm:text-5xl">{key ? t(key) : ''}</p>
      <div ref={rule} className="h-px w-[min(60vw,420px)] origin-center bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
    </div>
  );
}
