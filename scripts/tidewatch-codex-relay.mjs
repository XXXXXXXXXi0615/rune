import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_PAYLOAD_BYTES, validateActivity } from './pet-agent-protocol.mjs';
import { detectInstall, pathsFor, readHooks } from './pet-hook-installer-lib.mjs';

const host = '127.0.0.1';
const port = Number(process.env.LUNARTIDE_PET_PORT || 47831);
const tokenFile = process.env.LUNARTIDE_PET_TOKEN_FILE || path.join(os.homedir(), '.codex', 'lunartide-pet-bridge', 'token');
let token = process.env.LUNARTIDE_PET_PAIRING_TOKEN;
try { token ||= fs.readFileSync(tokenFile, 'utf8').trim(); } catch { /* validated below */ }
if (!token || token.length < 16) throw new Error('TIDEWATCH relay token unavailable');

const allowedOrigins = new Set((process.env.LUNARTIDE_TIDEWATCH_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean));
const clients = new Set();
const seen = new Map();
const DEDUPE_MS = 120_000;
const accepts = (id, now) => {
  for (const [key, expiresAt] of seen) if (expiresAt <= now) seen.delete(key);
  if (seen.has(id)) return false;
  seen.set(id, now + DEDUPE_MS);
  return true;
};
const authorized = (req) => req.headers.authorization?.replace(/^Bearer\s+/i, '') === token;

function sendFrame(socket, frame) {
  const body = Buffer.from(JSON.stringify(frame));
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
  socket.write(Buffer.concat([header, body]));
}
function broadcast(frame) {
  for (const socket of clients) socket.destroyed ? clients.delete(socket) : sendFrame(socket, frame);
}
function hookStatus() {
  try {
    const runtime = pathsFor();
    const install = detectInstall(readHooks(runtime.hooksFile), runtime.adapterFile);
    return install.installed || install.missingEvents.every((event) => event === 'PostToolUse') ? 'installed' : 'incomplete';
  } catch { return 'error'; }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, protocol: 1, hookStatus: hookStatus(), clients: clients.size }));
    return;
  }
  if (url.pathname !== '/event' || req.method !== 'POST') { res.writeHead(404).end(); return; }
  if (!authorized(req)) { res.writeHead(401).end(); return; }
  let size = 0; const chunks = [];
  req.on('data', (chunk) => { size += chunk.length; if (size > MAX_PAYLOAD_BYTES) req.destroy(); else chunks.push(chunk); });
  req.on('end', () => {
    if (size > MAX_PAYLOAD_BYTES) return;
    let parsed;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400).end(); return; }
    const result = validateActivity(parsed);
    if (!result.ok) { res.writeHead(422).end(); return; }
    if (result.value.type === 'thinking') { res.writeHead(202).end(JSON.stringify({ ok: true, dropped: true })); return; }
    if (result.value.type === 'heartbeat') { broadcast({ kind: 'heartbeat', timestamp: result.value.timestamp }); res.writeHead(202).end(JSON.stringify({ ok: true })); return; }
    if (!accepts(result.value.id, Date.now())) { res.writeHead(202).end(JSON.stringify({ ok: true, duplicate: true })); return; }
    broadcast({ kind: 'activity', event: result.value });
    res.writeHead(202, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
  });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const origin = req.headers.origin;
  if (url.pathname !== '/events' || typeof origin !== 'string' || !allowedOrigins.has(origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  clients.add(socket); sendFrame(socket, { kind: 'connected', protocol: 1, hookStatus: hookStatus() });
  socket.on('close', () => clients.delete(socket)); socket.on('error', () => clients.delete(socket));
});

server.listen(port, host, () => console.log(`TIDEWATCH Codex relay listening on ws://${host}:${port}/events`));
const heartbeat = setInterval(() => broadcast({ kind: 'heartbeat', timestamp: Date.now() }), 5_000);
heartbeat.unref();
