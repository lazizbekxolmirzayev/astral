/**
 * The voices of the mission: mission control and the crew call out the countdown, the climb and every later
 * stage. `createAnnouncer` is pure (it decides *what* is said from the flight state, each line once); speaking
 * uses the browser's speech synthesis, shown as subtitles too, so it works with sound off or no voices.
 */
import type { StageId } from '@/mission/sim';
import { isMuted, radioClick } from './audio';

export type Speaker = 'mcc' | 'crew';
export type VoiceLine = { id: string; speaker: Speaker; key: string; params?: Record<string, string | number> };

export type AnnouncerInput = {
  stage: StageId;
  /** Seconds into the stage, and the stage's planned length (mission seconds). */
  stageElapsedS: number;
  stageLengthS: number;
  altitudeKm: number;
  speedKms: number;
  /** Altitude of the parking orbit the ascent is heading for. */
  parkingKm: number;
  hasBoosters: boolean;
  /** Separation fractions of the launch stage, the same as the picture uses. */
  separation: { boosters: number; stage1: number; fairing: number };
  lost: boolean;
};

const round = (value: number, digits = 0) => Number(value.toFixed(digits));

export function createAnnouncer() {
  const fired = new Set<string>();
  let lastStage: StageId | null = null;
  const out: VoiceLine[] = [];
  const say = (id: string, speaker: Speaker, key: string, params?: Record<string, string | number>) => {
    if (fired.has(id)) return;
    fired.add(id);
    out.push({ id, speaker, key, params });
  };
  return {
    reset() {
      fired.clear();
      lastStage = null;
    },
    update(input: AnnouncerInput): VoiceLine[] {
      out.length = 0;
      const { stage, stageElapsedS, stageLengthS, altitudeKm, speedKms, parkingKm } = input;
      // starting over (a restart) clears what was said
      if (lastStage !== null && stage === 'pre-launch' && lastStage !== 'pre-launch') fired.clear();
      lastStage = stage;
      if (input.lost) {
        say('lost', 'mcc', 'lost');
        return [...out];
      }
      if (stage === 'pre-launch') {
        const remaining = Math.ceil(stageLengthS - stageElapsedS);
        if (remaining <= 60) say('cd60', 'mcc', 'cd60');
        if (remaining <= 30) say('cd30', 'mcc', 'cd30');
        if (remaining <= 10 && remaining >= 1) say(`count-${remaining}`, 'mcc', 'count', { n: remaining });
      } else if (stage === 'launch') {
        const tau = stageLengthS > 0 ? stageElapsedS / stageLengthS : 0;
        say('liftoff', 'crew', 'liftoff');
        if (tau >= 0.02) say('tower', 'mcc', 'tower');
        if (tau >= 0.06) say('roll', 'crew', 'roll');
        if (tau >= 0.15) say('maxq-1', 'mcc', 'maxqApproach');
        if (tau >= 0.26) say('maxq-2', 'mcc', 'maxqPass');
        if (tau >= 0.31) say('progress-1', 'mcc', 'progress', { altitude: round(altitudeKm), speed: round(speedKms, 1) });
        if (input.hasBoosters && tau >= input.separation.boosters) say('boosters', 'crew', 'boosterSep');
        if (tau >= 0.5) say('progress-2', 'mcc', 'progress', { altitude: round(altitudeKm), speed: round(speedKms, 1) });
        if (tau >= input.separation.stage1) say('stage1', 'crew', 'stageSep');
        if (tau >= input.separation.fairing) say('fairing', 'crew', 'fairingSep');
        if (tau >= 0.7) say('orbit-1', 'mcc', 'toOrbit', { distance: round(Math.max(0, parkingKm - altitudeKm)) });
        if (tau >= 0.85) say('orbit-2', 'mcc', 'toOrbit', { distance: round(Math.max(0, parkingKm - altitudeKm)) });
        if (tau >= 0.92) say('orbit-3', 'crew', 'secondsToOrbit', { seconds: Math.max(1, round(stageLengthS - stageElapsedS)) });
      } else if (stage === 'orbit-insertion') {
        say('meco', 'crew', 'meco');
        say('orbit-ok', 'mcc', 'orbitConfirmed', { altitude: round(altitudeKm) });
      } else if (stage === 'cruise') say('cruise', 'mcc', 'cruise');
      else if (stage === 'destination-arrival') say('arrival', 'mcc', 'arrival');
      else if (stage === 'science-operations') say('science', 'mcc', 'science');
      else if (stage === 'data-transmission') say('data', 'mcc', 'data');
      else if (stage === 'mission-completion') say('done', 'mcc', 'done');
      return [...out];
    },
  };
}

/* ---- speaking ---- */

type Listener = () => void;
let current: { id: string; speaker: Speaker; text: string; at: number } | null = null;
const listeners = new Set<Listener>();
export const subtitleSnapshot = () => current;
export function subscribeSubtitle(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Languages tried in order for each game language (Uzbek voices are rare, Turkish and Russian read Latin Uzbek best). */
const VOICE_LANGS: Record<string, string[]> = { uz: ['uz', 'tr', 'ru'], ru: ['en'], en: ['en'] };

function pickVoice(locale: string, speaker: Speaker): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const lang of VOICE_LANGS[locale] ?? ['en']) {
    const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(lang));
    if (matching.length > 0) return matching[speaker === 'crew' ? matching.length - 1 : 0]!;
  }
  return null;
}

/** Shows a line as a subtitle and, unless muted, says it aloud (crew and control sound different). */
export function speakLine(id: string, speaker: Speaker, text: string, locale: string, options: { skipIfBusy?: boolean } = {}): void {
  current = { id, speaker, text, at: Date.now() };
  listeners.forEach((listener) => listener());
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => { current = null; listeners.forEach((listener) => listener()); }, Math.max(3200, text.length * 85));
  if (!isMuted()) radioClick();
  if (isMuted() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (options.skipIfBusy && synth.speaking) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(locale, speaker);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = locale === 'uz' ? 'uz-UZ' : 'en-US';
    utterance.rate = speaker === 'mcc' ? 1.05 : 0.95;
    utterance.pitch = speaker === 'mcc' ? 0.9 : 1.1;
    utterance.volume = 0.9;
    synth.speak(utterance);
  } catch {
    /* no speech: the subtitle is enough */
  }
}

export function stopSpeaking(): void {
  if (clearTimer) clearTimeout(clearTimer);
  current = null;
  listeners.forEach((listener) => listener());
  try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* nothing to stop */ }
}
