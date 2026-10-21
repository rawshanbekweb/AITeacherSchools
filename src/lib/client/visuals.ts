// Lesson material library renderer (spec §9, level 1): prepared animations tagged by topic.
// Each visual is a canvas scene; `focus(text)` lets the scene react to the sentence being spoken.

import type { LessonSection, Material } from '@/lib/core/types';

type C2D = CanvasRenderingContext2D;
interface SceneState { focusText: string; focusIndex: number; focusAt: number; showLabels: boolean }
type Scene = (ctx: C2D, w: number, h: number, t: number, st: SceneState) => void;
export interface VisualHandle { focus(text: string, index: number): void; destroy(): void }

const TAU = Math.PI * 2;

const PLANETS = [
  { n: ['merkuriy', 'меркурий', 'mercury'], label: 'Merkuriy', r: 3, d: 0.16, c: '#b7a99a', s: 4.1 },
  { n: ['venera', 'венера', 'venus'], label: 'Venera', r: 5, d: 0.23, c: '#e8c27a', s: 1.6 },
  { n: ['yer', 'земля', 'earth'], label: 'Yer', r: 5.5, d: 0.31, c: '#4f8fe0', s: 1 },
  { n: ['mars', 'марс'], label: 'Mars', r: 4, d: 0.39, c: '#d4623b', s: 0.53 },
  { n: ['yupiter', 'юпитер', 'jupiter'], label: 'Yupiter', r: 12, d: 0.53, c: '#d9a066', s: 0.084, bands: true },
  { n: ['saturn', 'сатурн'], label: 'Saturn', r: 10, d: 0.67, c: '#e3c98f', s: 0.034, ring: true },
  { n: ['uran', 'уран', 'uranus'], label: 'Uran', r: 7, d: 0.8, c: '#8fd3dc', s: 0.012 },
  { n: ['neptun', 'нептун', 'neptune'], label: 'Neptun', r: 7, d: 0.91, c: '#4a6fe3', s: 0.006 },
];

function stars(ctx: C2D, w: number, h: number, t: number, seed = 7) {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 160; i++) {
    const sx = rnd() * w;
    const sy = rnd() * h;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + rnd()) + i));
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.55 * tw * rnd()})`;
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
}

function space(ctx: C2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, '#13183a');
  g.addColorStop(1, '#05060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function label(ctx: C2D, text: string, x: number, y: number, opts: { size?: number; weight?: number; align?: CanvasTextAlign; color?: string; shadow?: boolean } = {}) {
  ctx.font = `${opts.weight || 600} ${opts.size || 15}px Inter, system-ui, sans-serif`;
  ctx.textAlign = opts.align || 'center';
  ctx.fillStyle = opts.color || 'rgba(255,255,255,.92)';
  if (opts.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; }
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function sun(ctx: C2D, x: number, y: number, r: number, t: number) {
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.6);
  glow.addColorStop(0, 'rgba(255,214,102,.9)');
  glow.addColorStop(0.4, 'rgba(255,150,40,.25)');
  glow.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, '#fff6c8');
  body.addColorStop(0.5, '#ffc23d');
  body.addColorStop(1, '#f07d12');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // granulation
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4 + t * 0.05 * (i % 3 + 1);
    const rr = r * (0.15 + ((i * 37) % 80) / 100);
    ctx.fillStyle = `rgba(255,${120 + (i * 13) % 80},20,${0.08 + 0.06 * Math.sin(t * 2 + i)})`;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.18, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // flares
  for (let i = 0; i < 3; i++) {
    const a = t * 0.2 + i * 2.1;
    const fx = x + Math.cos(a) * r;
    const fy = y + Math.sin(a) * r;
    ctx.strokeStyle = `rgba(255,170,60,${0.35 + 0.25 * Math.sin(t * 1.3 + i)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx + Math.cos(a) * r * 0.12, fy + Math.sin(a) * r * 0.12, r * 0.14, a + 1.2, a + 5.1);
    ctx.stroke();
  }
}

const SCENES: Record<string, Scene> = {
  sun(ctx, w, h, t, st) {
    space(ctx, w, h); stars(ctx, w, h, t);
    const r = Math.min(w, h) * 0.3;
    sun(ctx, w * 0.42, h * 0.5, r, t);
    const ex = w * 0.86;
    ctx.fillStyle = '#4f8fe0';
    ctx.beginPath(); ctx.arc(ex, h * 0.5, Math.max(2, r / 109 * 3), 0, TAU); ctx.fill();
    label(ctx, 'Yer (miqyosda)', ex, h * 0.5 + 22, { size: 13 });
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.moveTo(w * 0.42 + r + 10, h * 0.5); ctx.lineTo(ex - 10, h * 0.5); ctx.stroke();
    ctx.setLineDash([]);
    // light travelling to Earth
    const p = (t % 4) / 4;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(w * 0.42 + r + 10 + (ex - w * 0.42 - r - 20) * p, h * 0.5, 3, 0, TAU); ctx.fill();
    const facts = [['~150 mln km', 'Yergacha masofa'], ['1 300 000', 'Yer sig‘adi'], ['~6000 °C', 'sirt harorati'], ['8 daq. 20 s', 'nur yo‘li']];
    facts.forEach(([a, b], i) => {
      const hi = st.focusIndex === i + 1;
      const x = w * 0.06;
      const y = h * 0.14 + i * 54;
      ctx.fillStyle = hi ? 'rgba(255,190,70,.25)' : 'rgba(255,255,255,.06)';
      ctx.fillRect(x - 8, y - 22, 170, 46);
      label(ctx, a, x, y, { align: 'left', size: 18, weight: 700, color: hi ? '#ffd27a' : '#fff' });
      label(ctx, b, x, y + 18, { align: 'left', size: 12, color: 'rgba(255,255,255,.7)' });
    });
  },

  'solar-system'(ctx, w, h, t, st) {
    space(ctx, w, h); stars(ctx, w, h, t, 3);
    const cx = w * 0.5;
    const cy = h * 0.53;
    const R = Math.min(w * 0.48, h * 0.9);
    sun(ctx, cx, cy, R * 0.07, t);
    const focus = st.focusText;
    PLANETS.forEach((p, i) => {
      const rx = R * p.d;
      const ry = rx * 0.42;
      const hi = focus && p.n.some((n) => focus.includes(n));
      ctx.strokeStyle = hi ? 'rgba(255,210,120,.8)' : 'rgba(255,255,255,.14)';
      ctx.lineWidth = hi ? 2 : 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      const a = t * 0.35 * Math.sqrt(p.s) + i * 1.3;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      const r = p.r * (R / 420) * (hi ? 1.5 : 1);
      if (p.ring) {
        ctx.strokeStyle = 'rgba(230,210,160,.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.7, -0.3, 0, TAU); ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, p.c); g.addColorStop(1, '#111');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (hi || st.showLabels) label(ctx, p.label, x, y - r - 8, { size: hi ? 16 : 12, color: hi ? '#ffd27a' : 'rgba(255,255,255,.8)' });
    });
  },

  'earth-moon'(ctx, w, h, t, st) {
    space(ctx, w, h); stars(ctx, w, h, t, 11);
    // sunlight from the left
    const lg = ctx.createLinearGradient(0, 0, w * 0.3, 0);
    lg.addColorStop(0, 'rgba(255,220,120,.35)'); lg.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w * 0.3, h);
    label(ctx, '☀ Quyosh nuri', 70, 30, { size: 13, color: '#ffd27a' });
    const ex = w * 0.45;
    const ey = h * 0.52;
    const er = Math.min(w, h) * 0.2;
    ctx.save();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1f5fbf'; ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    // rotating continents
    ctx.fillStyle = '#3f9a52';
    for (let i = 0; i < 7; i++) {
      const lon = ((t * 0.25 + i * 0.9) % TAU) - Math.PI;
      const lat = Math.sin(i * 2.3) * 0.6;
      const px = ex + Math.sin(lon) * er * Math.cos(lat);
      if (Math.cos(lon) < 0) continue;
      ctx.beginPath(); ctx.ellipse(px, ey + lat * er, er * 0.22 * Math.cos(lon), er * 0.16, 0.3, 0, TAU); ctx.fill();
    }
    // night side
    const ng = ctx.createLinearGradient(ex - er * 0.2, 0, ex + er, 0);
    ng.addColorStop(0, 'rgba(0,0,20,0)'); ng.addColorStop(0.35, 'rgba(0,0,20,.75)');
    ctx.fillStyle = ng; ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.restore();
    label(ctx, 'Kun', ex - er * 0.55, ey - er - 10, { size: 13, color: '#ffd27a' });
    label(ctx, 'Tun', ex + er * 0.55, ey - er - 10, { size: 13, color: '#9fb4ff' });
    // moon orbit
    const mr = er * 2.1;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(ex, ey, mr, mr * 0.45, 0, 0, TAU); ctx.stroke();
    const ma = t * 0.4;
    const mx = ex + Math.cos(ma) * mr;
    const my = ey + Math.sin(ma) * mr * 0.45;
    ctx.fillStyle = '#d9d9d9';
    ctx.beginPath(); ctx.arc(mx, my, er * 0.27, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,10,.7)';
    ctx.beginPath(); ctx.arc(mx, my, er * 0.27, -Math.PI / 2, Math.PI / 2); ctx.fill();
    label(ctx, 'Oy', mx, my - er * 0.35, { size: 13 });
    // phase as seen from Earth
    const px = w * 0.88;
    const py = h * 0.22;
    const pr = 28;
    const phase = (Math.cos(ma) + 1) / 2;
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.arc(px, py, pr, -Math.PI / 2, Math.PI / 2, Math.sin(ma) > 0);
    ctx.ellipse(px, py, pr * Math.abs(1 - 2 * phase), pr, 0, Math.PI / 2, -Math.PI / 2, (phase > 0.5) === (Math.sin(ma) > 0));
    ctx.fill();
    label(ctx, 'Oy fazasi', px, py + pr + 18, { size: 12 });
  },

  leaf(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e9f7ef'); g.addColorStop(1, '#c9ead6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.42;
    const cy = h * 0.52;
    const L = Math.min(w, h) * 0.42;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.5 + Math.sin(t * 0.8) * 0.03);
    const lg = ctx.createLinearGradient(-L, 0, L, 0);
    lg.addColorStop(0, '#2f8f46'); lg.addColorStop(1, '#5cc56f');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -L * 0.62, L, 0); ctx.quadraticCurveTo(0, L * 0.62, -L, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(230,255,230,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.95, 0); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      const x = i * L * 0.22;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + L * 0.12, -Math.sign(i) * 0, x + L * 0.2, -L * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + L * 0.12, 0, x + L * 0.2, L * 0.28); ctx.stroke();
    }
    ctx.restore();
    // magnified cell with chloroplasts
    const zx = w * 0.8;
    const zy = h * 0.42;
    const zr = Math.min(w, h) * 0.2;
    ctx.strokeStyle = '#2f6f3e'; ctx.lineWidth = 3;
    ctx.fillStyle = '#eafbe9';
    ctx.beginPath(); ctx.arc(zx, zy, zr, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * 0.52 + t * 0.15;
      const rr = zr * (0.35 + 0.4 * ((i * 7) % 10) / 10);
      const x = zx + Math.cos(a) * rr;
      const y = zy + Math.sin(a) * rr;
      ctx.fillStyle = `rgba(40,${150 + 40 * Math.sin(t * 2 + i)},60,.95)`;
      ctx.beginPath(); ctx.ellipse(x, y, zr * 0.14, zr * 0.08, a, 0, TAU); ctx.fill();
    }
    label(ctx, 'Xloroplastlar', zx, zy + zr + 24, { size: 15, color: '#1d5a2c', shadow: false });
    ctx.setLineDash([5, 5]); ctx.strokeStyle = '#2f6f3e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + L * 0.3, cy - L * 0.2); ctx.lineTo(zx - zr, zy); ctx.stroke(); ctx.setLineDash([]);
    // sun rays
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.6 + i / 5) % 1);
      ctx.strokeStyle = `rgba(255,190,40,${1 - p})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.05 + p * w * 0.25, h * 0.05 + p * h * 0.3); ctx.lineTo(w * 0.08 + p * w * 0.25, h * 0.1 + p * h * 0.3); ctx.stroke();
    }
    label(ctx, '☀', w * 0.06, h * 0.1, { size: 40, color: '#f5a623', shadow: false });
  },

  photosynthesis(ctx, w, h, t, st) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#bfe3ff'); g.addColorStop(0.68, '#e8f6ff'); g.addColorStop(0.7, '#8b5e3c'); g.addColorStop(1, '#5d3d25');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const gx = w * 0.5;
    const gy = h * 0.69;
    // roots
    ctx.strokeStyle = '#e8d3b0'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + i * 20, gy + 40, gx + i * 38, gy + 80); ctx.stroke(); }
    // stem & leaves
    ctx.strokeStyle = '#2f8f46'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + 8, gy - h * 0.25, gx, gy - h * 0.42); ctx.stroke();
    const leaf = (x: number, y: number, s: number, a: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.sin(t + x) * 0.04);
      ctx.fillStyle = '#3ea957';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); ctx.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); ctx.fill();
      ctx.restore();
    };
    leaf(gx, gy - h * 0.18, 90, -0.4); leaf(gx, gy - h * 0.28, 80, Math.PI + 0.4); leaf(gx, gy - h * 0.38, 70, -0.6);
    // sun
    sun(ctx, w * 0.12, h * 0.14, 30, t);
    const f = st.focusIndex ?? 0;
    const flow = (x0: number, y0: number, x1: number, y1: number, color: string, text: string, active: boolean, speed = 0.5) => {
      ctx.globalAlpha = active ? 1 : 0.35;
      for (let i = 0; i < 4; i++) {
        const p = ((t * speed + i / 4) % 1);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, active ? 6 : 4, 0, TAU); ctx.fill();
      }
      label(ctx, text, x0, y0 - 12, { size: active ? 16 : 13, color: color, shadow: false, weight: 700 });
      ctx.globalAlpha = 1;
    };
    flow(w * 0.2, h * 0.22, gx - 10, gy - h * 0.3, '#e6a400', 'Quyosh nuri', f >= 1);
    flow(w * 0.85, h * 0.35, gx + 30, gy - h * 0.28, '#5b6b7a', 'CO₂', f === 0 || f >= 1);
    flow(gx, gy + 70, gx, gy - h * 0.15, '#2d7de0', 'H₂O', f === 0 || f >= 1, 0.35);
    flow(gx - 40, gy - h * 0.33, w * 0.12, h * 0.5, '#1aa260', 'O₂', f >= 2, 0.4);
    if (f >= 1) label(ctx, 'C₆H₁₂O₆ (glyukoza)', gx + 120, gy - h * 0.42, { size: 15, color: '#8a4b00', shadow: false, weight: 700 });
    label(ctx, '6CO₂ + 6H₂O  →  C₆H₁₂O₆ + 6O₂', w * 0.5, h * 0.95, { size: 18, color: '#fff', weight: 700 });
  },

  colors(ctx, w, h, t, st) {
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h);
    const cols = [['#e53935', 'Qizil', '🍎'], ['#fdd835', 'Sariq', '☀️'], ['#43a047', 'Yashil', '🌿'], ['#1e88e5', 'Ko‘k', '☁️']];
    const all = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa'];
    const cx = w / 2;
    const cy = h * 0.78;
    all.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = Math.min(w, h) * 0.045;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * (0.62 - i * 0.05), Math.PI, TAU); ctx.stroke();
    });
    const fi = Math.max(0, (st.focusIndex ?? 0) - 1);
    if ((st.focusIndex ?? 0) >= 1 && cols[fi]) {
      const [c, name, emoji] = cols[Math.min(fi, cols.length - 1)];
      const b = 1 + 0.06 * Math.sin(t * 5);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx, h * 0.42, 70 * b, 0, TAU); ctx.fill();
      label(ctx, emoji, cx, h * 0.42 + 16, { size: 54, shadow: false });
      label(ctx, name, cx, h * 0.42 + 115, { size: 34, color: c, weight: 800, shadow: false });
    }
  },

  counting(ctx, w, h, t, st) {
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(0, 0, w, h);
    const n = st.focusIndex >= 2 ? 5 : st.focusIndex === 1 ? Math.min(5, Math.floor((t - (st.focusAt || 0)) / 0.8) + 1) : 0;
    const basketY = h * 0.72;
    ctx.fillStyle = '#b5772f';
    ctx.beginPath(); ctx.moveTo(w * 0.25, basketY); ctx.lineTo(w * 0.75, basketY); ctx.lineTo(w * 0.68, h * 0.93); ctx.lineTo(w * 0.32, h * 0.93); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const x = w * (0.22 + i * 0.14);
      const y = h * 0.4 + Math.sin(t * 3 + i) * 6;
      const on = i < n;
      ctx.globalAlpha = on ? 1 : 0.18;
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath(); ctx.ellipse(x + 8, y - 36, 10, 5, -0.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (on) label(ctx, String(i + 1), x, y + 80, { size: 40, color: '#1e3a8a', weight: 800, shadow: false });
    }
  },

  neuron(ctx, w, h, t, st) {
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
    const ins = [0.3, 0.5, 0.7].map((f) => [w * 0.13, h * f]);
    const ws = ['w₁=0.8', 'w₂=−0.4', 'w₃=1.2'];
    const sx = w * 0.48;
    const sy = h * 0.5;
    ins.forEach(([x, y], i) => {
      ctx.strokeStyle = 'rgba(120,180,255,.6)'; ctx.lineWidth = 2 + i;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx - 40, sy); ctx.stroke();
      const p = (t * 0.6 + i * 0.2) % 1;
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath(); ctx.arc(x + (sx - 40 - x) * p, y + (sy - y) * p, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b2a45'; ctx.strokeStyle = '#7fd4ff';
      ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); ctx.stroke();
      label(ctx, `x${'₁₂₃'[i]}`, x, y + 5, { size: 15 });
      label(ctx, ws[i], (x + sx) / 2, (y + sy) / 2 - 10, { size: 13, color: st.focusIndex >= 1 ? '#ffd27a' : '#9fb4d8' });
    });
    ctx.fillStyle = '#233a63'; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, 40, 0, TAU); ctx.fill(); ctx.stroke();
    label(ctx, 'Σ + b', sx, sy + 6, { size: 18, color: '#ffd27a' });
    // activation box
    const ax = w * 0.7;
    const ay = sy;
    ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + 40, sy); ctx.lineTo(ax - 50, ay); ctx.stroke();
    ctx.fillStyle = '#1b2a45'; ctx.fillRect(ax - 50, ay - 45, 100, 90); ctx.strokeRect(ax - 50, ay - 45, 100, 90);
    const useRelu = !st.focusText || !/сигмоид|sigmoid/.test(st.focusText);
    ctx.strokeStyle = st.focusIndex >= 2 ? '#7dff9b' : '#9fb4d8'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const xv = -4 + (i / 40) * 8;
      const yv = useRelu ? Math.max(0, xv) / 4 : 1 / (1 + Math.exp(-xv));
      const px = ax - 40 + (i / 40) * 80;
      const py = ay + 35 - yv * 70;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    label(ctx, useRelu ? 'ReLU' : 'σ(x)', ax, ay - 55, { size: 14 });
    ctx.strokeStyle = '#7fd4ff';
    ctx.beginPath(); ctx.moveTo(ax + 50, ay); ctx.lineTo(w * 0.92, ay); ctx.stroke();
    label(ctx, 'y', w * 0.94, ay + 6, { size: 18 });
    label(ctx, 'y = f(Σ wᵢxᵢ + b)', w * 0.5, h * 0.9, { size: 20, color: '#ffd27a' });
  },

  'neural-net'(ctx, w, h, t, st) {
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
    const layers = [3, 5, 5, 2];
    const names = ['Kirish', 'Yashirin 1', 'Yashirin 2', 'Chiqish'];
    const pos = layers.map((n, li) => Array.from({ length: n }, (_, i) => [w * (0.14 + li * 0.24), h * (0.5 + (i - (n - 1) / 2) * 0.15)]));
    const wave = (t * 0.7) % (layers.length + 0.5);
    for (let li = 0; li < layers.length - 1; li++) {
      for (const a of pos[li]) for (const b of pos[li + 1]) {
        const act = wave > li && wave < li + 1.2;
        ctx.strokeStyle = act ? 'rgba(127,212,255,.55)' : 'rgba(127,160,220,.12)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        if (act) {
          const p = Math.min(1, wave - li);
          ctx.fillStyle = '#7fd4ff';
          ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, 2.5, 0, TAU); ctx.fill();
        }
      }
    }
    pos.forEach((L, li) => {
      L.forEach(([x, y]) => {
        const lit = Math.abs(wave - li) < 0.5;
        ctx.fillStyle = lit ? '#ffd27a' : '#233a63'; ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.stroke();
      });
      label(ctx, names[li], pos[li][0][0], h * 0.12, { size: 13, color: '#9fb4d8' });
    });
    if ((st.focusIndex ?? 0) >= 2) {
      label(ctx, 'Loss = L(ŷ, y)', w * 0.88, h * 0.88, { size: 16, color: '#ff8a80' });
    }
  },

  gradient(ctx, w, h, t) {
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
    const f = (x: number) => 0.12 * x * x + 0.35 * Math.sin(1.6 * x);
    const X = (x: number) => w * 0.5 + x * w * 0.09;
    const Y = (y: number) => h * 0.82 - y * h * 0.18;
    ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -4.5; x <= 4.5; x += 0.05) { if (x === -4.5) ctx.moveTo(X(x), Y(f(x))); else ctx.lineTo(X(x), Y(f(x))); }
    ctx.stroke();
    // gradient descent steps, restarting every few seconds
    let x = 4;
    const lr = 0.9;
    const steps = Math.floor((t % 8) / 0.6);
    ctx.fillStyle = '#ffd27a';
    for (let i = 0; i <= steps; i++) {
      const g = 0.24 * x + 0.56 * Math.cos(1.6 * x);
      const nx = x - lr * g;
      ctx.globalAlpha = 0.3 + 0.7 * (i / Math.max(1, steps));
      ctx.beginPath(); ctx.arc(X(x), Y(f(x)), 7, 0, TAU); ctx.fill();
      if (i < steps) {
        ctx.strokeStyle = 'rgba(255,210,122,.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(x), Y(f(x))); ctx.lineTo(X(nx), Y(f(nx))); ctx.stroke();
      }
      x = nx;
    }
    ctx.globalAlpha = 1;
    label(ctx, 'w ← w − η · ∂L/∂w', w * 0.5, h * 0.12, { size: 22, color: '#ffd27a' });
    label(ctx, 'L(w)', X(-4.6), Y(f(-4.5)) - 12, { size: 14, color: '#9fb4d8' });
  },

  fractions(ctx, w, h, t, st) {
    ctx.fillStyle = '#fff8ee'; ctx.fillRect(0, 0, w, h);
    const pizza = (cx: number, cy: number, r: number, parts: number, taken: number, caption: string, hi: boolean) => {
      for (let i = 0; i < parts; i++) {
        const a0 = -Math.PI / 2 + (i * TAU) / parts;
        const a1 = a0 + TAU / parts;
        const on = i < taken;
        const mid = (a0 + a1) / 2;
        const pop = on && parts > 1 ? 6 + Math.sin(t * 3 + i) * 2 : 0;
        const ox = Math.cos(mid) * pop;
        const oy = Math.sin(mid) * pop;
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.arc(cx + ox, cy + oy, r, a0, a1); ctx.closePath();
        ctx.fillStyle = on ? '#f4a63a' : '#f3e2c4'; ctx.fill();
        ctx.strokeStyle = '#b8742a'; ctx.lineWidth = 3; ctx.stroke();
        if (on) for (let k = 0; k < 3; k++) {
          const pr = r * (0.35 + 0.18 * k);
          const pa = a0 + ((k + 1) * (a1 - a0)) / 4;
          ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(cx + ox + Math.cos(pa) * pr, cy + oy + Math.sin(pa) * pr, r * 0.06, 0, TAU); ctx.fill();
        }
      }
      label(ctx, caption, cx, cy + r + 46, { size: hi ? 34 : 26, color: hi ? '#c2410c' : '#7c5a2c', weight: 800, shadow: false });
    };
    const r = Math.min(w / 7, h / 3.4);
    const fi = st.focusIndex ?? 0;
    const compare = /taqqos|maxraji bir|katta|yarim/.test(st.focusText);
    if (compare) {
      const halves = /yarim/.test(st.focusText);
      pizza(w * 0.28, h * 0.42, r, halves ? 2 : 4, halves ? 1 : 3, halves ? '1/2' : '3/4', true);
      pizza(w * 0.72, h * 0.42, r, 4, 1, '1/4', false);
      label(ctx, '>', w * 0.5, h * 0.46, { size: 64, color: '#c2410c', weight: 800, shadow: false });
    } else {
      pizza(w * 0.36, h * 0.44, r * 1.25, fi === 0 ? 1 : 4, 1, fi === 0 ? '1 butun' : '1/4', true);
      if (fi >= 2) {
        label(ctx, '1', w * 0.74, h * 0.37, { size: 64, color: '#1d4ed8', weight: 800, shadow: false });
        ctx.fillStyle = '#111827'; ctx.fillRect(w * 0.69, h * 0.41, w * 0.1, 5);
        label(ctx, '4', w * 0.74, h * 0.53, { size: 64, color: '#15803d', weight: 800, shadow: false });
        label(ctx, '← surat', w * 0.81, h * 0.35, { size: 18, color: '#1d4ed8', shadow: false, align: 'left' });
        label(ctx, '← maxraj', w * 0.81, h * 0.51, { size: 18, color: '#15803d', shadow: false, align: 'left' });
      }
    }
  },

  'water-cycle'(ctx, w, h, t, st) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9fd3ff'); g.addColorStop(0.62, '#e2f3ff'); g.addColorStop(0.63, '#2f7fd8'); g.addColorStop(1, '#1d4f9a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5b8c4a';
    ctx.beginPath(); ctx.moveTo(w * 0.45, h * 0.63); ctx.lineTo(w * 0.78, h * 0.22); ctx.lineTo(w * 1.05, h * 0.63); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(w * 0.72, h * 0.3); ctx.lineTo(w * 0.78, h * 0.22); ctx.lineTo(w * 0.84, h * 0.3); ctx.fill();
    sun(ctx, w * 0.1, h * 0.12, Math.min(w, h) * 0.06, t);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = 0; x < w * 0.5; x += 8) ctx.lineTo(x, h * (0.68 + i * 0.05) + Math.sin(x / 20 + t * 2 + i) * 3);
      ctx.stroke();
    }
    const fi = st.focusIndex ?? 0;
    const rain = /yomg|qor|qaytadi|aylanib/.test(st.focusText);
    ctx.globalAlpha = rain ? 0.35 : 1;
    for (let i = 0; i < 8; i++) {
      const p = (t * 0.4 + i / 8) % 1;
      const x = w * (0.08 + i * 0.05);
      ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, h * 0.62 - p * h * 0.4); ctx.quadraticCurveTo(x + 8, h * 0.6 - p * h * 0.4 - 10, x, h * 0.58 - p * h * 0.4 - 20); ctx.stroke();
    }
    label(ctx, 'Bug‘lanish ↑', w * 0.22, h * 0.56, { size: 18, weight: 700 });
    ctx.globalAlpha = 1;
    const cx = w * 0.45 + Math.sin(t * 0.3) * 20;
    const cy = h * 0.16;
    ctx.fillStyle = rain ? '#8a9bb0' : fi >= 2 ? '#ffffff' : 'rgba(255,255,255,.4)';
    for (const [dx, dy, rr] of [[0, 0, 40], [40, -14, 46], [84, 0, 38], [42, 14, 40]] as const) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rr, 0, TAU); ctx.fill(); }
    label(ctx, 'Bulut', cx + 42, cy + 72, { size: 18, weight: 700 });
    if (rain) {
      ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const p = (t * 1.4 + i * 0.37) % 1;
        const x = cx - 20 + ((i * 37) % 140);
        const y = cy + 40 + p * h * 0.35;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke();
      }
      label(ctx, 'Yog‘ingarchilik ↓', cx + 170, cy + 110, { size: 18, weight: 700 });
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(w * 0.8, h * 0.32); ctx.quadraticCurveTo(w * 0.62, h * 0.5, w * 0.5, h * 0.64); ctx.stroke();
      const p = (t * 0.5) % 1;
      ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.arc(w * 0.8 - p * w * 0.3, h * 0.32 + p * h * 0.32, 5, 0, TAU); ctx.fill();
    }
  },
};


/** Mount a material into a container. Returns { focus(text, index), destroy() }. */
export function mountVisual(container: HTMLElement, material: (Material & { fileUrl?: string }) | undefined, section?: LessonSection): VisualHandle {
  container.innerHTML = '';
  const scene = material?.visual ? SCENES[material.visual] : undefined;
  if (!material || (!scene && !(material.fileUrl && material.fileMime?.startsWith('image/')))) {
    const card = document.createElement('div');
    card.className = 'visual-text';
    card.innerHTML = `<h3></h3><ul></ul>`;
    card.querySelector('h3')!.textContent = section?.title || material?.title || '';
    for (const s of section?.sentences || []) {
      const li = document.createElement('li');
      li.textContent = s;
      card.querySelector('ul')!.append(li);
    }
    container.append(card);
    return {
      focus(_: string, i: number) { card.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === i)); },
      destroy() {},
    };
  }
  if (!scene) {
    const img = document.createElement('img');
    img.className = 'visual-image';
    img.src = material.fileUrl!;
    img.alt = material.title;
    container.append(img);
    return { focus() {}, destroy() {} };
  }
  const canvas = document.createElement('canvas');
  container.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const st: SceneState = { focusText: '', focusIndex: 0, focusAt: 0, showLabels: true };
  let alive = true;
  const start = performance.now();
  const resize = () => {
    const r = container.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(10, r.width * dpr);
    canvas.height = Math.max(10, r.height * dpr);
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const draw = (now: number) => {
    if (!alive) return;
    const t = (now - start) / 1000;
    const r = container.getBoundingClientRect();
    try { scene(ctx, r.width, r.height, t, st); } catch (e) { console.error(e); }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return {
    focus(text: string, index: number) {
      st.focusText = String(text || '').toLowerCase();
      st.focusIndex = index;
      st.focusAt = (performance.now() - start) / 1000;
    },
    destroy() { alive = false; ro.disconnect(); },
  };
}
