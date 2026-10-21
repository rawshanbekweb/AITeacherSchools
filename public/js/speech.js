// Voice I/O: browser Text-to-Speech + Speech-to-Text, behind small interfaces so a server
// provider (e.g. a neural TTS) can replace them later (spec §7, §11 "pluggable providers").

const LANG_TAG = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
// Uzbek voices are rare in browsers: fall back to Turkish (close Latin phonetics), then any.
const FALLBACK = { uz: ['uz', 'tr', 'kk', 'ru'], ru: ['ru'], en: ['en'] };
const MALE = /male|man|dmitr|pavel|maxim|yuri|sardor|ahmet|guy|david|mark|daniel|george|thomas|alex(?!a)|erkak|муж/i;
const FEMALE = /female|woman|madina|irina|svetlana|milena|zira|samantha|karen|ayşe|seda|dariya|катя|жен/i;

export class Voice {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.muted = false;
    this.volume = 1;
    this.rate = 1;
    this.manual = {}; // lang → voiceURI picked by the user
    this.current = null;
    if (this.synth) {
      const load = () => { this.voices = this.synth.getVoices(); };
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }

  voicesFor(lang) {
    const prefs = FALLBACK[lang] || [lang];
    return this.voices.filter((v) => prefs.some((p) => v.lang.toLowerCase().startsWith(p)));
  }

  pick(lang, gender = 'male') {
    if (!this.voices.length) return null;
    if (this.manual[lang]) {
      const v = this.voices.find((x) => x.voiceURI === this.manual[lang]);
      if (v) return v;
    }
    for (const p of FALLBACK[lang] || [lang]) {
      const cands = this.voices.filter((v) => v.lang.toLowerCase().startsWith(p));
      if (!cands.length) continue;
      const score = (v) => (gender === 'male' ? (MALE.test(v.name) ? 3 : 0) - (FEMALE.test(v.name) ? 2 : 0) : (FEMALE.test(v.name) ? 3 : 0)) + (/natural|neural|online|premium|enhanced/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
      return cands.sort((a, b) => score(b) - score(a))[0];
    }
    return null;
  }

  describe(lang, gender) {
    const v = this.pick(lang, gender);
    if (!v) return { name: 'Ovoz topilmadi — subtitrlar rejimi', native: false, available: false };
    return { name: `${v.name} (${v.lang})`, native: v.lang.toLowerCase().startsWith(lang), available: true };
  }

  /**
   * Speak text. Resolves { completed } — false when cancelled.
   * hooks: onStart(estimatedSeconds), onBoundary(charIndex), onEnd()
   */
  speak(text, { lang = 'uz', gender = 'male', hooks = {} } = {}) {
    this.cancel();
    return new Promise((resolve) => {
      const voice = this.pick(lang, gender);
      let settled = false;
      const done = (completed) => {
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
        hooks.onStart?.(secs);
        this.timer = setTimeout(() => done(true), secs * 1000);
        this.current = { cancel: () => done(false) };
      };
      if (!this.synth || !voice || this.muted) return silent();

      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang || LANG_TAG[lang];
      u.rate = this.rate * (lang === 'uz' && !voice.lang.startsWith('uz') ? 0.92 : 1);
      u.volume = this.volume;
      u.pitch = 1;
      let started = false;
      u.onstart = () => { started = true; hooks.onStart?.(); };
      u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) hooks.onBoundary?.(e.charIndex); };
      u.onend = () => done(true);
      u.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return done(false);
        // e.g. autoplay policy: fall back to subtitles instead of stalling the lesson
        if (!started) { settled = false; silent(); } else done(true);
      };
      this.current = { cancel: () => { this.synth.cancel(); done(false); } };
      this.synth.speak(u);
      // Chrome sometimes never fires onstart for unavailable voices: watchdog.
      this.timer = setTimeout(() => { if (!started && !settled) { this.synth.cancel(); settled = false; silent(); } }, 2500);
    });
  }

  cancel() {
    const c = this.current;
    this.current = null;
    if (c) c.cancel();
    else if (this.synth?.speaking) this.synth.cancel();
  }
}

export class Ears {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.SR = SR;
    this.active = null;
  }

  /** Listen once. Resolves { text, confidence } or null. onInterim(text) shows live transcript. */
  listen({ lang = 'uz', onInterim, timeoutMs = 9000 } = {}) {
    this.stop();
    if (!this.supported) return Promise.resolve(null);
    return new Promise((resolve) => {
      const r = new this.SR();
      r.lang = LANG_TAG[lang] || lang;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.continuous = false;
      let best = null;
      const finish = () => { clearTimeout(t); this.active = null; resolve(best); };
      r.onresult = (e) => {
        let text = '';
        let conf = 0;
        for (const res of e.results) { text += res[0].transcript; conf = res[0].confidence || conf; }
        onInterim?.(text);
        best = { text: text.trim(), confidence: conf };
      };
      r.onerror = () => {};
      r.onend = finish;
      const t = setTimeout(() => r.stop(), timeoutMs);
      this.active = r;
      try { r.start(); } catch { finish(); }
    });
  }

  stop() { try { this.active?.abort(); } catch { /* ignore */ } this.active = null; }
}

export async function checkDevices() {
  const out = { camera: 'unknown', microphone: 'unknown', speaker: 'unknown' };
  try {
    const list = await navigator.mediaDevices?.enumerateDevices();
    if (list) {
      out.camera = list.some((d) => d.kind === 'videoinput') ? 'available' : 'missing';
      out.microphone = list.some((d) => d.kind === 'audioinput') ? 'available' : 'missing';
      out.speaker = list.some((d) => d.kind === 'audiooutput') || window.speechSynthesis ? 'available' : 'missing';
    }
  } catch { /* permissions / insecure context */ }
  return out;
}
