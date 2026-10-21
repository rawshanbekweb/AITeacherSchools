// Photoreal talking avatar built from the teacher's own photos and video clips.
// A fragment shader inverse-warps the current frame: jaw/lip opening with a rendered mouth
// interior, lip spread/rounding, smiles, eyelid blinks, gaze saccades, brow raises, head
// rotation/nods/parallax turn, breathing and whole-body sway. Hand movements come from a
// gesture library (extra photos or short clips recorded in the Avatar studio) that the engine
// cross-fades between, aligned on the face; video clips carry per-frame face landmarks so
// lip-sync keeps working while the teacher gestures.
// Lip-sync is driven by a viseme timeline built from the spoken text and re-synced by TTS
// word-boundary events, or by the real audio signal when a neural server voice is used.
import type { AvatarConfig, AvatarPose, GestureKind, Landmarks } from '@/lib/core/types';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() { v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5); gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_size, u_out, u_outAnchor, u_layerAnchor;
uniform float u_layerScale, u_alpha, u_motion;
uniform vec3 u_body;
uniform vec4 u_chroma;
uniform vec2 u_eyeL, u_eyeR, u_eyeSize, u_mL, u_mC, u_mR, u_chin, u_neck;
uniform float u_open, u_spread, u_round, u_smile, u_blinkL, u_blinkR, u_brow, u_rot, u_yaw, u_breath;
uniform vec2 u_gaze, u_headT;
varying vec2 v_uv;
float lash = 0.0;

// Texture lookup in layer pixels: transparent outside, optional green/blue-screen key.
vec4 tex(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) return vec4(0.0);
  vec4 c = texture2D(u_tex, p / u_size);
  if (u_chroma.w > 0.0) {
    vec3 rgb = c.a > 0.001 ? c.rgb / c.a : c.rgb;
    float a = smoothstep(u_chroma.w, u_chroma.w + 0.14, distance(rgb, u_chroma.rgb));
    // spill suppression: pull the key channel back towards the other two
    if (u_chroma.g > u_chroma.r && u_chroma.g > u_chroma.b) rgb.g = min(rgb.g, max(rgb.r, rgb.b) * 1.04);
    else if (u_chroma.b > u_chroma.r) rgb.b = min(rgb.b, max(rgb.r, rgb.g) * 1.04);
    c = vec4(rgb, 1.0) * a * c.a;
  }
  return c;
}

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
  // output pixel -> whole-body sway around the feet -> this layer's pixel space (face-aligned)
  vec2 o = v_uv * u_out;
  vec2 pb = vec2(u_out.x * 0.5, u_out.y * 1.08);
  vec2 od = o - pb - u_body.yz;
  o = pb + vec2(cos(-u_body.x) * od.x - sin(-u_body.x) * od.y, sin(-u_body.x) * od.x + cos(-u_body.x) * od.y);
  vec2 p = (o - u_outAnchor) * u_layerScale + u_layerAnchor;
  float iod = distance(u_eyeL, u_eyeR);
  float mw = distance(u_mL, u_mR) * 0.5;
  vec2 mc = (u_mL + u_mR) * 0.5;

  // breathing: shoulders and everything above rise slightly
  p.y = u_size.y - (u_size.y - p.y) / (1.0 + u_breath * u_motion);

  // head pose around the neck pivot, fading out over the neck
  float hm = 1.0 - smoothstep(u_chin.y + 0.1 * iod, u_neck.y + 0.45 * iod, p.y);
  vec2 d = p - u_neck - u_headT * hm * u_motion;
  float a = -u_rot * hm * u_motion;
  p = u_neck + vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);

  // turn: the inner face shifts more than the silhouette (parallax)
  vec2 fc = mix((u_eyeL + u_eyeR) * 0.5, u_mC, 0.45);
  float fm = 1.0 - smoothstep(0.35, 1.0, length((p - fc) / vec2(0.9 * iod, 1.3 * iod)));
  p.x -= u_yaw * fm * u_motion;

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
    col = tex(p);
  } else if (p.y >= ly + dn) {
    float k = smoothstep(0.0, 0.4 * mw, p.y - (ly + dn));
    p.y -= mix(dn, openPx * 0.78 * jprof, k) * chinFade;
    col = tex(p);
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
    vec4 lip = tex(vec2(p.x, ly + (p.y < ly ? -1.0 : 1.0)));
    col = mix(lip * 0.85, vec4(m, 1.0), smoothstep(0.0, 1.8, edge));
  }
  col.rgb *= 1.0 - lash * 0.6;
  gl_FragColor = col * u_alpha;
}`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Smooth value noise for idle motion.
function noise1(seed: number) {
  const pts = Array.from({ length: 64 }, () => Math.random() * 2 - 1);
  return (t: number) => {
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
interface Mouth { open: number; spread: number; round: number }
interface VisemeKey extends Mouth { t: number }
export interface Visemes { keys: VisemeKey[]; duration: number; charTime: number[] }

const V_OPEN = /[aаяoоё]/;
const V_MID = /[eеэiиыüöə]/;
const V_ROUND = /[uуюo‘ўöü]/;
const CLOSED = /[mbpмбп]/;
const LABIODENTAL = /[fvфв]/;

export function textToVisemes(text: string, cps = 13): Visemes {
  const keys: VisemeKey[] = [];
  let t = 0;
  const lower = text.toLowerCase();
  const charTime = new Array<number>(lower.length + 1).fill(0);
  for (let i = 0; i < lower.length; i++) {
    charTime[i] = t;
    const ch = lower[i];
    let k: Mouth;
    let dur = 1 / cps;
    if (/\s/.test(ch)) { k = { open: 0.05, spread: 0, round: 0 }; dur *= 0.5; }
    else if (/[,;:—–-]/.test(ch)) { k = { open: 0, spread: 0, round: 0 }; dur *= 2.5; }
    else if (/[.!?…]/.test(ch)) { k = { open: 0, spread: 0, round: 0 }; dur *= 4; }
    else if (V_ROUND.test(ch) && ch !== 'o') { k = { open: 0.35, spread: -0.2, round: 1 }; dur *= 1.25; }
    else if (V_OPEN.test(ch)) { const o = ch === 'o' || ch === 'о'; k = { open: o ? 0.75 : 1, spread: 0, round: o ? 0.6 : 0 }; dur *= 1.3; }
    else if (V_MID.test(ch)) { k = { open: 0.5, spread: 0.8, round: 0 }; dur *= 1.15; }
    else if (CLOSED.test(ch)) { k = { open: 0, spread: 0, round: 0 }; dur *= 0.9; }
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

function sampleVisemes(v: Visemes, time: number): Mouth {
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

export type Mood = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy';
interface Speech { visemes: Visemes; start: number; emphasis: number; text: string; audio?: { el: HTMLAudioElement; analyser: AnalyserNode; buf: Uint8Array<ArrayBuffer>; scale: number } }
const UNIFORMS = ['u_size', 'u_out', 'u_outAnchor', 'u_layerAnchor', 'u_layerScale', 'u_alpha', 'u_motion', 'u_body', 'u_chroma', 'u_eyeL', 'u_eyeR', 'u_eyeSize', 'u_mL', 'u_mC', 'u_mR', 'u_chin', 'u_neck', 'u_open', 'u_spread', 'u_round', 'u_smile', 'u_blinkL', 'u_blinkR', 'u_brow', 'u_rot', 'u_yaw', 'u_breath', 'u_gaze', 'u_headT'] as const;
type U = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

/** A loaded pose: decoded image or playable video plus its GPU texture. */
interface PoseRt {
  def: AvatarPose;
  el: HTMLImageElement | HTMLVideoElement;
  tex: WebGLTexture | null;
  w: number;
  h: number;
  ready: boolean;
  video: boolean;
}

const FADE = 0.38; // seconds of cross-fade between poses
const resolveSrc = (src: string) => (src.startsWith('data:') || src.startsWith('/') ? src : '/' + src);
const iodOf = (l: Landmarks) => Math.hypot(l.eyeR[0] - l.eyeL[0], l.eyeR[1] - l.eyeL[1]);
const lerpLm = (a: Landmarks, b: Landmarks, f: number): Landmarks => {
  const p = (x: [number, number], y: [number, number]): [number, number] => [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f];
  return { eyeL: p(a.eyeL, b.eyeL), eyeR: p(a.eyeR, b.eyeR), mouthL: p(a.mouthL, b.mouthL), mouthC: p(a.mouthC, b.mouthC), mouthR: p(a.mouthR, b.mouthR), chin: p(a.chin, b.chin), neck: p(a.neck, b.neck), eyeW: a.eyeW + (b.eyeW - a.eyeW) * f, eyeH: a.eyeH + (b.eyeH - a.eyeH) * f };
};

export const basePose = (c: AvatarConfig): AvatarPose => ({ id: 'base', name: 'Asosiy rasm', kind: 'idle', media: 'image', src: c.image, landmarks: c.landmarks });

// ─── Avatar ────────────────────────────────────────────────────────────────
export class Avatar {
  canvas: HTMLCanvasElement;
  config: AvatarConfig;
  charisma: number;
  cur = { open: 0, spread: 0, round: 0, smile: 0.15, blinkL: 0, blinkR: 0, brow: 0, rot: 0, yaw: 0, hx: 0, hy: 0, gx: 0, gy: 0, breath: 0, body: 0, bx: 0 };
  mood: Mood = 'idle';
  speech: Speech | null = null;
  ready: Promise<void>;
  /** called when a gesture starts / the avatar returns to idle (for UI hints) */
  onGesture?: (kind: GestureKind, poseName: string) => void;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private aPos = 0;
  private u = {} as U;
  private scale = 1;
  private base: PoseRt | null = null;
  private poses: PoseRt[] = [];
  private layerA: PoseRt | null = null;
  private layerB: PoseRt | null = null;
  private blend = 0;
  private gestureUntil = 0;
  private lastPoseId = '';
  private nod = 0;
  private browPulse = 0;
  private smileBoost = 0;
  private nextBlink = 0;
  private blinkStart = -1;
  private nextSaccade = 0;
  private gazeTarget: [number, number] = [0, 0];
  private n = [noise1(1), noise1(17), noise1(33), noise1(51), noise1(77), noise1(91)];
  private last = 0;
  private destroyed = false;
  private loopId = 0;
  private posesKey = '';

  constructor(canvas: HTMLCanvasElement, config: AvatarConfig) {
    this.canvas = canvas;
    this.config = config;
    this.charisma = config.charisma ?? 0.7;
    this.nextBlink = performance.now() + 1500;
    // GPU resets (driver update, many tabs) must not leave a blank teacher on the classroom panel.
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      for (const p of this.allPoses()) p.tex = null;
      this.gl = null;
      this.ready = this.init();
    });
    this.ready = this.init();
  }

  private allPoses() { return [this.base, ...this.poses].filter(Boolean) as PoseRt[]; }

  private async loadImage(src: string) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolveSrc(src);
    await img.decode();
    return img;
  }

  private async loadPose(def: AvatarPose): Promise<PoseRt | null> {
    try {
      if (def.media === 'image') {
        const img = await this.loadImage(def.src);
        return { def, el: img, tex: null, w: img.naturalWidth, h: img.naturalHeight, ready: true, video: false };
      }
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.loop = def.kind === 'idle';
      v.src = resolveSrc(def.src);
      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('video timeout')), 20000);
        v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true });
        v.addEventListener('error', () => { clearTimeout(t); rej(new Error('video error')); }, { once: true });
      });
      return { def, el: v, tex: null, w: v.videoWidth, h: v.videoHeight, ready: true, video: true };
    } catch (e) {
      console.warn('avatar pose failed to load', def.name, e);
      return null;
    }
  }

  private async init() {
    const base = await this.loadPose(basePose(this.config));
    if (!base) throw new Error('avatar image failed to load');
    if (this.destroyed) return;
    this.base = base;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { this.fallback(); return; }
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    this.prog = prog;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.aPos = gl.getAttribLocation(prog, 'a_pos');
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(prog, n);
    this.resize();
    this.layerA = base;
    void this.loadGestures();
    this.last = performance.now();
    const loopId = ++this.loopId; // a restored context starts a new loop; the old one stops
    const loop = (now: number) => { if (this.destroyed || loopId !== this.loopId) return; this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /** Canvas follows the base photo; GPU work is bounded for classroom PCs. */
  private resize() {
    const b = this.base!;
    this.scale = Math.min(1, 1600 / b.h);
    this.canvas.width = Math.round(b.w * this.scale);
    this.canvas.height = Math.round(b.h * this.scale);
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private async loadGestures() {
    const defs = this.config.poses ?? [];
    this.posesKey = JSON.stringify(defs.map((d) => [d.id, d.src]));
    for (const p of this.poses) if (p.video) (p.el as HTMLVideoElement).pause();
    this.poses = [];
    const loaded = await Promise.all(defs.map((d) => this.loadPose(d)));
    if (this.destroyed) return;
    this.poses = loaded.filter(Boolean) as PoseRt[];
    // a recorded idle clip looks more alive than the still photo: prefer it as the resting pose
    if (this.layerA === this.base) this.toIdle();
  }

  async updateConfig(config: Partial<AvatarConfig>) {
    const imageChanged = !!config.image && config.image !== this.config.image;
    this.config = { ...this.config, ...config, landmarks: { ...this.config.landmarks, ...(config.landmarks ?? {}) } };
    this.charisma = this.config.charisma ?? this.charisma;
    if (this.base) this.base.def = basePose(this.config);
    if (imageChanged) {
      const b = await this.loadPose(basePose(this.config));
      if (b && this.gl) {
        if (this.layerA === this.base) this.layerA = b;
        if (this.layerB === this.base) this.layerB = b;
        this.base = b;
        this.resize();
      }
    }
    const key = JSON.stringify((this.config.poses ?? []).map((d) => [d.id, d.src]));
    if (key !== this.posesKey) {
      this.layerA = this.base;
      this.layerB = null;
      await this.loadGestures();
    } else {
      // landmark / chroma edits apply live
      for (const p of this.poses) p.def = this.config.poses?.find((d) => d.id === p.def.id) ?? p.def;
    }
  }

  private fallback() {
    // No WebGL: show the photo with CSS breathing only.
    const img = this.base!.el as HTMLImageElement;
    img.className = this.canvas.className + ' avatar-fallback';
    this.canvas.replaceWith(img);
  }

  // ── gestures ──
  /** Kinds that have at least one recorded pose. */
  gestureKinds(): GestureKind[] { return [...new Set(this.poses.map((p) => p.def.kind))]; }
  hasGesture(kind: GestureKind) { return this.poses.some((p) => p.def.kind === kind && p.ready); }

  /** Cross-fade to a recorded pose of `kind`. Returns false when none exists. */
  gesture(kind: GestureKind, holdSec?: number): boolean {
    if (!this.gl) return false;
    if (kind === 'idle') { this.toIdle(); return true; }
    const cands = this.poses.filter((p) => p.def.kind === kind && p.ready);
    if (!cands.length) return false;
    const active = this.layerB ?? this.layerA;
    if (active && active.def.kind === kind && !active.video) { this.gestureUntil = performance.now() + (holdSec ?? 3) * 1000; return true; }
    const pick = cands.length > 1 ? cands.filter((c) => c.def.id !== this.lastPoseId)[Math.floor(Math.random() * (cands.length - 1))] ?? cands[0] : cands[0];
    this.switchTo(pick, holdSec ?? rand(2.6, 4));
    return true;
  }

  /** Back to the resting pose (an idle clip when recorded, otherwise the base photo). */
  toIdle() {
    const idle = this.poses.filter((p) => p.def.kind === 'idle' && p.ready);
    const target = idle.find((p) => p.video) ?? idle[0] ?? this.base;
    const active = this.layerB ?? this.layerA;
    if (!target || active === target) return;
    this.switchTo(target, 0);
  }

  private switchTo(p: PoseRt, holdSec: number) {
    if (this.layerB) { this.layerA = this.layerB; this.layerB = null; }
    if (p === this.layerA) return;
    if (p.video) {
      const v = p.el as HTMLVideoElement;
      if (p.def.kind !== 'idle' && v.currentTime > 0.05) {
        // restart the clip and only fade in once the first frame is decoded
        v.currentTime = 0;
        v.addEventListener('seeked', () => { if (this.pendingVideo === p) { this.pendingVideo = null; void v.play().catch(() => {}); this.startFade(p, holdSec); } }, { once: true });
        this.pendingVideo = p;
        return;
      }
      void v.play().catch(() => {});
    }
    this.startFade(p, holdSec);
  }

  private pendingVideo: PoseRt | null = null;

  private startFade(p: PoseRt, holdSec: number) {
    if (this.layerB) { this.layerA = this.layerB; this.layerB = null; }
    if (p === this.layerA) return;
    this.layerB = p;
    this.blend = 0;
    this.lastPoseId = p.def.id;
    this.gestureUntil = performance.now() + holdSec * 1000;
    this.onGesture?.(p.def.kind, p.def.name);
  }

  // ── public control API ──
  setMood(mood: Mood) {
    const prev = this.mood;
    this.mood = mood;
    if (mood === prev) return;
    // body language follows the mood when matching poses were recorded
    if (mood === 'thinking') this.gesture('think', 30);
    else if (mood === 'listening') this.gesture('listen', 30);
    else if (mood === 'happy') this.gesture('praise', 3);
    else if ((prev === 'thinking' || prev === 'listening') && (mood === 'idle' || mood === 'speaking')) {
      const k = (this.layerB ?? this.layerA)?.def.kind;
      if (k === 'think' || k === 'listen') this.toIdle();
    }
  }

  /** Start text-driven lip-sync. Returns the estimated duration in seconds. */
  speak(text: string, cps = 13) {
    const visemes = textToVisemes(text, cps);
    const emphasis = /[!?]/.test(text) ? 1 : 0.4;
    this.speech = { visemes, start: performance.now(), emphasis, text };
    this.mood = 'speaking';
    this.browPulse = emphasis * 0.8;
    return visemes.duration;
  }

  /**
   * Lip-sync to a real audio element (neural server voice). The viseme timeline is stretched to
   * the audio duration for mouth shapes, and the signal envelope drives how wide the jaw opens.
   */
  speakAudio(text: string, el: HTMLAudioElement, analyser: AnalyserNode) {
    this.speak(text);
    const s = this.speech!;
    const dur = el.duration && isFinite(el.duration) ? el.duration : s.visemes.duration;
    s.audio = { el, analyser, buf: new Uint8Array(new ArrayBuffer(analyser.fftSize)), scale: s.visemes.duration / Math.max(0.3, dur) };
  }

  /** Re-sync to the TTS engine's word boundary (character index in the spoken text). */
  syncTo(charIndex: number) {
    const s = this.speech;
    if (!s || s.audio) return;
    const target = s.visemes.charTime[Math.min(charIndex, s.visemes.charTime.length - 1)];
    s.start = performance.now() - target * 1000;
    if (Math.random() < 0.18 * this.charisma) this.browPulse = 0.6; // occasional emphasis
  }

  /** Seconds into the current utterance on the viseme timeline (used for subtitle highlighting). */
  speechTime() {
    const s = this.speech;
    if (!s) return Infinity;
    return s.audio ? s.audio.el.currentTime * s.audio.scale : (performance.now() - s.start) / 1000;
  }

  stopSpeaking() {
    if (this.speech) this.nod = 1; // finishing nod
    this.speech = null;
    if (this.mood === 'speaking') this.mood = 'idle';
  }

  react(kind: 'nod' | 'brows' | 'smile') {
    if (kind === 'nod') this.nod = 1;
    if (kind === 'brows') this.browPulse = 1;
    if (kind === 'smile') this.smileBoost = 1;
  }

  // ── animation ──
  private frame(now: number) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    const t = now / 1000;
    const c = this.cur;
    const ch = this.charisma;
    const k = iodOf(this.config.landmarks) / 180;
    const ease = (key: keyof typeof c, target: number, rate: number) => { c[key] += (target - c[key]) * (1 - Math.exp(-dt * rate)); };

    // pose cross-fade and automatic return from gestures
    if (this.layerB) {
      this.blend += dt / FADE;
      if (this.blend >= 1) {
        const old = this.layerA;
        this.layerA = this.layerB;
        this.layerB = null;
        if (old?.video && old.def.kind !== 'idle') (old.el as HTMLVideoElement).pause();
      }
    }
    const act = this.layerB ?? this.layerA;
    if (act && act.def.kind !== 'idle' && !this.layerB) {
      if (act.video) {
        const v = act.el as HTMLVideoElement;
        if (v.ended || (v.duration && v.currentTime > v.duration - FADE)) this.toIdle();
      } else if (now > this.gestureUntil) this.toIdle();
    }

    // mouth
    let m: Mouth = { open: 0, spread: 0, round: 0 };
    if (this.speech) {
      const s = this.speech;
      const st = this.speechTime();
      m = sampleVisemes(s.visemes, st);
      if (s.audio) {
        s.audio.analyser.getByteTimeDomainData(s.audio.buf);
        let sum = 0;
        for (const v of s.audio.buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / s.audio.buf.length);
        const env = clamp((rms - 0.015) * 7, 0, 1);
        m.open = clamp(env * (0.55 + 0.6 * m.open), 0, 1.1);
      } else {
        // micro-variation so repeated syllables don't look mechanical
        m.open *= 0.85 + 0.3 * (this.n[4](t * 3) * 0.5 + 0.5);
        if (st > s.visemes.duration + 1.5) this.speech = null; // safety
      }
    }
    ease('open', m.open, 28);
    ease('spread', m.spread, 18);
    ease('round', m.round, 18);

    // expression
    const speaking = !!this.speech;
    this.smileBoost = Math.max(0, this.smileBoost - dt * 0.35);
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
    ease('brow', brow * k, 10);

    // blinks (sometimes double)
    if (now > this.nextBlink && this.blinkStart < 0) this.blinkStart = now;
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
      const r = this.mood === 'listening' || speaking ? 0.6 : 1.4;
      this.gazeTarget = Math.random() < 0.45 ? [0, 0] : [rand(-r, r), rand(-r * 0.4, r * 0.4)];
      if (this.mood === 'thinking') this.gazeTarget = [rand(-1.5, 1.5), -1.2];
      this.nextSaccade = now + rand(500, 2600);
    }
    ease('gx', this.gazeTarget[0] * k, 30);
    ease('gy', this.gazeTarget[1] * k, 30);

    // head: idle sway, speaking emphasis, listening tilt, nods
    const amp = (speaking ? 1.6 : 1) * (0.6 + ch * 0.6);
    this.nod = Math.max(0, this.nod - dt * 1.8);
    const nodY = Math.sin((1 - this.nod) * Math.PI * 2) * this.nod * 5;
    let rot = this.n[0](t * 0.25) * 0.018 * amp;
    if (this.mood === 'listening') rot += 0.035;
    if (speaking) rot += Math.sin(t * 1.7) * 0.006 * ch;
    ease('rot', rot, 4);
    ease('yaw', this.n[1](t * 0.2) * 3.5 * amp * k, 3);
    ease('hx', this.n[2](t * 0.3) * 3 * amp * k, 3);
    c.hy = (this.n[3](t * 0.35) * 2 * amp + nodY + (speaking ? Math.abs(this.n[4](t * 2.2)) * 1.5 * ch : 0)) * k;
    c.breath = (Math.sin(t * ((2 * Math.PI) / 4.2)) * 0.5 + 0.5) * 0.0028;
    // whole body: slow weight shift, a little more animated while talking, leaning in to listen
    ease('body', this.n[5](t * 0.12) * 0.012 * (speaking ? 1.4 : 1) * (0.5 + ch * 0.5) + (this.mood === 'listening' ? 0.006 : 0), 2);
    ease('bx', this.n[5](t * 0.09 + 7) * 6 * k * (0.5 + ch * 0.5), 2);

    this.draw();
  }

  private landmarksAt(p: PoseRt): Landmarks {
    if (!p.video || !p.def.track?.frames.length) return p.def.landmarks;
    const tr = p.def.track;
    const pos = (p.el as HTMLVideoElement).currentTime * tr.fps;
    const i = Math.min(tr.frames.length - 1, Math.floor(pos));
    const j = Math.min(tr.frames.length - 1, i + 1);
    return lerpLm(tr.frames[i], tr.frames[j], pos - i);
  }

  private drawLayer(p: PoseRt, weight: number) {
    const gl = this.gl!;
    const u = this.u;
    if (weight <= 0.002) return;
    if (p.video && (p.el as HTMLVideoElement).readyState < 2 && !p.tex) return;
    if (!p.tex) {
      p.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.el);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      if (p.video && (p.el as HTMLVideoElement).readyState >= 2) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.el);
      }
    }
    const s = this.scale;
    const L = this.landmarksAt(p);
    const align = p.def.landmarks; // static alignment keeps a clip's own body motion
    const baseL = this.config.landmarks;
    const v2 = (loc: WebGLUniformLocation | null, q: [number, number]) => gl.uniform2f(loc, q[0] * s, q[1] * s);
    const c = this.cur;
    gl.uniform2f(u.u_out, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.u_size, p.w * s, p.h * s);
    v2(u.u_outAnchor, baseL.neck);
    v2(u.u_layerAnchor, align.neck);
    gl.uniform1f(u.u_layerScale, p === this.base ? 1 : clamp(iodOf(align) / iodOf(baseL), 0.15, 6));
    gl.uniform1f(u.u_alpha, weight);
    gl.uniform1f(u.u_motion, p.video ? 0.35 : 1); // recorded clips already move naturally
    gl.uniform3f(u.u_body, c.body * (p.video ? 0.3 : 1), c.bx * s * (p.video ? 0.3 : 1), 0);
    const ck = p.def.chroma;
    gl.uniform4f(u.u_chroma, ck ? ck.color[0] / 255 : 0, ck ? ck.color[1] / 255 : 0, ck ? ck.color[2] / 255 : 0, ck ? Math.max(0.01, ck.tolerance) : 0);
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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private draw() {
    const gl = this.gl;
    if (!gl || !this.layerA || !this.prog) return;
    // Re-assert our GL state every frame: another engine instance may share this canvas context
    // (React StrictMode remounts, the studio preview) and leave its own program bound.
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // layers are pre-weighted, so additive blending = cross-fade
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // smoothstep the fade so the hand motion eases in and out
    const f = this.layerB ? this.blend * this.blend * (3 - 2 * this.blend) : 0;
    this.drawLayer(this.layerA, 1 - f);
    if (this.layerB) this.drawLayer(this.layerB, f);
  }

  destroy() {
    this.destroyed = true;
    for (const p of this.poses) if (p.video) (p.el as HTMLVideoElement).pause();
  }
}
