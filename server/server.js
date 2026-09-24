'use strict';
/* Демо-сервер «Единый реестр камер»: отдаёт страницу прототипа и хранит общее состояние демо в PostgreSQL.
   Логика процесса пока выполняется на странице; сервер хранит состояние с контролем версий,
   чтобы два участника не перезаписали изменения друг друга. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {Pool} = require('pg');

const PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_BODY = 30 * 1024 * 1024;
const pool = process.env.DATABASE_URL ? new Pool({connectionString: process.env.DATABASE_URL, max: 5}) : null;
let dbReady = false;

/* ---------- статика: файлы читаются и сжимаются один раз при запуске ---------- */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'};
const files = new Map();
function addFile(url, file) {
  const body = fs.readFileSync(file);
  files.set(url, {body, gz: zlib.gzipSync(body, {level: 6}), type: TYPES[path.extname(file)] || 'application/octet-stream'});
}
addFile('/', path.join(PUBLIC, 'index.html'));
if (fs.existsSync(path.join(PUBLIC, 'docs'))) for (const f of fs.readdirSync(path.join(PUBLIC, 'docs'))) addFile('/docs/' + f, path.join(PUBLIC, 'docs', f));

const HEADERS = {'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-cache'};
function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, {...HEADERS, 'Content-Type': type, ...extra});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), {status: 413})); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('bad json'), {status: 400})); } });
    req.on('error', reject);
  });
}

/* ---------- база ---------- */
async function initDb() {
  for (let i = 1; i <= 60; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS demo_state (
        id integer PRIMARY KEY, version integer NOT NULL, state jsonb, updated_at timestamptz NOT NULL DEFAULT now())`);
      await pool.query(`INSERT INTO demo_state (id, version, state) VALUES (1, 0, NULL) ON CONFLICT (id) DO NOTHING`);
      dbReady = true; console.log('PostgreSQL: готово'); return;
    } catch (e) { console.log(`PostgreSQL недоступна (попытка ${i}): ${e.message}`); await new Promise(r => setTimeout(r, 2000)); }
  }
  console.error('PostgreSQL так и не стала доступна — сервер работает без общих данных');
}

async function api(req, res, url) {
  if (!pool || !dbReady) return send(res, 503, {error: 'Общие данные недоступны'});
  if (req.method === 'GET' && url === '/api/state/version') {
    const {rows} = await pool.query('SELECT version FROM demo_state WHERE id = 1');
    return send(res, 200, {version: rows[0].version});
  }
  if (req.method === 'GET' && url === '/api/state') {
    const {rows} = await pool.query('SELECT version, state, updated_at FROM demo_state WHERE id = 1');
    return send(res, 200, rows[0]);
  }
  if (req.method === 'PUT' && url === '/api/state') {
    const b = await readJson(req);
    if (!Number.isInteger(b.version) || !b.state || typeof b.state !== 'object') return send(res, 400, {error: 'Нужны version и state'});
    const {rows} = await pool.query(
      'UPDATE demo_state SET version = version + 1, state = $2, updated_at = now() WHERE id = 1 AND version = $1 RETURNING version', [b.version, b.state]);
    if (!rows.length) { const cur = await pool.query('SELECT version FROM demo_state WHERE id = 1'); return send(res, 409, {error: 'Данные изменил другой участник', version: cur.rows[0].version}); }
    return send(res, 200, {version: rows[0].version});
  }
  if (req.method === 'POST' && url === '/api/state/reset') {
    const b = await readJson(req);
    if (!b.state || typeof b.state !== 'object') return send(res, 400, {error: 'Нужно state'});
    const {rows} = await pool.query('UPDATE demo_state SET version = version + 1, state = $1, updated_at = now() WHERE id = 1 RETURNING version', [b.state]);
    console.log('Демо-данные сброшены');
    return send(res, 200, {version: rows[0].version});
  }
  return send(res, 404, {error: 'Не найдено'});
}

http.createServer(async (req, res) => {
  const url = decodeURI((req.url || '/').split('?')[0]);
  try {
    if (url === '/healthz') {
      if (pool && dbReady) await pool.query('SELECT 1');
      return send(res, 200, 'ok\n', 'text/plain; charset=utf-8');
    }
    if (url.startsWith('/api/')) return await api(req, res, url);
    if (url === '/lifecycle') return send(res, 301, '', 'text/plain', {Location: '/docs/lifecycle.html'});
    const f = files.get(url === '/index.html' ? '/' : url);
    if (!f || !['GET', 'HEAD'].includes(req.method)) return send(res, 404, 'Не найдено', 'text/plain; charset=utf-8');
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, {...HEADERS, 'Content-Type': f.type, 'Vary': 'Accept-Encoding', ...(gz ? {'Content-Encoding': 'gzip'} : {})});
    return res.end(req.method === 'HEAD' ? undefined : gz ? f.gz : f.body);
  } catch (e) {
    console.error(req.method, url, e.message);
    return send(res, e.status || 500, {error: e.status ? e.message : 'Ошибка сервера'});
  }
}).listen(PORT, () => {
  console.log(`Единый реестр камер (демо): порт ${PORT}, общие данные: ${pool ? 'PostgreSQL' : 'нет (DATABASE_URL не задан)'}`);
  if (pool) initDb();
});
