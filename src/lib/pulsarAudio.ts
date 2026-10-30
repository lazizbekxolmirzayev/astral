/**
 * Sonification of a pulsar: one short click per rotation, at the real pulse
 * period. At ~11 Hz (Vela) you hear a rapid ticking; at ~30 Hz (Crab) the
 * ticks fuse into a buzzing tone — the same effect as a real radio-telescope
 * pulsar recording. The sound is synthesised, not a recording.
 *
 * Pulses are scheduled on the audio clock with a look-ahead, so timing does
 * not depend on setInterval accuracy or on the page's frame rate.
 */

export const LOOKAHEAD_SECONDS = 0.2;
export const SCHEDULER_TICK_MS = 40;

/** Pulse start times in [from, until) that lie on the grid next + k·period. */
export function pulseTimes(nextPulse: number, until: number, periodSeconds: number): number[] {
  if (!(periodSeconds > 0) || !Number.isFinite(periodSeconds)) return [];
  const times: number[] = [];
  for (let t = nextPulse; t < until && times.length < 1000; t += periodSeconds) times.push(t);
  return times;
}

export type PulsarAudio = {
  stop(): void;
  setVolume(volume: number): void;
  context: AudioContext;
};

function makeNoise(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.05);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22695477;
  for (let i = 0; i < length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 2147483648 - 1) * (1 - i / length);
  }
  return buffer;
}

/**
 * Must be called synchronously inside a user gesture (click/tap) so that
 * browsers — iOS Safari in particular — allow the audio context to run.
 */
export function startPulsarAudio(periodMs: number, volume = 0.5): PulsarAudio | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const context = new Ctor();
  void context.resume();

  const master = context.createGain();
  master.gain.value = volume;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(context.destination);

  // Silent buffer: some mobile browsers only unlock output after real playback.
  const unlock = context.createBufferSource();
  unlock.buffer = context.createBuffer(1, 1, context.sampleRate);
  unlock.connect(context.destination);
  unlock.start(0);

  const noise = makeNoise(context);
  const period = Math.max(0.005, periodMs / 1000);
  // Sound character depends on rate: slow pulsars get a clear "thump".
  const toneHz = period > 0.06 ? 150 : 260;

  function pulse(at: number) {
    const click = context.createBufferSource();
    click.buffer = noise;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.9;
    const clickGain = context.createGain();
    clickGain.gain.setValueAtTime(0.9, at);
    clickGain.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
    click.connect(band);
    band.connect(clickGain);
    clickGain.connect(master);
    click.start(at);

    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(toneHz * 1.6, at);
    osc.frequency.exponentialRampToValueAtTime(toneHz, at + 0.025);
    const oscGain = context.createGain();
    oscGain.gain.setValueAtTime(0.0001, at);
    oscGain.gain.exponentialRampToValueAtTime(0.7, at + 0.003);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(0.09, period * 0.9));
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(at);
    osc.stop(at + 0.1);
  }

  let next = context.currentTime + 0.05;
  function schedule() {
    const horizon = context.currentTime + LOOKAHEAD_SECONDS;
    const times = pulseTimes(next, horizon, period);
    for (const t of times) pulse(t);
    if (times.length > 0) next = (times[times.length - 1] as number) + period;
    else if (next < context.currentTime) next = context.currentTime + 0.01;
  }
  schedule();
  const timer = window.setInterval(schedule, SCHEDULER_TICK_MS);

  return {
    context,
    setVolume(v: number) { master.gain.setTargetAtTime(Math.min(1, Math.max(0, v)), context.currentTime, 0.02); },
    stop() {
      window.clearInterval(timer);
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.02);
      window.setTimeout(() => { void context.close().catch(() => undefined); }, 150);
    },
  };
}
