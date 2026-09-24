import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MoonReadBlock } from './contentModel';

function blockNode(block: MoonReadBlock): HTMLElement {
  if (block.type === 'image') {
    const figure = document.createElement('figure'); figure.className = 'moonread-image-page';
    const image = document.createElement('img'); image.src = block.src; image.alt = block.alt;
    const caption = document.createElement('figcaption'); caption.textContent = block.alt;
    figure.append(image, caption); return figure;
  }
  const node = document.createElement(block.type === 'heading' ? 'h2' : 'p');
  node.textContent = block.text; return node;
}

function fits(element: HTMLElement) { return element.scrollHeight <= element.clientHeight + 1; }

function splitTextToFit(measurer: HTMLElement, block: Extract<MoonReadBlock, { type: 'paragraph' }>) {
  let low = 1; let high = block.text.length; let best = 0;
  const probe = blockNode(block);
  measurer.append(probe);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    probe.textContent = block.text.slice(0, middle);
    if (fits(measurer)) { best = middle; low = middle + 1; } else high = middle - 1;
  }
  probe.remove();
  if (!best) return null;
  const boundary = Math.max(best > 20 ? Math.max(block.text.lastIndexOf('。', best), block.text.lastIndexOf('，', best), block.text.lastIndexOf(' ', best)) + 1 : 0, best - 12);
  const cut = boundary > 0 ? boundary : best;
  return [
    { ...block, text: block.text.slice(0, cut), stableBlockId: `${block.stableBlockId}:0` },
    { ...block, text: block.text.slice(cut), stableBlockId: `${block.stableBlockId}:${cut}` },
  ] as const;
}

async function waitForImages(element: HTMLElement) {
  await Promise.all(Array.from(element.querySelectorAll('img')).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); })));
}

export async function measureMoonReadPages(blocks: MoonReadBlock[], measurer: HTMLElement): Promise<MoonReadBlock[][]> {
  await document.fonts?.ready;
  await waitForImages(measurer);
  const queue = [...blocks]; const pages: MoonReadBlock[][] = []; let page: MoonReadBlock[] = [];
  measurer.replaceChildren();
  while (queue.length) {
    const block = queue.shift()!;
    const node = blockNode(block); measurer.append(node);
    if (fits(measurer)) {
      if (block.type === 'heading' && queue[0]?.type === 'paragraph') {
        const preview = blockNode({ ...queue[0], text: queue[0].text.slice(0, 40) }); measurer.append(preview);
        const keepHeading = fits(measurer); preview.remove();
        if (!keepHeading && page.length) { node.remove(); pages.push(page); page = []; measurer.replaceChildren(); queue.unshift(block); continue; }
      }
      page.push(block); continue;
    }
    node.remove();
    if (block.type === 'paragraph') {
      const split = splitTextToFit(measurer, block);
      if (split) { const [head, tail] = split; measurer.append(blockNode(head)); page.push(head); pages.push(page); page = []; measurer.replaceChildren(); if (tail.text) queue.unshift(tail); continue; }
    }
    if (page.length) { pages.push(page); page = []; measurer.replaceChildren(); queue.unshift(block); continue; }
    // An intrinsically oversized image becomes a single contained page, never silently clipped.
    page.push(block); pages.push(page); page = []; measurer.replaceChildren();
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export function useMeasuredPagination(blocks: MoonReadBlock[], fontSize: number, mobile: boolean) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<MoonReadBlock[][]>([[]]);
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    const target = measureRef.current;
    if (!target) return;
    const observer = new ResizeObserver(() => setRevision((value) => value + 1));
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const target = measureRef.current; if (!target) return;
    let cancelled = false;
    measureMoonReadPages(blocks, target).then((next) => { if (!cancelled) setPages(next); });
    return () => { cancelled = true; };
  }, [blocks, fontSize, mobile, revision]);
  return { pages, measureRef };
}
