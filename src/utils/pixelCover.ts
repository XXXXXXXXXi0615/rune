const coverCache = new Map<string, string>();

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seeded(hash: number, index: number): number {
  return (((hash * (index + 1) * 2654435761) >>> 0) / 4294967296);
}

export function generatePixelCover(name: string, size = 48): string {
  const cacheKey = `${name}:${size}`;
  const cached = coverCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return '';

  const hash = hashString(name || 'Lunartide');
  const style = hash % 4;
  const seed = (index: number) => seeded(hash, index);

  if (style === 0) {
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, `hsl(${238 + seed(1) * 20}, 42%, ${18 + seed(2) * 12}%)`);
    gradient.addColorStop(1, `hsl(${266 + seed(3) * 18}, 38%, ${26 + seed(4) * 10}%)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 9; i += 1) {
      context.fillStyle = `rgba(255,255,255,${0.35 + seed(10 + i) * 0.55})`;
      context.fillRect(Math.floor(seed(20 + i) * size), Math.floor(seed(30 + i) * size * 0.54), 2, 2);
    }
    context.fillStyle = '#f7e8c5';
    context.beginPath();
    context.arc(size * 0.68, size * 0.24, size * 0.15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `hsl(${238 + seed(1) * 20}, 42%, ${18 + seed(2) * 12}%)`;
    context.beginPath();
    context.arc(size * 0.74, size * 0.2, size * 0.13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `hsl(${252 + seed(5) * 16}, 26%, 16%)`;
    context.beginPath();
    context.moveTo(0, size);
    for (let x = 0; x <= size; x += 4) {
      context.lineTo(x, size - size * (0.25 + seed(40 + x) * 0.36));
    }
    context.lineTo(size, size);
    context.closePath();
    context.fill();
  } else if (style === 1) {
    const sky = context.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, `hsl(${18 + seed(1) * 16}, 62%, ${55 + seed(2) * 12}%)`);
    sky.addColorStop(1, `hsl(${318 + seed(3) * 16}, 46%, ${62 + seed(4) * 10}%)`);
    context.fillStyle = sky;
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#ffe0a8';
    context.beginPath();
    context.arc(size * 0.74, size * 0.28, size * 0.12, 0, Math.PI * 2);
    context.fill();
    const water = context.createLinearGradient(0, size * 0.52, 0, size);
    water.addColorStop(0, `hsl(${185 + seed(5) * 18}, 42%, 40%)`);
    water.addColorStop(1, `hsl(${202 + seed(6) * 12}, 46%, 22%)`);
    context.fillStyle = water;
    context.fillRect(0, size * 0.54, size, size * 0.46);
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let y = Math.floor(size * 0.62); y < size; y += 7) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size, y + (seed(y) - 0.5) * 3);
      context.stroke();
    }
  } else if (style === 2) {
    context.fillStyle = `hsl(${275 + seed(1) * 24}, 32%, 22%)`;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 12; i += 1) {
      context.fillStyle = `hsla(${310 + seed(i) * 40}, 65%, ${52 + seed(i + 20) * 18}%, 0.82)`;
      const x = Math.floor(seed(30 + i) * size);
      const y = Math.floor(seed(50 + i) * size);
      const w = 4 + Math.floor(seed(70 + i) * 12);
      const h = 4 + Math.floor(seed(90 + i) * 12);
      context.fillRect(x, y, w, h);
    }
    context.fillStyle = 'rgba(255,255,255,0.16)';
    context.fillRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
  } else {
    const gradient = context.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.7);
    gradient.addColorStop(0, '#f9d9e6');
    gradient.addColorStop(0.55, '#caa7ff');
    gradient.addColorStop(1, '#34315f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = 'rgba(255,255,255,0.24)';
    context.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      context.beginPath();
      context.arc(size / 2, size / 2, size * (0.12 + i * 0.08), 0, Math.PI * 2);
      context.stroke();
    }
  }

  const url = canvas.toDataURL('image/png');
  coverCache.set(cacheKey, url);
  return url;
}
