// Computer vision for the Avatar studio, running fully in the browser (no uploads to third
// parties): MediaPipe face landmarks to calibrate photos and track video clips, and selfie
// segmentation to remove the background of photos. Models and WASM are served from /public.
import type { FaceLandmarker, ImageSegmenter, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Landmarks, LandmarkTrack } from '@/lib/core/types';

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
let face: Promise<FaceLandmarker> | null = null;
let seg: Promise<ImageSegmenter> | null = null;

async function fileset() {
  const { FilesetResolver } = await import('@mediapipe/tasks-vision');
  return FilesetResolver.forVisionTasks('/mediapipe/wasm');
}

function faceLandmarker() {
  face ??= (async () => {
    const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
    return FaceLandmarker.createFromOptions(await fileset(), {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 1,
    });
  })().catch((e) => { face = null; throw e; });
  return face;
}

function segmenter() {
  seg ??= (async () => {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    return ImageSegmenter.createFromOptions(await fileset(), {
      baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })().catch((e) => { seg = null; throw e; });
  return seg;
}

const sizeOf = (s: Source) => (s instanceof HTMLVideoElement ? [s.videoWidth, s.videoHeight] : s instanceof HTMLImageElement ? [s.naturalWidth, s.naturalHeight] : [s.width, s.height]);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Convert MediaPipe's 478-point face mesh to the avatar's calibration points (image pixels). */
export function meshToLandmarks(pts: NormalizedLandmark[], w: number, h: number): Landmarks {
  const P = (i: number): [number, number] => [pts[i].x * w, pts[i].y * h];
  const hasIris = pts.length >= 478;
  // eye centres: iris when available, otherwise midpoint of the eye corners
  let e1 = hasIris ? P(468) : ([(P(33)[0] + P(133)[0]) / 2, (P(33)[1] + P(133)[1]) / 2] as [number, number]);
  let e2 = hasIris ? P(473) : ([(P(362)[0] + P(263)[0]) / 2, (P(362)[1] + P(263)[1]) / 2] as [number, number]);
  if (e1[0] > e2[0]) [e1, e2] = [e2, e1];
  const eyeWidth = (dist(P(33), P(133)) + dist(P(362), P(263))) / 2;
  const eyeOpen = (dist(P(159), P(145)) + dist(P(386), P(374))) / 2;
  let m1 = P(61);
  let m2 = P(291);
  if (m1[0] > m2[0]) [m1, m2] = [m2, m1];
  const up = P(13);
  const lo = P(14);
  const mouthC: [number, number] = [(up[0] + lo[0]) / 2, (up[1] + lo[1]) / 2];
  const chin = P(152);
  // the neck pivot sits roughly half a mouth-to-chin distance below the chin
  const neck: [number, number] = [chin[0] + (chin[0] - mouthC[0]) * 0.52, chin[1] + (chin[1] - mouthC[1]) * 0.52];
  const pt = (p: [number, number]): [number, number] => [r1(p[0]), r1(p[1])];
  return {
    eyeL: pt(e1), eyeR: pt(e2), eyeW: r1(eyeWidth / 2), eyeH: r1(Math.max(eyeOpen * 0.85, eyeWidth * 0.24)),
    mouthL: pt(m1), mouthC: pt(mouthC), mouthR: pt(m2), chin: pt(chin), neck: pt(neck),
  };
}

export async function detectLandmarks(src: Source): Promise<Landmarks | null> {
  const fl = await faceLandmarker();
  const [w, h] = sizeOf(src);
  const r = fl.detect(src);
  const pts = r.faceLandmarks[0];
  return pts ? meshToLandmarks(pts, w, h) : null;
}

/** Track the face through a clip at `fps`; frames where no face is found reuse the previous one. */
export async function trackVideo(video: HTMLVideoElement, fps = 15, onProgress?: (f: number) => void): Promise<LandmarkTrack> {
  const raw: (Landmarks | null)[] = [];
  const n = Math.max(1, Math.floor(video.duration * fps));
  video.pause();
  for (let i = 0; i < n; i++) {
    video.currentTime = Math.min(video.duration - 0.001, i / fps);
    await new Promise<void>((res) => video.addEventListener('seeked', () => res(), { once: true }));
    raw.push((await detectLandmarks(video)) ?? raw[raw.length - 1] ?? null);
    onProgress?.((i + 1) / n);
  }
  const first = raw.find(Boolean);
  if (!first) throw new Error('Videoda yuz topilmadi');
  const frames = raw.map((f) => f ?? first); // fill leading gaps
  video.currentTime = 0;
  return { fps, frames: smooth(frames) };
}

// Light temporal smoothing removes tracker jitter that would make the mouth shimmer.
function smooth(frames: Landmarks[]): Landmarks[] {
  if (frames.length < 3) return frames;
  const keys = ['eyeL', 'eyeR', 'mouthL', 'mouthC', 'mouthR', 'chin', 'neck'] as const;
  return frames.map((f, i) => {
    const a = frames[Math.max(0, i - 1)];
    const b = frames[Math.min(frames.length - 1, i + 1)];
    const out = { ...f } as Landmarks;
    for (const k of keys) out[k] = [r1((a[k][0] + 2 * f[k][0] + b[k][0]) / 4), r1((a[k][1] + 2 * f[k][1] + b[k][1]) / 4)];
    return out;
  });
}

/** Person cut-out with soft edges, as a transparent WebP blob. */
export async function removeBackground(img: HTMLImageElement): Promise<Blob> {
  const s = await segmenter();
  const [w, h] = sizeOf(img);
  const res = s.segment(img);
  const mask = res.confidenceMasks?.[0];
  if (!mask) throw new Error('segmentation failed');
  const conf = mask.getAsFloat32Array();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const mw = mask.width;
  const mh = mask.height;
  for (let y = 0; y < h; y++) {
    const my = Math.min(mh - 1, Math.floor((y / h) * mh));
    for (let x = 0; x < w; x++) {
      const v = conf[my * mw + Math.min(mw - 1, Math.floor((x / w) * mw))];
      const a = Math.max(0, Math.min(1, (v - 0.35) / 0.3)); // soft threshold around 0.5
      data.data[(y * w + x) * 4 + 3] = Math.round(data.data[(y * w + x) * 4 + 3] * a);
    }
  }
  mask.close();
  ctx.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/webp', 0.92));
}
