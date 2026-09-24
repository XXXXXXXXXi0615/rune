/**
 * Sleep Receipt System — Type Definitions & Utility Functions
 * Produces the sleep domain's receipt summary.
 */
import type { SleepRecord, SleepQuality } from '@/utils/sleepStorage';

// ── Font stacks — mirrors app CSS token system for standalone HTML exports ──
const DISPLAY_FONT = `"Tiempos Headline", "Cormorant Garamond", EB Garamond, Garamond, serif`;
const BODY_FONT = `"StyreneB", Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
const MONO_FONT = `Inter, sans-serif`;

export interface SleepReceipt {
  id: string;
  type: 'sleep_receipt';
  date: string;
  totalSleep: number;
  remMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  awakeMinutes: number;
  sleepScore: number;
  lunarisComment: string;
  memoryEntryId?: string;
  savedToSecondBrainAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Compute a 0-100 sleep quality score based on sleep stages and duration.
 * - Deep ratio (deep/totalSleep): 40%
 * - REM ratio (rem/totalSleep): 25%
 * - Duration vs 8h target: 25%
 * - Awake ratio (awake/totalSleep): 10% (inverted)
 */
export function computeSleepScore(
  totalSleep: number,
  deepMinutes: number,
  remMinutes: number,
  awakeMinutes: number,
): number {
  if (totalSleep <= 0) return 0;

  const deepRatio = deepMinutes / totalSleep;
  const remRatio = remMinutes / totalSleep;
  const awakeRatio = awakeMinutes / totalSleep;
  const durationRatio = Math.min(totalSleep / 480, 1); // target 8h

  const deepScore = Math.min(deepRatio / 0.20, 1) * 40;       // 20%+ deep is excellent
  const remScore = Math.min(remRatio / 0.25, 1) * 25;          // 25%+ REM is excellent
  const durationScore = durationRatio * 25;                     // 8h+ full points
  const awakePenalty = Math.min(awakeRatio / 0.15, 1) * 10;    // >15% awake is full penalty
  const awakeScore = 10 - awakePenalty;

  return Math.max(0, Math.min(100, Math.round(deepScore + remScore + durationScore + awakeScore)));
}

export function sleepScoreLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  if (score >= 40) return 'Low';
  return 'Minimal';
}

export function computeLunarisComment(
  totalSleep: number,
  deepMinutes: number,
  remMinutes: number,
  awakeMinutes: number,
): string {
  const deepRatio = totalSleep > 0 ? deepMinutes / totalSleep : 0;
  const awakeRatio = totalSleep > 0 ? awakeMinutes / totalSleep : 0;

  if (deepRatio >= 0.18) return '深睡時間充足，身體修復得非常好。今晚的潮位很穩定。';
  if (deepRatio < 0.10) return '深睡偏少，今晚讓自己早點放鬆，身體會更深入修復。';
  if (totalSleep >= 480) return '時長非常充實，醒來應該會很有精神。月潮為你的睡眠悄悄留燈。';
  if (totalSleep >= 420 && deepRatio >= 0.14 && remMinutes >= 80)
    return 'REM 與深睡比例均衡，這是一晚優質的睡眠。';
  if (totalSleep < 300) return '睡眠時長偏短，今晚試著早一小時躺下，讓身體有更多時間重組。';
  if (awakeRatio > 0.12) return '夜間清醒時間偏多，可能有淺睡或頻繁醒來的情況。放鬆呼吸會有幫助。';
  if (remMinutes < 60) return 'REM 時間偏短，REM 對情緒調節很重要。今晚試著讓臥室更暗、更安靜。';
  return '今天的睡眠已經記錄在月潮裡了。';
}

export function sleepReceiptMemoryBody(receipt: SleepReceipt): string {
  const h = Math.floor(receipt.totalSleep / 60);
  const m = receipt.totalSleep % 60;
  return [
    `${receipt.date} Sleep Receipt`,
    `總睡眠: ${h}h${m > 0 ? m + 'm' : ''}`,
    `深睡: ${receipt.deepMinutes}m · REM: ${receipt.remMinutes}m · 核心: ${receipt.coreMinutes}m · 清醒: ${receipt.awakeMinutes}m`,
    `睡眠分數: ${receipt.sleepScore}/100 (${sleepScoreLabel(receipt.sleepScore)})`,
    '',
    receipt.lunarisComment,
  ].join('\n');
}

// ── PNG / PDF Export ──

export function buildSleepReceiptHTML(receipt: SleepReceipt): string {
  const h = Math.floor(receipt.totalSleep / 60);
  const m = receipt.totalSleep % 60;
  const label = sleepScoreLabel(receipt.sleepScore);
  const scoreColor = receipt.sleepScore >= 80 ? '#5db872' : receipt.sleepScore >= 60 ? '#6f9fe8' : receipt.sleepScore >= 40 ? '#b9a7e8' : '#c64545';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sleep Receipt — ${receipt.date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${BODY_FONT};
    background: #faf9f5;
    display: flex;
    justify-content: center;
    padding: 32px 16px;
    color: #141413;
  }
  .receipt {
    width: 420px;
    max-width: 100%;
    background: #fffef8;
    border: 1px solid #e6dfd8;
    border-radius: 16px;
    padding: 32px 28px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    background-image: radial-gradient(circle at 100% 0%, rgba(185,167,232,0.06), transparent 50%);
  }
  .receipt-kicker {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8e8b82;
  }
  .receipt h1 {
    font-family: ${DISPLAY_FONT};
    font-size: 26px;
    font-weight: 400;
    letter-spacing: -0.5px;
    color: #141413;
    margin: 6px 0 20px;
  }
  .receipt-divider {
    border: none;
    border-top: 1.5px dashed #e6dfd8;
    margin: 20px 0;
  }
  .receipt-score-ring {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 20px 0;
  }
  .receipt-score-num {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: ${DISPLAY_FONT};
    font-size: 28px;
    font-weight: 400;
    color: ${scoreColor};
    border: 2.5px solid ${scoreColor};
  }
  .receipt-score-num small {
    font-family: ${BODY_FONT};
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8e8b82;
  }
  .receipt-score-label {
    font-size: 12px;
    color: #6c6a64;
    line-height: 1.5;
  }
  .receipt-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .receipt-stat {
    background: #f5f0e8;
    border-radius: 12px;
    padding: 14px;
    text-align: center;
  }
  .receipt-stat span {
    display: block;
    font-size: 10px;
    color: #8e8b82;
    margin-bottom: 4px;
  }
  .receipt-stat strong {
    font-family: ${DISPLAY_FONT};
    font-size: 22px;
    font-weight: 400;
    color: #252523;
  }
  .receipt-stat small {
    font-size: 10px;
    color: #8e8b82;
    margin-left: 2px;
  }
  .receipt-comment {
    margin-top: 20px;
    padding: 14px 16px;
    background: rgba(185,167,232,0.08);
    border-left: 3px solid #b9a7e8;
    border-radius: 0 8px 8px 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: #3d3d3a;
  }
  .receipt-barcode {
    display: flex;
    justify-content: center;
    gap: 2px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e6dfd8;
  }
  .receipt-barcode span {
    width: 3px;
    height: 22px;
    background: #141413;
    border-radius: 1px;
  }
  .receipt-barcode span:nth-child(even) { height: 16px; opacity: 0.5; }
  .receipt-footer {
    text-align: center;
    font-size: 10px;
    color: #8e8b82;
    margin-top: 12px;
    letter-spacing: 0.06em;
  }
  @media print {
    body { background: #fff; }
    .receipt { box-shadow: none; border: none; width: 100%; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="receipt-kicker">SLEEP RECEIPT</div>
  <h1>${receipt.date}</h1>
  <hr class="receipt-divider" />

  <div class="receipt-score-ring">
    <div class="receipt-score-num">
      ${receipt.sleepScore}<small>score</small>
    </div>
    <div class="receipt-score-label">
      ${label}<br />
      總睡眠 ${h}h${m > 0 ? m + 'm' : ''}
    </div>
  </div>

  <div class="receipt-stats">
    <div class="receipt-stat">
      <span>深睡 / Deep</span>
      <strong>${receipt.deepMinutes}</strong><small>m</small>
    </div>
    <div class="receipt-stat">
      <span>REM</span>
      <strong>${receipt.remMinutes}</strong><small>m</small>
    </div>
    <div class="receipt-stat">
      <span>核心 / Core</span>
      <strong>${receipt.coreMinutes}</strong><small>m</small>
    </div>
    <div class="receipt-stat">
      <span>清醒 / Awake</span>
      <strong>${receipt.awakeMinutes}</strong><small>m</small>
    </div>
  </div>

  <div class="receipt-comment">${receipt.lunarisComment}</div>

  <div class="receipt-barcode">
    ${Array.from({ length: 22 }, (_, i) => `<span></span>`).join('')}
  </div>
  <div class="receipt-footer">謝謝你記錄今晚的自己 · THANK YOU FOR CARING FOR YOUR SLEEP</div>
</div>
</body>
</html>`;
}

export async function exportSleepReceiptPNG(receipt: SleepReceipt): Promise<void> {
  const html = buildSleepReceiptHTML(receipt);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '440px';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for fonts to settle
  await new Promise((resolve) => setTimeout(resolve, 400));

  try {
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="${container.offsetHeight || 900}">
      <foreignObject width="440" height="${container.offsetHeight || 900}">
        <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
      </foreignObject>
    </svg>`;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG image load failed'));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = 440 * scale;
    canvas.height = (container.offsetHeight || 900) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    ctx.fillStyle = '#fffef8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, 440, container.offsetHeight || 900);
    URL.revokeObjectURL(url);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
    if (!pngBlob) throw new Error('PNG blob generation failed');

    const downloadUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `sleep-receipt-${receipt.date}.png`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    document.body.removeChild(container);
  }
}

export function exportSleepReceiptPDF(receipt: SleepReceipt): void {
  const html = buildSleepReceiptHTML(receipt);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

export function shareSleepReceipt(receipt: SleepReceipt): void {
  const h = Math.floor(receipt.totalSleep / 60);
  const m = receipt.totalSleep % 60;
  const text = `MoonSleep ${receipt.date}\n${h}h${m > 0 ? m + 'm' : ''} · Score ${receipt.sleepScore}/100\n深睡 ${receipt.deepMinutes}m · REM ${receipt.remMinutes}m\n${receipt.lunarisComment}`;
  if (navigator.share) {
    navigator.share({ title: `Sleep Receipt ${receipt.date}`, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
