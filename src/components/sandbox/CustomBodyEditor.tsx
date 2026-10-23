'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { circularSpeedKmS, customScenario, type CustomBodySpec } from '@/lib/sandboxSimulation';

/** Add and remove bodies for the "empty space" sandbox. The first body is the centre. */
export function CustomBodyEditor({ bodies, onChange }: { bodies: CustomBodySpec[]; onChange: (bodies: CustomBodySpec[]) => void }) {
  const t = useTranslations('sandbox.editor');
  const [name, setName] = useState('');
  const [mass, setMass] = useState('1');
  const [distance, setDistance] = useState('1');
  const [speed, setSpeed] = useState('');
  const [error, setError] = useState('');

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const massSolar = Number(mass);
    const xAu = bodies.length === 0 ? 0 : Number(distance);
    if (!name.trim() || !Number.isFinite(massSolar) || massSolar <= 0 || !Number.isFinite(xAu)) {
      setError(t('invalid'));
      return;
    }
    const centralMass = bodies[0]?.massSolar ?? 0;
    const vy = bodies.length === 0 ? 0 : speed.trim() === '' ? circularSpeedKmS(centralMass, Math.abs(xAu)) : Number(speed);
    if (!Number.isFinite(vy)) {
      setError(t('invalid'));
      return;
    }
    const spec: CustomBodySpec = { name: name.trim(), massSolar, xAu: bodies.length === 0 ? 0 : (bodies[0]?.xAu ?? 0) + xAu, yAu: bodies[0]?.yAu ?? 0, vxKmS: bodies[0]?.vxKmS ?? 0, vyKmS: (bodies[0]?.vyKmS ?? 0) + vy };
    try {
      customScenario([...bodies, spec]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('invalid'));
      return;
    }
    onChange([...bodies, spec]);
    setName('');
  }

  const input = `mt-1 w-full rounded border border-panel-border bg-background px-2 py-1.5 font-mono text-xs ${focusRing()}`;

  return (
    <section className="rounded-lg border border-panel-border bg-background/50 p-4 text-xs" aria-label={t('title')}>
      <h2 className="text-sm font-semibold">{t('title')}</h2>
      <p className="mt-1 text-foreground/55">{bodies.length === 0 ? t('firstHint') : t('nextHint')}</p>
      <form onSubmit={add} className="mt-3 grid gap-2" noValidate>
        <label className="text-foreground/60">{t('name')}<input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <label className="text-foreground/60">{t('mass')}<input className={input} inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} /></label>
        {bodies.length > 0 ? (
          <>
            <label className="text-foreground/60">{t('distance')}<input className={input} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} /></label>
            <label className="text-foreground/60">{t('speed')}<input className={input} inputMode="decimal" value={speed} placeholder={t('speedPlaceholder')} onChange={(e) => setSpeed(e.target.value)} /></label>
          </>
        ) : null}
        {error ? <p role="alert" className="text-red-300">{error}</p> : null}
        <button type="submit" className={`inline-flex items-center justify-center gap-1.5 rounded bg-accent-cyan/20 px-3 py-2 text-accent-cyan ${focusRing()}`}><Plus size={14} aria-hidden />{t('add')}</button>
      </form>
      {bodies.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {bodies.map((body, index) => (
            <li key={body.name} className="flex items-center justify-between gap-2 rounded border border-panel-border px-2 py-1">
              <span className="truncate">{body.name} <span className="text-foreground/45">{body.massSolar} M☉</span></span>
              <button type="button" aria-label={t('remove', { name: body.name })} onClick={() => onChange(index === 0 ? [] : bodies.filter((_, i) => i !== index))} className={`text-foreground/50 hover:text-red-300 ${focusRing()}`}><Trash2 size={13} aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
