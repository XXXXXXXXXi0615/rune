import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeCodexHook } from './pet-agent-protocol.mjs';

const tokenFile = process.env.LUNARTIDE_PET_TOKEN_FILE || path.join(os.homedir(), '.codex', 'lunartide-pet-bridge', 'token');
let token = process.env.LUNARTIDE_PET_PAIRING_TOKEN;
try { token ||= fs.readFileSync(tokenFile, 'utf8').trim(); } catch { /* companion remains optional */ }
const port = Number(process.env.LUNARTIDE_PET_PORT || 47831);
if (!token) process.exit(0);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; if (Buffer.byteLength(raw) > 4096) process.exit(0); });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const normalized = normalizeCodexHook(input);
  if (!normalized.ok) process.exit(0);
  const body = JSON.stringify(normalized.value);
  const request = http.request({ hostname: '127.0.0.1', port, path: '/event', method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
  request.setTimeout(500, () => request.destroy());
  request.on('error', () => process.exit(0));
  request.on('close', () => process.exit(0));
  request.end(body);
});
