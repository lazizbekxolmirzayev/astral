/**
 * The game's sound, synthesised with the Web Audio API (no audio files): an engine rumble that follows the
 * thrust, a blast for a failed launch and a short blip for interface clicks. Browsers only allow sound after
 * a user gesture, so the audio context is created by the first `unlock()` (called from a click handler).
 * Everything is optional: with no Web Audio, or muted, every call is a no-op.
 */
type Engine = { context: AudioContext; master: GainNode; rumble: GainNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode };

let engine: Engine | null = null;
let muted = false;
const listeners = new Set<() => void>();

function create(): Engine | null {
  const Ctor = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise: a low rumble
      data[index] = last * 3.5;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const rumble = context.createGain();
    rumble.gain.value = 0;
    noise.connect(filter).connect(rumble).connect(master);
    noise.start();
    return { context, master, rumble, noise, filter };
  } catch {
    return null;
  }
}

/** Call from a click handler: starts (or resumes) the audio context. */
export function unlock(): void {
  engine ??= create();
  if (engine && engine.context.state === 'suspended') void engine.context.resume().catch(() => undefined);
}

/** Engine thrust 0..1, called every frame by the launch scene. */
export function setThrust(thrust: number): void {
  if (!engine) return;
  const level = Math.min(1, Math.max(0, thrust));
  const now = engine.context.currentTime;
  engine.rumble.gain.setTargetAtTime(level * 0.9, now, 0.12);
  engine.filter.frequency.setTargetAtTime(160 + level * 520, now, 0.2);
}

export function blip(frequency = 660, seconds = 0.08): void {
  if (!engine || muted) return;
  const { context, master } = engine;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
  oscillator.connect(gain).connect(master);
  oscillator.start();
  oscillator.stop(context.currentTime + seconds + 0.02);
}

/** A short low blast for a failed launch. */
export function blast(): void {
  if (!engine || muted) return;
  const { context, master, filter, rumble } = engine;
  const now = context.currentTime;
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(120, now + 1.4);
  rumble.gain.cancelScheduledValues(now);
  rumble.gain.setValueAtTime(1.4, now);
  rumble.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
  void master;
}

/** The click-and-hiss of a radio opening before someone speaks. */
export function radioClick(): void {
  if (!engine || muted) return;
  const { context, master } = engine;
  const now = context.currentTime;
  const length = Math.floor(context.sampleRate * 0.14);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 0.8;
  const gain = context.createGain();
  gain.gain.value = 0.35;
  source.connect(band).connect(gain).connect(master);
  source.start(now);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (engine) engine.master.gain.setTargetAtTime(value ? 0 : 0.6, engine.context.currentTime, 0.05);
  listeners.forEach((listener) => listener());
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
