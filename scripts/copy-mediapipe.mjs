// Copies the MediaPipe WASM runtime into public/ so the Avatar studio works offline (no CDN).
import fs from 'node:fs';
const from = 'node_modules/@mediapipe/tasks-vision/wasm';
const to = 'public/mediapipe/wasm';
if (fs.existsSync(from)) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(`${from}/${f}`, `${to}/${f}`);
}
