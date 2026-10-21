// Voice I/O behind small interfaces (spec §7, §11 "pluggable providers"):
// - neural server voice (/api/tts, Azure) with real-audio lip-sync, when configured;
// - browser speech synthesis otherwise; subtitle-only timing as the last resort.
import type { Lang } from '@/lib/core/types';

const LANG_TAG: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
// Uzbek voices are rare in browsers: fall back to Turkish (close Latin phonetics), then others.
const FALLBACK: Record<string, string[]> = { uz: ['uz', 'tr', 'kk', 'ru'], ru: ['ru'], en: ['en'] };
const MALE = /male|man|dmitr|pavel|maxim|yuri|sardor|ahmet|guy|david|mark|daniel|george|thomas|andrew|alex(?!a)|erkak|муж/i;
const FEMALE = /female|woman|madina|irina|svetlana|milena|zira|samantha|karen|ayşe|seda|dariya|ava|катя|жен/i;

export interface SpeakHooks {
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onAudio?: (el: HTMLAudioElement, analyser: AnalyserNode) => void;
  onEnd?: () => void;
}
export interface SpeakOptions { lang?: string; gender?: 'male' | 'female'; hooks?: SpeakHooks }

export class Voice {
  synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null;
  voices: SpeechSynthesisVoice[] = [];
  muted = false;
  volume = 1;
  rate = 1;
  manual: Record<string, string | undefined> = {};
  /** Set from /api/health: the server can synthesise a neural voice. */
  serverTts = false;
  private current: { cancel: () => void } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (this.synth) {
      const load = () => { this.voices = this.synth!.getVoices(); };
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }

  /** Must be called from a user gesture once, so audio can start on classroom PCs. */
  unlock() {
    if (!this.audioCtx && typeof AudioContext !== 'undefined') this.audioCtx = new AudioContext();
    void this.audioCtx?.resume();
  }

  pick(lang: string, gender: 'male' | 'female' = 'male') {
    if (!this.voices.length) return null;
    const manual = this.manual[lang];
    if (manual) {
      const v = this.voices.find((x) => x.voiceURI === manual);
      if (v) return v;
    }
    for (const p of FALLBACK[lang] ?? [lang]) {
      const cands = this.voices.filter((v) => v.lang.toLowerCase().startsWith(p));
      if (!cands.length) continue;
      const score = (v: SpeechSynthesisVoice) =>
        (gender === 'male' ? (MALE.test(v.name) ? 3 : 0) - (FEMALE.test(v.name) ? 2 : 0) : FEMALE.test(v.name) ? 3 : 0) +
        (/natural|neural|online|premium|enhanced/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
      return cands.sort((a, b) => score(b) - score(a))[0];
    }
    return null;
  }

  describe(lang: string, gender: 'male' | 'female' = 'male') {
    if (this.serverTts) return { name: 'Neyron server ovozi (Azure)', native: true, available: true };
    const v = this.pick(lang, gender);
    if (!v) return { name: 'Ovoz topilmadi — subtitrlar rejimi', native: false, available: false };
    return { name: `${v.name} (${v.lang})`, native: v.lang.toLowerCase().startsWith(lang), available: true };
  }

  /** Speak text. Resolves { completed } — false when cancelled. */
  async speak(text: string, { lang = 'uz', gender = 'male', hooks = {} }: SpeakOptions = {}): Promise<{ completed: boolean }> {
    this.cancel();
    if (this.serverTts && !this.muted) {
      const r = await this.speakServer(text, lang, gender, hooks);
      if (r) return r;
    }
    return this.speakBrowser(text, lang, gender, hooks);
  }

  private async speakServer(text: string, lang: string, gender: string, hooks: SpeakHooks): Promise<{ completed: boolean } | null> {
    let cancelled = false;
    this.current = { cancel: () => { cancelled = true; } };
    let blob: Blob;
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, gender, rate: this.rate }) });
      if (!res.ok) throw new Error(String(res.status));
      blob = await res.blob();
    } catch {
      this.serverTts = false; // degrade to browser voice for the rest of the lesson
      return null;
    }
    if (cancelled) return { completed: false };
    this.unlock();
    const el = new Audio(URL.createObjectURL(blob));
    el.volume = this.volume;
    return new Promise((resolve) => {
      let settled = false;
      const done = (completed: boolean) => {
        if (settled) return;
        settled = true;
        el.pause();
        URL.revokeObjectURL(el.src);
        this.current = null;
        hooks.onEnd?.();
        resolve({ completed });
      };
      this.current = { cancel: () => done(false) };
      el.onended = () => done(true);
      el.onerror = () => done(true);
      el.onloadedmetadata = () => {
        if (this.audioCtx) {
          const src = this.audioCtx.createMediaElementSource(el);
          const analyser = this.audioCtx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
          analyser.connect(this.audioCtx.destination);
          hooks.onAudio?.(el, analyser);
        }
        hooks.onStart?.();
        el.play().catch(() => done(true));
      };
    });
  }

  private speakBrowser(text: string, lang: string, gender: 'male' | 'female', hooks: SpeakHooks): Promise<{ completed: boolean }> {
    return new Promise((resolve) => {
      const voice = this.pick(lang, gender);
      let settled = false;
      const done = (completed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.timer);
        this.current = null;
        hooks.onEnd?.();
        resolve({ completed });
      };
      const silent = () => {
        // Subtitle-only mode: no TTS voice (or muted) — keep the lesson timing realistic.
        const secs = Math.max(1.2, text.length / (13 * this.rate)) + 0.3;
        hooks.onStart?.();
        this.timer = setTimeout(() => done(true), secs * 1000);
        this.current = { cancel: () => done(false) };
      };
      if (!this.synth || !voice || this.muted) return silent();

      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang || LANG_TAG[lang];
      u.rate = this.rate * (lang === 'uz' && !voice.lang.startsWith('uz') ? 0.92 : 1);
      u.volume = this.volume;
      let started = false;
      u.onstart = () => { started = true; hooks.onStart?.(); };
      u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) hooks.onBoundary?.(e.charIndex); };
      u.onend = () => done(true);
      u.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return done(false);
        // e.g. autoplay policy: fall back to subtitles instead of stalling the lesson
        if (!started) silent(); else done(true);
      };
      this.current = { cancel: () => { this.synth!.cancel(); done(false); } };
      this.synth.speak(u);
      // Some engines never fire onstart for unavailable voices: watchdog.
      this.timer = setTimeout(() => { if (!started && !settled) { this.synth!.cancel(); silent(); } }, 2500);
    });
  }

  cancel() {
    const c = this.current;
    this.current = null;
    if (c) c.cancel();
    else if (this.synth?.speaking) this.synth.cancel();
  }
}

type SR = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void;
};
type SRCtor = new () => SR;

export class Ears {
  SR: SRCtor | null;
  supported: boolean;
  private active: SR | null = null;

  constructor() {
    const w = (typeof window !== 'undefined' ? window : {}) as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    this.SR = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    this.supported = !!this.SR;
  }

  create(lang: Lang | string) {
    const r = new this.SR!();
    r.lang = LANG_TAG[lang] ?? lang;
    return r;
  }

  /** Listen once. Resolves { text, confidence } or null. */
  listen({ lang = 'uz', onInterim, timeoutMs = 9000 }: { lang?: string; onInterim?: (t: string) => void; timeoutMs?: number } = {}): Promise<{ text: string; confidence: number } | null> {
    this.stop();
    if (!this.supported) return Promise.resolve(null);
    return new Promise((resolve) => {
      const r = this.create(lang);
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.continuous = false;
      let best: { text: string; confidence: number } | null = null;
      const t = setTimeout(() => r.stop(), timeoutMs);
      const finish = () => { clearTimeout(t); this.active = null; resolve(best); };
      r.onresult = (e) => {
        let text = '';
        let conf = 0;
        for (const res of Array.from(e.results)) { text += res[0].transcript; conf = res[0].confidence || conf; }
        onInterim?.(text);
        best = { text: text.trim(), confidence: conf };
      };
      r.onerror = () => {};
      r.onend = finish;
      this.active = r;
      try { r.start(); } catch { finish(); }
    });
  }

  stop() {
    try { this.active?.abort(); } catch { /* ignore */ }
    this.active = null;
  }
}

export async function checkDevices() {
  const out = { camera: 'unknown', microphone: 'unknown' } as Record<'camera' | 'microphone', 'available' | 'missing' | 'unknown'>;
  try {
    const list = await navigator.mediaDevices?.enumerateDevices();
    if (list) {
      out.camera = list.some((d) => d.kind === 'videoinput') ? 'available' : 'missing';
      out.microphone = list.some((d) => d.kind === 'audioinput') ? 'available' : 'missing';
    }
  } catch { /* permissions / insecure context */ }
  return out;
}
