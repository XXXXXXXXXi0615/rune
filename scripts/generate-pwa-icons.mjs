/**
 * Generate PWA icon PNGs from the Lunartide brand mark SVG.
 *
 * Uses Playwright's headless Chromium to render an SVG page
 * and capture pixel-perfect screenshots at the required sizes.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'icons');

// ── Brand Mark SVG (compact 64×64, twin-tide interlocking) ──
const BRAND_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <path d="M31.5 8C18 8 9 17.6 9 31.5S18 55 31.5 55c6.3 0 11-2.4 14.5-6.7-7.5 1.7-14.9-1.6-18.7-7.8-3.9-6.4-2.1-14.7 4.1-19 4.6-3 10.3-3.2 15-1-3.6-7.8-8.6-12.5-14.9-12.5Z" fill="#e8a55a" opacity=".12"/>
  <path d="M32.5 56C46 56 55 46.4 55 32.5S46 9 32.5 9C26.2 9 21.5 11.4 18 15.7c7.5-1.7 14.9 1.6 18.7 7.8 3.9 6.4 2.1 14.7-4.1 19-4.6 3-10.3 3.2-15 1 3.6 7.8 8.6 12.5 14.9 12.5Z" fill="#5db8a6" opacity=".12"/>
  <path d="M31.5 8C18 8 9 17.6 9 31.5S18 55 31.5 55c6.3 0 11-2.4 14.5-6.7" fill="none" stroke="#e8a55a" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M32.5 56C46 56 55 46.4 55 32.5S46 9 32.5 9C26.2 9 21.5 11.4 18 15.7" fill="none" stroke="#5db8a6" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M46.4 20.5c-6.7-2.2-13.4.2-17.2 6.3-3.9 6.2-1.7 14.4 4.6 18.1" fill="none" stroke="#e8a55a" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M17.6 43.5c6.7 2.2 13.4-.2 17.2-6.3 3.9-6.2 1.7-14.4-4.6-18.1" fill="none" stroke="#5db8a6" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M34.2 18.1c-8.4 2.8-12.2 12.9-8.3 20.8 3.8 7.8 13 11.4 20.8 7.7-5.9 6.2-15.9 6.5-22.4.9-7.8-6.7-8.8-18.4-2.1-26.2 3.2-3.7 7.5-5.4 12-3.2Z" fill="#f2ede4"/>
  <circle cx="17.5" cy="25" r="3.1" fill="#f2ede4" stroke="#e8a55a" stroke-width="1.8"/>
  <circle cx="46.5" cy="39" r="3.1" fill="#f2ede4" stroke="#5db8a6" stroke-width="1.8"/>
</svg>`;

/**
 * Build a minimal HTML page with the brand mark centered.
 * @param {number} sizePct  - percentage of viewport the mark fills (default 68)
 * @param {string} bg       - background colour
 */
function htmlPage(sizePct = 68, bg = '#181715') {
  return `<!DOCTYPE html>
<html><head><style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:100vw; height:100vh;
  display:flex; align-items:center; justify-content:center;
  background:${bg}; overflow:hidden;
}
.mark {
  width:${sizePct}%; height:${sizePct}%;
  display:flex; align-items:center; justify-content:center;
}
.mark svg { display:block; }
</style></head><body>
<div class="mark">${BRAND_MARK}</div>
</body></html>`;
}

async function generateIcon(browser, size, filename, sizePct = 68, bg = '#181715') {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  try {
    await page.setContent(htmlPage(sizePct, bg), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const filePath = path.join(OUT_DIR, filename);
    await page.screenshot({
      path: filePath,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`  ✓ ${filename} (${size}×${size})`);
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Launching headless Chromium...');
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('Generating PWA icons:\n');

    // Standard: brand mark fills ~68% of the canvas → sharp, centered
    await generateIcon(browser, 192, 'icon-192.png', 68);
    await generateIcon(browser, 512, 'icon-512.png', 68);

    // Maskable: brand kept within inner ~80% safe zone → smaller fill (56%)
    await generateIcon(browser, 192, 'icon-192-maskable.png', 56);
    await generateIcon(browser, 512, 'icon-512-maskable.png', 56);

    // Apple touch icon (180×180, same as standard 68% fill)
    await generateIcon(browser, 180, 'icon-180.png', 68);

    console.log('\n✓ All icons generated in public/icons/');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
