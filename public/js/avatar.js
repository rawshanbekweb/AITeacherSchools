// Photoreal talking avatar from a single photo.
// A fragment shader inverse-warps the photo every frame: jaw/lip opening with a rendered mouth
// interior, lip spread/rounding, smiles, eyelid blinks, gaze saccades, brow raises, head
// rotation/nods/parallax turn and breathing. Landmarks come from the Avatar studio (Admin).
// Lip-sync is driven by a viseme timeline built from the spoken text and re-synced by TTS
// word-boundary events.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() { v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5); gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform vec2 u_eyeL, u_eyeR, u_eyeSize, u_mL, u_mC, u_mR, u_chin, u_neck;
uniform float u_open, u_spread, u_round, u_smile, u_blinkL, u_blinkR, u_brow, u_rot, u_yaw, u_breath;
uniform vec2 u_gaze, u_headT;
varying vec2 v_uv;
float lash = 0.0;

float lipY(float x) {
  x = clamp(x, u_mL.x, u_mR.x);
  float x0 = u_mL.x, x1 = u_mC.x, x2 = u_mR.x;
  return u_mL.y * (x - x1) * (x - x2) / ((x0 - x1) * (x0 - x2))
       + u_mC.y * (x - x0) * (x - x2) / ((x1 - x0) * (x1 - x2))
       + u_mR.y * (x - x0) * (x - x1) / ((x2 - x0) * (x2 - x1));
}

vec2 eye(vec2 p, vec2 c, float blink) {
  vec2 r = u_eyeSize * vec2(1.3, 1.0);
  vec2 q = (p - c) / r;
  float e = length(q);
  if (e >= 1.0) return p;
  float w = 1.0 - smoothstep(0.7, 1.0, e);
  float gm = 1.0 - smoothstep(0.25, 0.8, length((p - c) / (u_eyeSize * vec2(0.95, 0.75))));
  p -= u_gaze * gm;
  float top = c.y - r.y;
  float h = 2.0 * r.y;
  float v = (p.y - top) / h;
  float s0 = 0.25;
  float horiz = sqrt(max(0.0, 1.0 - q.x * q.x));
  float L = mix(s0, 0.8, clamp(blink, 0.0, 1.0) * horiz);
  if (v < L) p.y = mix(p.y, top + (s0 * v / L) * h, w);
  if (blink > 0.04) lash = max(lash, (1.0 - smoothstep(0.0, 0.05, abs(v - L))) * w * smoothstep(0.04, 0.4, blink) * horiz);
  return p;
}

void main() {
  vec2 p = v_uv * u_size;
  float iod = distance(u_eyeL, u_eyeR);
  float mw = distance(u_mL, u_mR) * 0.5;
  vec2 mc = (u_mL + u_mR) * 0.5;

  // breathing: shoulders and everything above rise slightly
  p.y = u_size.y - (u_size.y - p.y) / (1.0 + u_breath);

  // head pose around the neck pivot, fading out over the neck
  float hm = 1.0 - smoothstep(u_chin.y + 0.1 * iod, u_neck.y + 0.45 * iod, p.y);
  vec2 d = p - u_neck - u_headT * hm;
  float a = -u_rot * hm;
  p = u_neck + vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);

  // turn: the inner face shifts more than the silhouette (parallax)
  vec2 fc = mix((u_eyeL + u_eyeR) * 0.5, u_mC, 0.45);
  float fm = 1.0 - smoothstep(0.35, 1.0, length((p - fc) / vec2(0.9 * iod, 1.3 * iod)));
  p.x -= u_yaw * fm;

  // brows
  vec2 bc = (u_eyeL + u_eyeR) * 0.5 - vec2(0.0, 0.36 * iod);
  float bm = 1.0 - smoothstep(0.25, 1.0, length((p - bc) / vec2(1.0 * iod, 0.3 * iod)));
  p.y += u_brow * bm;

  p = eye(p, u_eyeL, u_blinkL);
  p = eye(p, u_eyeR, u_blinkR);

  // smile: mouth corners move up and out, cheeks follow
  float sg = 2.0 * pow(0.6 * mw, 2.0);
  vec2 D = vec2(0.12 * mw, -0.2 * mw) * u_smile;
  p -= vec2(-D.x, D.y) * exp(-dot(p - u_mL, p - u_mL) / sg);
  p -= D * exp(-dot(p - u_mR, p - u_mR) / sg);

  // lip spread / rounding
  float mm = exp(-pow((p.x - mc.x) / (1.5 * mw), 2.0) - pow((p.y - mc.y) / (0.6 * mw), 2.0));
  float sx = 1.0 + (0.1 * u_spread - 0.16 * u_round) * mm;
  p.x = mc.x + (p.x - mc.x) / sx;

  // jaw + lips
  float ly = lipY(p.x);
  float t = (p.x - mc.x) / (mw * (1.0 - 0.22 * u_round));
  float prof = pow(max(0.0, 1.0 - t * t), 0.75);
  float openPx = u_open * 0.5 * mw;
  float up = openPx * 0.22 * prof;
  float dn = openPx * 0.78 * prof;
  float tj = clamp((p.x - mc.x) / (2.4 * mw), -1.0, 1.0);
  float jprof = cos(tj * 1.5708);
  float chinFade = 1.0 - smoothstep(u_chin.y, u_chin.y + 0.5 * iod, p.y);

  vec4 col;
  if (p.y <= ly - up) {
    float f = 1.0 - smoothstep(0.0, 0.5 * mw, (ly - up) - p.y);
    p.y += up * f;
    col = (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) ? vec4(0.0) : texture2D(u_tex, p / u_size);
  } else if (p.y >= ly + dn) {
    float k = smoothstep(0.0, 0.4 * mw, p.y - (ly + dn));
    p.y -= mix(dn, openPx * 0.78 * jprof, k) * chinFade;
    col = (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) ? vec4(0.0) : texture2D(u_tex, p / u_size);
  } else {
    // mouth interior
    float gh = up + dn;
    float g = (p.y - (ly - up)) / max(gh, 0.001);
    vec3 dark = vec3(0.11, 0.035, 0.035);
    vec3 m = mix(dark, vec3(0.45, 0.2, 0.2), smoothstep(0.6, 1.0, g) * smoothstep(0.35, 1.0, u_open));
    float th = min(0.42, 0.11 * mw / max(gh, 0.001));
    float teeth = (1.0 - smoothstep(th * 0.75, th, g)) * (1.0 - smoothstep(0.45, 0.75, abs(t)));
    vec3 tc = vec3(0.8, 0.76, 0.7) * (0.93 + 0.07 * cos(t * 24.0)) * mix(0.55, 1.0, smoothstep(0.0, 0.45, g / max(th, 0.01)));
    m = mix(m, tc, teeth * smoothstep(0.1, 0.35, u_open));
    m *= 0.7 + 0.3 * (1.0 - t * t);
    float edge = min(p.y - (ly - up), (ly + dn) - p.y);
    vec4 lip = texture2D(u_tex, vec2(p.x, ly + (p.y < ly ? -1.0 : 1.0)) / u_size);
    col = mix(lip * 0.85, vec4(m, 1.0), smoothstep(0.0, 1.8, edge));
  }
  col.rgb *= 1.0 - lash * 0.6;
  gl_FragColor = col;
}`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// Smooth value noise for idle motion.
function noise1(seed) {
  const pts = Array.from({ length: 64 }, () => Math.random() * 2 - 1);
  return (t) => {
    const x = t + seed;
    const i = Math.floor(x);
    const f = x - i;
    const a = pts[((i % 64) + 64) % 64];
    const b = pts[(((i + 1) % 64) + 64) % 64];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

// ─── Visemes ────────────────────────────────────────────────────────────────
const V_OPEN = /[aаяoоё]/;
const V_MID = /[eеэiиыüöə]/;
const V_ROUND = /[uуюo‘ўöü]/;
const CLOSED = /[mbpмбп]/;
const LABIODENTAL = /[fvфв]/;

export function textToVisemes(text, cps = 13) {
  const keys = [];
  let t = 0;
  const lower = text.toLowerCase();
  const charTime = new Array(lower.length + 1).fill(0);
  for (let i = 0; i < lower.length; i++) {
    charTime[i] = t;
    const ch = lower[i];
    let k;
    let dur = 1 / cps;
    if (/\s/.test(ch)) { k = { open: 0.05, spread: 0, round: 0 }; dur *= 0.5; }
    else if (/[,;:—–-]/.test(ch)) { k = { open: 0, spread: 0, round: 0 }; dur *= 2.5; }
    else if (/[.!?…]/.test(ch)) { k = { open: 0, spread: 0, round: 0 }; dur *= 4; }
    else if (V_ROUND.test(ch) && ch !== 'o') { k = { open: 0.35, spread: -0.2, round: 1 }; dur *= 1.25; }
    else if (V_OPEN.test(ch)) { k = { open: ch === 'o' || ch === 'о' ? 0.75 : 1, spread: 0, round: ch === 'o' || ch === 'о' ? 0.6 : 0 }; dur *= 1.3; }
    else if (V_MID.test(ch)) { k = { open: 0.5, spread: 0.8, round: 0 }; dur *= 1.15; }
    else if (CLOSED.test(ch)) { k = { open: 0, spread: 0, round: 0, closed: true }; dur *= 0.9; }
    else if (LABIODENTAL.test(ch)) { k = { open: 0.12, spread: 0.3, round: 0 }; dur *= 0.85; }
    else if (/[\p{L}\p{N}]/u.test(ch)) { k = { open: 0.28, spread: 0.2, round: 0 }; dur *= 0.75; }
    else continue;
    keys.push({ t, ...k });
    t += dur;
  }
  charTime[lower.length] = t;
  keys.push({ t, open: 0, spread: 0, round: 0 });
  return { keys, duration: t, charTime };
}

function sampleVisemes(v, time) {
  const ks = v.keys;
  if (!ks.length || time >= v.duration) return { open: 0, spread: 0, round: 0 };
  let lo = 0;
  let hi = ks.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (ks[mid].t <= time) lo = mid; else hi = mid; }
  const a = ks[lo];
  const b = ks[hi];
  const f = clamp((time - a.t) / Math.max(1e-3, b.t - a.t), 0, 1);
  // coarticulation: reach the target quickly, then hold
  const s = Math.min(1, f * 1.8);
  return { open: a.open + (b.open - a.open) * s * 0.5, spread: a.spread + (b.spread - a.spread) * s * 0.5, round: a.round + (b.round - a.round) * s * 0.5 };
}

// ─── Avatar ────────────────────────────────────────────────────────────────
export class Avatar {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.charisma = config.charisma ?? 0.7;
    this.cur = { open: 0, spread: 0, round: 0, smile: 0.15, blinkL: 0, blinkR: 0, brow: 0, rot: 0, yaw: 0, hx: 0, hy: 0, gx: 0, gy: 0, breath: 0 };
    this.mood = 'idle'; // idle | speaking | listening | thinking | happy
    this.speech = null; // { visemes, start, offset, emphasis }
    this.nod = 0;
    this.browPulse = 0;
    this.nextBlink = performance.now() + 1500;
    this.blinkStart = -1;
    this.nextSaccade = 0;
    this.gazeTarget = [0, 0];
    this.n = [noise1(1), noise1(17), noise1(33), noise1(51), noise1(77)];
    this.ready = this.init();
  }

  async init() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.config.image;
    await img.decode();
    this.img = img;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { this.fallback(); return; }
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.setImage(img);
    this.u = {};
    for (const n of ['u_size', 'u_eyeL', 'u_eyeR', 'u_eyeSize', 'u_mL', 'u_mC', 'u_mR', 'u_chin', 'u_neck', 'u_open', 'u_spread', 'u_round', 'u_smile', 'u_blinkL', 'u_blinkR', 'u_brow', 'u_rot', 'u_yaw', 'u_breath', 'u_gaze', 'u_headT']) this.u[n] = gl.getUniformLocation(prog, n);
    this.last = performance.now();
    const loop = (now) => { if (this.destroyed) return; this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setImage(img) {
    const gl = this.gl;
    this.img = img;
    // keep GPU work bounded on classroom PCs
    const scale = Math.min(1, 1600 / img.naturalHeight);
    this.scale = scale;
    this.canvas.width = Math.round(img.naturalWidth * scale);
    this.canvas.height = Math.round(img.naturalHeight * scale);
    if (!gl) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  async updateConfig(config) {
    const imageChanged = config.image && config.image !== this.config.image;
    this.config = { ...this.config, ...config, landmarks: { ...this.config.landmarks, ...(config.landmarks || {}) } };
    this.charisma = this.config.charisma ?? this.charisma;
    if (imageChanged) {
      const img = new Image();
      img.src = this.config.image;
      await img.decode();
      if (this.gl) this.setImage(img); else this.canvas.replaceWith(img);
    }
  }

  fallback() {
    // No WebGL: show the photo with CSS breathing only.
    const img = this.img;
    img.className = this.canvas.className + ' avatar-fallback';
    this.canvas.replaceWith(img);
  }

  // ── public control API ──
  setMood(mood) { this.mood = mood; }
  /** Start lip-sync for `text`. Returns the estimated duration in seconds. */
  speak(text, cps) {
    const visemes = textToVisemes(text, cps);
    const emphasis = /[!?]/.test(text) ? 1 : 0.4;
    this.speech = { visemes, start: performance.now(), offset: 0, emphasis, text };
    this.mood = 'speaking';
    this.browPulse = emphasis * 0.8;
    return visemes.duration;
  }
  /** Re-sync to the TTS engine's word boundary (character index in the spoken text). */
  syncTo(charIndex) {
    const s = this.speech;
    if (!s) return;
    const target = s.visemes.charTime[Math.min(charIndex, s.visemes.charTime.length - 1)];
    s.start = performance.now() - target * 1000;
    if (Math.random() < 0.18 * this.charisma) this.browPulse = 0.6; // occasional emphasis
  }
  stopSpeaking() {
    if (this.speech) this.nod = 1; // finishing nod
    this.speech = null;
    if (this.mood === 'speaking') this.mood = 'idle';
  }
  react(kind) {
    if (kind === 'nod') this.nod = 1;
    if (kind === 'brows') this.browPulse = 1;
    if (kind === 'smile') { this.smileBoost = 1; }
  }

  // ── animation ──
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    const c = this.cur;
    const ch = this.charisma;
    const L = this.config.landmarks;
    const iod = Math.hypot(L.eyeR[0] - L.eyeL[0], L.eyeR[1] - L.eyeL[1]);
    const ease = (key, target, k) => { c[key] += (target - c[key]) * (1 - Math.exp(-dt * k)); };

    // mouth
    let m = { open: 0, spread: 0, round: 0 };
    if (this.speech) {
      const st = (now - this.speech.start) / 1000;
      m = sampleVisemes(this.speech.visemes, st);
      // micro-variation so repeated syllables don't look mechanical
      m.open *= 0.85 + 0.3 * (this.n[4](t * 3) * 0.5 + 0.5);
      if (st > this.speech.visemes.duration + 1.5) this.speech = null; // safety
    }
    ease('open', m.open, 28);
    ease('spread', m.spread, 18);
    ease('round', m.round, 18);

    // expression
    const speaking = !!this.speech;
    this.smileBoost = Math.max(0, (this.smileBoost || 0) - dt * 0.35);
    let smile = 0.12 + 0.25 * ch;
    if (this.mood === 'happy') smile = 0.85;
    if (this.mood === 'listening') smile = 0.35;
    if (speaking) smile *= 0.55;
    smile = Math.max(smile, this.smileBoost);
    ease('smile', smile, 3);

    this.browPulse = Math.max(0, this.browPulse - dt * 1.6);
    let brow = this.browPulse * 5 * (0.5 + ch * 0.5);
    if (this.mood === 'listening') brow += 2.5;
    if (this.mood === 'thinking') brow += 1.5 + this.n[3](t * 0.7) * 1.5;
    ease('brow', brow * (iod / 180), 10);

    // blinks (sometimes double)
    if (now > this.nextBlink && this.blinkStart < 0) { this.blinkStart = now; }
    let blink = 0;
    if (this.blinkStart >= 0) {
      const bt = (now - this.blinkStart) / 1000;
      blink = bt < 0.07 ? bt / 0.07 : bt < 0.11 ? 1 : bt < 0.26 ? 1 - (bt - 0.11) / 0.15 : 0;
      if (bt >= 0.26) {
        this.blinkStart = -1;
        this.nextBlink = now + (Math.random() < 0.15 ? 180 : rand(speaking ? 1800 : 2500, speaking ? 4500 : 6000));
      }
    }
    if (this.mood === 'thinking') blink = Math.max(blink, 0.25);
    c.blinkL = blink;
    c.blinkR = Math.min(1, blink * 1.02);

    // gaze saccades
    if (now > this.nextSaccade) {
      const r = (this.mood === 'listening' || speaking) ? 0.6 : 1.4;
      this.gazeTarget = Math.random() < 0.45 ? [0, 0] : [rand(-r, r), rand(-r * 0.4, r * 0.4)];
      if (this.mood === 'thinking') this.gazeTarget = [rand(-1.5, 1.5), -1.2];
      this.nextSaccade = now + rand(500, 2600);
    }
    ease('gx', this.gazeTarget[0] * (iod / 180), 30);
    ease('gy', this.gazeTarget[1] * (iod / 180), 30);

    // head: idle sway, speaking emphasis, listening tilt, nods
    const amp = (speaking ? 1.6 : 1) * (0.6 + ch * 0.6);
    this.nod = Math.max(0, this.nod - dt * 1.8);
    const nodY = Math.sin((1 - this.nod) * Math.PI * 2) * this.nod * 5;
    let rot = this.n[0](t * 0.25) * 0.018 * amp;
    if (this.mood === 'listening') rot += 0.035;
    if (speaking) rot += Math.sin(t * 1.7) * 0.006 * ch;
    ease('rot', rot, 4);
    ease('yaw', this.n[1](t * 0.2) * 3.5 * amp * (iod / 180), 3);
    ease('hx', this.n[2](t * 0.3) * 3 * amp * (iod / 180), 3);
    c.hy = (this.n[3](t * 0.35) * 2 * amp + nodY + (speaking ? Math.abs(this.n[4](t * 2.2)) * 1.5 * ch : 0)) * (iod / 180);
    c.breath = (Math.sin(t * (2 * Math.PI / 4.2)) * 0.5 + 0.5) * 0.0028;

    this.draw();
  }

  draw() {
    const gl = this.gl;
    const u = this.u;
    const c = this.cur;
    const s = this.scale; // landmarks are in natural image pixels; render in scaled canvas pixels
    const L = this.config.landmarks;
    const v2 = (loc, p) => gl.uniform2f(loc, p[0] * s, p[1] * s);
    gl.uniform2f(u.u_size, this.canvas.width, this.canvas.height);
    v2(u.u_eyeL, L.eyeL); v2(u.u_eyeR, L.eyeR);
    gl.uniform2f(u.u_eyeSize, L.eyeW * s, L.eyeH * s);
    v2(u.u_mL, L.mouthL); v2(u.u_mC, L.mouthC); v2(u.u_mR, L.mouthR);
    v2(u.u_chin, L.chin); v2(u.u_neck, L.neck);
    gl.uniform1f(u.u_open, c.open);
    gl.uniform1f(u.u_spread, c.spread);
    gl.uniform1f(u.u_round, c.round);
    gl.uniform1f(u.u_smile, c.smile);
    gl.uniform1f(u.u_blinkL, c.blinkL);
    gl.uniform1f(u.u_blinkR, c.blinkR);
    gl.uniform1f(u.u_brow, c.brow * s);
    gl.uniform1f(u.u_rot, c.rot);
    gl.uniform1f(u.u_yaw, c.yaw * s);
    gl.uniform1f(u.u_breath, c.breath);
    gl.uniform2f(u.u_gaze, c.gx * s, c.gy * s);
    gl.uniform2f(u.u_headT, c.hx * s, c.hy * s);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() { this.destroyed = true; }
}
