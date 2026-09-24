import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const host = '127.0.0.1';
const port = 4173;
const base = '/lunartide/';
const distRoot = resolve('dist');

const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

async function sendFile(response, filePath) {
  const body = await readFile(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${host}:${port}`).pathname;
  if (!pathname.startsWith(base)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const relativePath = normalize(decodeURIComponent(pathname.slice(base.length))).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = join(distRoot, relativePath || 'index.html');

  try {
    const metadata = await stat(candidate);
    if (metadata.isFile()) {
      await sendFile(response, candidate);
      return;
    }
  } catch {
    // BrowserRouter deep links fall through to the app shell below.
  }

  try {
    await sendFile(response, join(distRoot, 'index.html'));
  } catch (error) {
    response.writeHead(500).end(`Pages preview failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}).listen(port, host, () => {
  console.log(`Pages preview: http://${host}:${port}${base}`);
});
