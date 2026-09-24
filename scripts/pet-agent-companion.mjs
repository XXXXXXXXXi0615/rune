import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_PAYLOAD_BYTES, validateActivity } from './pet-agent-protocol.mjs';
import { buildInstalledHooks, buildUninstalledHooks, detectInstall, detectTrust, installRuntime, pathsFor, readHooks, writeHooksWithBackup } from './pet-hook-installer-lib.mjs';

const host = '127.0.0.1';
const port = Number(process.env.LUNARTIDE_PET_PORT || 47831);
let token = process.env.LUNARTIDE_PET_PAIRING_TOKEN;
const runtimePaths = pathsFor();
try { token ||= fs.readFileSync(path.join(os.homedir(), '.codex', 'lunartide-pet-bridge', 'token'), 'utf8').trim(); } catch { /* validated below */ }
if (!token || token.length < 16) throw new Error('LUNARTIDE_PET_PAIRING_TOKEN 至少需要 16 個字元');

const clients = new Set();
const seen = new Map();
const prune = (now) => { for (const [id, expires] of seen) if (expires <= now) seen.delete(id); };
const accepts = (id, now) => { prune(now); if (seen.has(id)) return false; seen.set(id, now + 60_000); return true; };

function authorized(req, url) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return bearer === token || url.searchParams.get('token') === token;
}

function sendFrame(socket, payload) {
  const body = Buffer.from(payload);
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
  socket.write(Buffer.concat([header, body]));
}

function broadcast(event) {
  const payload = JSON.stringify({ kind: 'activity', event });
  for (const socket of clients) {
    if (socket.destroyed) clients.delete(socket); else sendFrame(socket, payload);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const origin = req.headers.origin;
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') res.setHeader('Access-Control-Allow-Origin', origin);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: 1, clients: clients.size }));
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }); res.end(); return; }
  if (url.pathname === '/hooks/manage' && req.method === 'POST') {
    if (!authorized(req, url)) { res.writeHead(401).end(); return; }
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (Buffer.byteLength(raw) > 512) req.destroy(); });
    req.on('end', () => {
      let action = '';
      try { action = JSON.parse(raw).action; } catch { res.writeHead(400).end(); return; }
      if (action !== 'install' && action !== 'uninstall') { res.writeHead(422).end(); return; }
      try {
        const existing = readHooks(runtimePaths.hooksFile);
        if (action === 'install') installRuntime(runtimePaths, path.dirname(new URL(import.meta.url).pathname), token);
        const next = action === 'install' ? buildInstalledHooks(existing, process.execPath, runtimePaths.adapterFile) : buildUninstalledHooks(existing);
        const backupFile = writeHooksWithBackup(runtimePaths.hooksFile, next);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, action, backupCreated: Boolean(backupFile) }));
      } catch { res.writeHead(500).end(); }
    });
    return;
  }
  if (url.pathname !== '/event' || req.method !== 'POST') { res.writeHead(404).end(); return; }
  if (!authorized(req, url)) { res.writeHead(401).end(); return; }
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_PAYLOAD_BYTES) req.destroy(); else chunks.push(chunk);
  });
  req.on('end', () => {
    if (size > MAX_PAYLOAD_BYTES) return;
    let parsed;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400).end(); return; }
    const result = validateActivity(parsed);
    if (!result.ok) { res.writeHead(422, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: result.error })); return; }
    if (!accepts(result.value.id, Date.now())) { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'duplicate_event' })); return; }
    broadcast(result.value);
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  if (url.pathname !== '/events' || !authorized(req, url)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  clients.add(socket);
  let hookStatus = 'not-installed';
  let missingPostToolUse = false;
  try {
    const hooks = readHooks(runtimePaths.hooksFile);
    const install = detectInstall(hooks, runtimePaths.adapterFile);
    const installed = install.installed || install.missingEvents.every((event) => event === 'PostToolUse');
    missingPostToolUse = install.missingEvents.includes('PostToolUse');
    const configText = fs.existsSync(path.join(runtimePaths.codexHome, 'config.toml')) ? fs.readFileSync(path.join(runtimePaths.codexHome, 'config.toml'), 'utf8') : '';
    hookStatus = !installed ? 'incomplete' : detectTrust(hooks, configText).trusted ? 'installed' : 'review-required';
  } catch { hookStatus = 'error'; }
  sendFrame(socket, JSON.stringify({ kind: 'connected', protocol: 1, hookStatus, missingPostToolUse }));
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});

server.listen(port, host, () => console.log(`Lunartide Pet Companion: ws://${host}:${port}/events`));

const heartbeat = setInterval(() => broadcast({ version: 1, id: `heartbeat:${Date.now()}`, type: 'heartbeat', source: 'codex', timestamp: Date.now() }), 5_000);
heartbeat.unref();
