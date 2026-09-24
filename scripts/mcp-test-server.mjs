import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 8787);
const sessions = new Map();

const reply = (res, payload, { sessionId, sse = false } = {}) => {
  if (sessionId) res.setHeader('MCP-Session-Id', sessionId);
  res.setHeader('MCP-Protocol-Version', '2025-11-25');
  if (sse) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname !== '/mcp') { res.writeHead(404).end(); return; }
  if (url.searchParams.get('auth') === 'required' && req.headers.authorization !== 'Bearer fixture-token') { res.writeHead(401).end(); return; }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(': fixture stream ready\n\n');
    return;
  }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const message = JSON.parse(body);
    const requestedSession = req.headers['mcp-session-id'];
    if (requestedSession && !sessions.has(requestedSession)) { res.writeHead(404).end(); return; }
    const useSse = url.searchParams.get('response') === 'sse';
    if (message.method === 'initialize') {
      const sessionId = randomUUID();
      sessions.set(sessionId, { calls: 0 });
      reply(res, { jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'Lunartide MCP Fixture', version: '1.0.0' } } }, { sessionId, sse: useSse });
      return;
    }
    if (url.searchParams.get('expire') === 'true') { sessions.delete(requestedSession); res.writeHead(404).end(); return; }
    if (message.method === 'notifications/initialized') { res.writeHead(202).end(); return; }
    if (message.method === 'tools/list') {
      reply(res, { jsonrpc: '2.0', id: message.id, result: { tools: [
        { name: 'echo', description: 'Returns the supplied text without side effects.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, annotations: { readOnlyHint: true } },
        { name: 'delay', description: 'Waits before returning so cancellation can be tested.', inputSchema: { type: 'object', properties: { milliseconds: { type: 'number' } } }, annotations: { readOnlyHint: true } },
      ] } }, { sse: useSse });
      return;
    }
    if (message.method === 'tools/call') {
      const finish = () => reply(res, { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: message.params.name === 'echo' ? String(message.params.arguments?.text || '') : 'delay complete' }], isError: false } }, { sse: useSse });
      if (message.params.name === 'delay') setTimeout(finish, Math.min(Number(message.params.arguments?.milliseconds || 1500), 10000)); else finish();
      return;
    }
    reply(res, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }, { sse: useSse });
  });
});

server.listen(port, '127.0.0.1', () => console.log(`Lunartide MCP fixture: http://127.0.0.1:${port}/mcp`));
