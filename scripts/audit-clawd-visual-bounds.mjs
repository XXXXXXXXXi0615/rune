import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const root = process.cwd();
const manifest = await readFile(resolve(root, 'src/features/clawdAssets/productionClawdAssetManifest.ts'), 'utf8');
const files = [...new Set([...manifest.matchAll(/'(clawd-[^']+\.svg)'/g)].map((match) => match[1]))];
const output = process.argv[2] ?? 'docs/reports/clawd-production-visible-bounds-phase7.1.json';

function decodeRgbaPng(buffer) {
  let offset = 8; let width = 0; let height = 0; let colorType = 0; const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.toString('ascii', offset + 4, offset + 8); const data = buffer.subarray(offset + 8, offset + 8 + length); offset += 12 + length;
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'IDAT') chunks.push(data);
    if (type === 'IEND') break;
  }
  if (colorType !== 6) throw new Error(`Expected RGBA PNG, received color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(chunks)); const stride = width * 4; const pixels = Buffer.alloc(stride * height); let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++]; const row = pixels.subarray(y * stride, (y + 1) * stride); const prior = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source++]; const left = x >= 4 ? row[x - 4] : 0; const up = prior?.[x] ?? 0; const upperLeft = x >= 4 ? prior?.[x - 4] ?? 0 : 0;
      if (filter === 0) row[x] = value;
      else if (filter === 1) row[x] = (value + left) & 255;
      else if (filter === 2) row[x] = (value + up) & 255;
      else if (filter === 3) row[x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) { const p = left + up - upperLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upperLeft); row[x] = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 255; }
      else throw new Error(`Unsupported PNG filter ${filter}`);
    }
  }
  return { width, height, pixels };
}

function alphaBounds(png) {
  let left = png.width; let top = png.height; let right = -1; let bottom = -1;
  for (let y = 0; y < png.height; y += 1) for (let x = 0; x < png.width; x += 1) {
    if (png.pixels[(y * png.width + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, footBaseline: bottom };
}

const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 512, height: 512 } }); const audited = [];
for (const fileName of files) {
  const svg = await readFile(resolve(root, 'public/vendor/clawd-pet/pets', fileName), 'utf8');
  const header = svg.match(/<svg[^>]+>/)?.[0] ?? ''; const viewBox = header.match(/viewBox="([^"]+)"/)?.[1] ?? ''; const intrinsicWidth = Number(header.match(/width="([\d.]+)"/)?.[1] ?? 0); const intrinsicHeight = Number(header.match(/height="([\d.]+)"/)?.[1] ?? 0);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:500px;height:500px;object-fit:contain}</style><img src="${src}">`);
  await page.waitForFunction(() => document.querySelector('img')?.complete); const png = decodeRgbaPng(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 500, height: 500 } }));
  const bounds = alphaBounds(png); audited.push({ fileName, viewBox, intrinsicWidth, intrinsicHeight, rasterSize: 500, bounds, padding: { top: bounds.top, right: 499 - bounds.right, bottom: 499 - bounds.bottom, left: bounds.left }, visibleRatio: { width: Number((bounds.width / 500).toFixed(4)), height: Number((bounds.height / 500).toFixed(4)) } });
}
await browser.close(); await writeFile(resolve(root, output), `${JSON.stringify({ generatedBy: 'scripts/audit-clawd-visual-bounds.mjs', assets: audited }, null, 2)}\n`);
console.log(`Audited ${audited.length} production SVGs -> ${output}`);
