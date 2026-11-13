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
        if (tau >= 0.1) say('maxq-1', 'mcc', 'maxqApproach');
        if (tau >= 0.17) say('maxq-2', 'mcc', 'maxqPass');
        if (tau >= 0.2) say('progress-1', 'mcc', 'progress', { altitude: round(altitudeKm), speed: round(speedKms, 1) });
        if (input.hasBoosters && tau >= input.separation.boosters) say('boosters', 'crew', 'boosterSep');
        if (tau >= 0.45) say('progress-2', 'mcc', 'progress', { altitude: round(altitudeKm), speed: round(speedKms, 1) });
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

/** Languages tried in order for each game language (Uzbek voices are rare; Turkish reads Latin-script Uzbek best). */
const VOICE_LANGS: Record<string, string[]> = { uz: ['uz', 'tr'], ru: ['ru'], en: ['en'] };
const FALLBACK_LANG: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

/** Higher is clearer: neural / online / "Google" voices sound much better than the old local ones. */
export function voiceQuality(voice: Pick<SpeechSynthesisVoice, 'name' | 'localService'>): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/natural|neural|premium|enhanced/.test(name)) score += 4;
  if (/google|online|microsoft/.test(name)) score += 2;
  if (voice.localService === false) score += 1;
  if (/espeak|compact/.test(name)) score -= 3;
  return score;
}

function pickVoice(locale: string, speaker: Speaker): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const lang of VOICE_LANGS[locale] ?? ['en']) {
    const matching = voices.filter((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith(lang)).sort((a, b) => voiceQuality(b) - voiceQuality(a));
    if (matching.length > 0) return matching[speaker === 'crew' && matching.length > 1 ? 1 : 0]!;
  }
  return null;
}

/**
 * Uzbek has no voice in almost any browser, and a Turkish voice reading Uzbek sounds wrong. When the browser has no
 * Uzbek voice, the line is read by the Google Translate text-to-speech voice (Uzbek, `tl=uz`) through an <audio> element.
 * It is an unofficial public endpoint: if it cannot be reached (offline, blocked, rate-limited) the line falls back to
 * the browser voice below, and the subtitle is always shown.
 */
let cloudAudio: HTMLAudioElement | null = null;
let cloudRun = 0;
const hasNativeVoice = (lang: string) => typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith(lang));

export function cloudChunks(text: string, limit = 170): string[] {
  const clean = text.replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?;:]+[.!?;:]?/g) ?? [clean];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let rest = sentence.trim();
    while (rest.length > limit) {
      const cut = rest.lastIndexOf(' ', limit);
      chunks.push(rest.slice(0, cut > 40 ? cut : limit).trim());
      rest = rest.slice(cut > 40 ? cut : limit).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

function stopCloud() {
  cloudRun += 1;
  if (cloudAudio) { cloudAudio.pause(); cloudAudio.removeAttribute('src'); cloudAudio = null; }
}

function speakCloud(text: string, lang: string, onFail: () => void): void {
  stopCloud();
  const run = cloudRun;
  const chunks = cloudChunks(text);
  const next = (index: number) => {
    if (run !== cloudRun || index >= chunks.length) return;
    const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(chunks[index]!)}`);
    cloudAudio = audio;
    audio.volume = 1;
    audio.onended = () => next(index + 1);
    audio.onerror = () => { if (run === cloudRun && index === 0) onFail(); };
    audio.play().catch(() => { if (run === cloudRun && index === 0) onFail(); });
  };
  next(0);
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
  if (options.skipIfBusy && (synth.speaking || cloudAudio)) return;
  if (locale === 'uz' && !hasNativeVoice('uz')) {
    speakCloud(text, 'uz', () => speakBrowser(text, speaker, locale, options));
    return;
  }
  speakBrowser(text, speaker, locale, options);
}

function speakBrowser(text: string, speaker: Speaker, locale: string, options: { skipIfBusy?: boolean }): void {
  const synth = window.speechSynthesis;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(locale, speaker);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = FALLBACK_LANG[locale] ?? 'en-US';
    // plain settings stay clearest: strong pitch or fast rate makes synthetic voices muddy
    utterance.rate = speaker === 'mcc' ? 0.95 : 0.9;
    utterance.pitch = speaker === 'mcc' ? 0.95 : 1.05;
    utterance.volume = 1;
    // a new call replaces a backlog of old ones, so the voice never lags behind the flight
    if (!options.skipIfBusy) { stopCloud(); synth.cancel(); }
    synth.speak(utterance);
  } catch {
    /* no speech: the subtitle is enough */
  }
}

export function stopSpeaking(): void {
  if (clearTimer) clearTimeout(clearTimer);
  current = null;
  listeners.forEach((listener) => listener());
  stopCloud();
  try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* nothing to stop */ }
}
