// HTTP adapter: static files + /api → Platform. No framework, no build step.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Platform } from '../shared/platform.js';
import { createClaudeProvider } from './ai.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.AI_TEACHER_DB || path.join(root, 'data', 'db.json');
const COOKIE = 'ait_session';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const STATIC = [['/shared/', path.join(root, 'shared')], ['/', path.join(root, 'public')]];
const PAGES = { '/': 'index.html', '/classroom': 'classroom.html', '/admin': 'admin.html' };

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return undefined; }
}
let saveTimer = null;
function persist(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  }, 300);
}

const platform = await Platform.create({ data: loadDb(), persist, ai: await createClaudeProvider() });

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(self), microphone=(self)',
};

function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

async function readBody(req, limit = 8 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function serveStatic(req, res, pathname) {
  if (PAGES[pathname]) pathname = '/' + PAGES[pathname];
  for (const [prefix, dir] of STATIC) {
    if (!pathname.startsWith(prefix)) continue;
    const file = path.normalize(path.join(dir, pathname.slice(prefix.length)));
    if (!file.startsWith(dir)) break; // path traversal
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...securityHeaders });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  // CSRF guard: state-changing API calls must be same-origin JSON requests.
  if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) {
    res.writeHead(415, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'JSON expected' }));
  }
  let body;
  try { body = req.method === 'GET' ? {} : await readBody(req); } catch (e) {
    res.writeHead(e.status || 400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: e.message }));
  }
  const out = await platform.handle({
    method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, token: readCookie(req, COOKIE),
  });
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders };
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  if (out.token) headers['Set-Cookie'] = `${COOKIE}=${out.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`;
  if (out.clearToken) headers['Set-Cookie'] = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
  res.writeHead(out.status, headers);
  res.end(JSON.stringify(out.body));
});

server.listen(PORT, () => {
  console.log(`AI Teacher → http://localhost:${PORT}  (Classroom: /classroom, Admin: /admin)`);
  console.log(`AI answers: ${platform.ai ? 'Claude API' : 'offline engine (set ANTHROPIC_API_KEY to enable Claude)'}`);
});
