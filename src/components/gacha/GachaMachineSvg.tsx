import { useMemo } from 'react';
import type { GachaMachineSkin, GachaDrawRecord } from '@/types';
import { gachaImagePlaceholderSVG } from '@/storage/gachaAssetStorage';

interface Props {
  skin: GachaMachineSkin;
  drawState: 'idle' | 'drawing' | 'result';
  capsuleImageUrl?: string | null;
  size?: 'mobile' | 'desktop';
}

const SKIN_COLORS: Record<GachaMachineSkin, {
  body: string;
  bodyDark: string;
  accent: string;
  dome: string;
  base: string;
}> = {
  'coral-cream': {
    body: '#f0a05e',
    bodyDark: '#bd5f5c',
    accent: '#cc785c',
    dome: 'rgba(180, 224, 235, 0.55)',
    base: '#e8d5c4',
  },
  'moonlight': {
    body: '#7b8faa',
    bodyDark: '#4a5d7c',
    accent: '#9bb5d4',
    dome: 'rgba(160, 180, 210, 0.5)',
    base: '#d0d8e4',
  },
  'teal-mint': {
    body: '#6db8a6',
    bodyDark: '#4a8a7c',
    accent: '#5db8a6',
    dome: 'rgba(160, 210, 200, 0.5)',
    base: '#c4e0d8',
  },
};

export function GachaMachineSvg({ skin, drawState, capsuleImageUrl, size = 'mobile' }: Props) {
  const colors = useMemo(() => SKIN_COLORS[skin] || SKIN_COLORS['coral-cream'], [skin]);
  const w = size === 'desktop' ? 240 : 180;
  const h = size === 'desktop' ? 260 : 200;

  const domeCenterY = h * 0.16;
  const domeRx = w * 0.22;
  const domeRy = h * 0.13;

  const bodyTop = h * 0.26;
  const bodyH = h * 0.3;
  const bodyW = w * 0.5;
  const bodyX = (w - bodyW) / 2;

  const baseTop = bodyTop + bodyH - 2;
  const baseH = h * 0.18;
  const baseW = bodyW + 20;
  const baseX = (w - baseW) / 2;

  const crankCx = w * 0.72;
  const crankCy = h * 0.38;
  const crankR = 10;

  const slotW = 24;
  const slotH = 10;
  const slotX = (w - slotW) / 2;
  const slotY = baseTop + baseH - 6;

  const capsuleRx = 10;
  const capsuleRy = 14;
  const capsules = [
    { cx: bodyX + 14, cy: domeCenterY + domeRy + 8 },
    { cx: w / 2 - 6, cy: domeCenterY + domeRy + 4 },
    { cx: w / 2 + 14, cy: domeCenterY + domeRy + 10 },
    { cx: bodyX + bodyW - 14, cy: domeCenterY + domeRy + 6 },
  ];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size === 'desktop' ? 240 : 180}
      height={size === 'desktop' ? 260 : 200}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <defs>
        <clipPath id="gc-dome-clip">
          <ellipse cx={w / 2} cy={domeCenterY} rx={domeRx} ry={domeRy} />
        </clipPath>
        <linearGradient id="gc-dome-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.dome} />
          <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
        </linearGradient>
        <linearGradient id="gc-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.body} />
          <stop offset="100%" stopColor={colors.bodyDark} />
        </linearGradient>
        <filter id="gc-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Base platform */}
      <rect
        x={baseX}
        y={baseTop}
        width={baseW}
        height={baseH}
        rx={6}
        fill={colors.base}
        stroke={colors.bodyDark}
        strokeWidth="1.5"
        filter="url(#gc-shadow)"
      />
      <rect
        x={baseX + 6}
        y={baseTop + 4}
        width={baseW - 12}
        height={baseH - 8}
        rx={4}
        fill="rgba(255,255,255,0.2)"
      />

      {/* Slanted front panel on base */}
      <path
        d={`M${baseX + 4} ${baseTop + 4} L${baseX + 16} ${baseTop + baseH - 4} L${baseX + baseW - 16} ${baseTop + baseH - 4} L${baseX + baseW - 4} ${baseTop + 4} Z`}
        fill="rgba(255,255,255,0.1)"
      />

      {/* Main body */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        rx={8}
        fill="url(#gc-body-grad)"
        stroke={colors.bodyDark}
        strokeWidth="1.5"
      />

      {/* Body stripe */}
      <rect
        x={bodyX + 8}
        y={bodyTop + 8}
        width={bodyW - 16}
        height={2}
        rx={1}
        fill="rgba(255,255,255,0.2)"
      />

      {/* Body front highlight */}
      <rect
        x={bodyX + 8}
        y={bodyTop + 16}
        width={bodyW - 16}
        height={bodyH - 24}
        rx={6}
        fill="rgba(255,255,255,0.06)"
      />

      {/* Dome (transparent top) */}
      <ellipse
        cx={w / 2}
        cy={domeCenterY}
        rx={domeRx}
        ry={domeRy}
        fill="url(#gc-dome-grad)"
        stroke={colors.bodyDark}
        strokeWidth="1.5"
      />

      {/* Dome shine */}
      <ellipse
        cx={w / 2 - domeRx * 0.3}
        cy={domeCenterY - domeRy * 0.35}
        rx={domeRx * 0.18}
        ry={domeRy * 0.15}
        fill="rgba(255,255,255,0.5)"
      />

      {/* Capsules inside dome */}
      <g clipPath="url(#gc-dome-clip)" className={drawState === 'drawing' ? 'gc-machine-capsule' : ''}>
        {capsules.map((c, i) => (
          <g key={i}>
            <ellipse
              cx={c.cx}
              cy={c.cy}
              rx={capsuleRx * (0.7 + Math.sin(i * 1.3) * 0.3)}
              ry={capsuleRy * (0.7 + Math.cos(i * 1.7) * 0.3)}
              fill={`hsla(${30 + i * 40}, 60%, 70%, 0.5)`}
              stroke={`hsla(${30 + i * 40}, 40%, 55%, 0.6)`}
              strokeWidth="1"
            />
          </g>
        ))}
      </g>

      {/* Crank (circle + arm) */}
      <g className={drawState === 'drawing' ? 'gc-machine-crank' : ''}>
        <circle
          cx={crankCx}
          cy={crankCy}
          r={crankR}
          fill={colors.accent}
          stroke={colors.bodyDark}
          strokeWidth="1.5"
        />
        <circle
          cx={crankCx}
          cy={crankCy}
          r={crankR * 0.4}
          fill="rgba(255,255,255,0.3)"
        />
        <line
          x1={crankCx}
          y1={crankCy - crankR}
          x2={crankCx}
          y2={crankCy - crankR - 8}
          stroke={colors.bodyDark}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* Dispense slot */}
      <rect
        x={slotX}
        y={slotY}
        width={slotW}
        height={slotH}
        rx={3}
        fill="#2a1723"
        stroke={colors.bodyDark}
        strokeWidth="1"
        className={drawState === 'result' ? 'gc-machine-slot-el' : ''}
      />
      <rect
        x={slotX + 3}
        y={slotY + 2}
        width={slotW - 6}
        height={3}
        rx={1}
        fill="rgba(255,255,255,0.1)"
      />

      {/* Capsule at slot (result state) */}
      {drawState === 'result' && capsuleImageUrl && (
        <g>
          <rect
            x={slotX - 4}
            y={slotY - 18}
            width={slotW + 8}
            height={18}
            rx={9}
            fill={colors.accent}
            stroke={colors.bodyDark}
            strokeWidth="1"
          />
          <image
            href={capsuleImageUrl}
            x={slotX - 2}
            y={slotY - 16}
            width={slotW + 4}
            height={14}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#gc-output-clip)"
          />
          <clipPath id="gc-output-clip">
            <rect x={slotX - 4} y={slotY - 18} width={slotW + 8} height={18} rx={9} />
          </clipPath>
        </g>
      )}

      {/* Decorative dots */}
      <circle cx={bodyX + 6} cy={slotY - 22} r="2" fill={colors.accent} opacity="0.6" />
      <circle cx={bodyX + bodyW - 6} cy={slotY - 22} r="2" fill={colors.accent} opacity="0.6" />
    </svg>
  );
}

export function gachaResultPlaceholderImage(record: GachaDrawRecord): string {
  if (record.imageAssetIdSnapshot) {
    const hue = (record.titleSnapshot.length * 37) % 360;
    return gachaImagePlaceholderSVG(hue);
  }
  const hue = (record.titleSnapshot.length * 37) % 360;
  return gachaImagePlaceholderSVG(hue);
}
