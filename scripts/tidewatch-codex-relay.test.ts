import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';

const port = 47931;
const token = 'fixture-token-at-least-sixteen';
const base = `http://127.0.0.1:${port}`;
let child: ChildProcessWithoutNullStreams;
let output = '';

beforeAll(async () => {
  child = spawn(process.execPath, ['scripts/tidewatch-codex-relay.mjs'], { cwd: process.cwd(), env: { ...process.env, LUNARTIDE_PET_PORT: String(port), LUNARTIDE_PET_PAIRING_TOKEN: token }, stdio: 'pipe' });
  child.stdout.on('data', (chunk) => { output += String(chunk); }); child.stderr.on('data', (chunk) => { output += String(chunk); });
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) { ready = await fetch(`${base}/health`).then((response) => response.ok).catch(() => false); if (!ready) await new Promise((resolve) => setTimeout(resolve, 50)); }
  if (!ready) throw new Error(`relay did not start: ${output}`);
});
afterAll(() => { if (child && !child.killed) child.kill('SIGTERM'); });

const payload = { version: 1, id: 'relay-event-1', type: 'tool.started', source: 'codex', timestamp: 100, sessionId: 'session-1', turnId: 'turn-1', toolCategory: 'search' };
const post = (authorization?: string, body: unknown = payload) => fetch(`${base}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });

async function openLocalWebSocket() {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  const frames: unknown[] = []; let buffer = Buffer.alloc(0); let upgraded = false;
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!upgraded) { const split = buffer.indexOf('\r\n\r\n'); if (split < 0) return; upgraded = true; buffer = buffer.subarray(split + 4); }
    while (buffer.length >= 2) { const length = buffer[1] & 0x7f; const header = length === 126 ? 4 : 2; const size = length === 126 ? buffer.readUInt16BE(2) : length; if (buffer.length < header + size) return; frames.push(JSON.parse(buffer.subarray(header, header + size).toString())); buffer = buffer.subarray(header + size); }
  });
  await new Promise<void>((resolve, reject) => { socket.once('connect', () => { const key = crypto.randomBytes(16).toString('base64'); socket.write(`GET /events HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: http://127.0.0.1:5173\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`); resolve(); }); socket.once('error', reject); });
  await expect.poll(() => upgraded).toBe(true);
  return { socket, frames };
}

describe('TIDEWATCH Codex relay', () => {
  it('serves health and requires the existing Bearer token', async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await post()).status).toBe(401);
    expect((await post('Bearer wrong-token')).status).toBe(401);
  });

  it('accepts an allowed localhost Origin, broadcasts normalized frames, and suppresses duplicates', async () => {
    const { socket, frames } = await openLocalWebSocket();
    expect((await post(`Bearer ${token}`)).status).toBe(202);
    await expect.poll(() => frames.some((frame) => (frame as { kind?: string }).kind === 'activity')).toBe(true);
    expect((await post(`Bearer ${token}`)).status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(frames.filter((frame) => (frame as { kind?: string }).kind === 'activity')).toHaveLength(1);
    socket.destroy();
  });

  it('drops thinking and never logs request bodies or tokens', async () => {
    const secret = 'secret-that-must-not-log';
    expect((await post(`Bearer ${token}`, { ...payload, id: 'thinking-1', type: 'thinking', secret })).status).toBe(422);
    expect(output).not.toContain(secret); expect(output).not.toContain(token); expect(output).not.toContain(JSON.stringify(payload));
  });
});
