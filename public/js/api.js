// API client. Talks to the Node server when it is running; otherwise (static hosting / file
// preview) it runs the very same Platform code in the browser with data in localStorage.

let mode = null;
let local = null;
const LS_KEY = 'ai-teacher-offline-db-v1';
const TOKEN_KEY = 'ai-teacher-offline-token';

async function detect() {
  if (mode) return mode;
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    mode = j && j.ok ? 'server' : 'local';
  } catch {
    mode = 'local';
  }
  if (mode === 'local') {
    const { Platform } = await import('../../shared/platform.js');
    let data;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || undefined; } catch { data = undefined; }
    local = await Platform.create({
      data,
      keepSessionsInData: true,
      persist: (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { console.warn('localStorage full', e); } },
    });
  }
  return mode;
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(method, path, body) {
  await detect();
  const [p, qs] = path.split('?');
  if (mode === 'server') {
    let r;
    try {
      r = await fetch('api/' + path, {
        method,
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        credentials: 'same-origin',
      });
    } catch {
      throw new ApiError(0, 'Tarmoq bilan aloqa yo‘q');
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, j.error || r.statusText);
    return j;
  }
  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch { /* private mode */ }
  const out = await local.handle({ method, path: '/api/' + p, query: Object.fromEntries(new URLSearchParams(qs || '')), body: structuredClone(body || {}), token });
  try {
    if (out.token) localStorage.setItem(TOKEN_KEY, out.token);
    if (out.clearToken) localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
  if (out.status !== 200) throw new ApiError(out.status, out.body.error);
  return structuredClone(out.body);
}

export const get = (p) => api('GET', p);
export const post = (p, b) => api('POST', p, b);
export const put = (p, b) => api('PUT', p, b);
export const del = (p) => api('DELETE', p);
export const apiMode = async () => detect();
export function resetOfflineData() {
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
