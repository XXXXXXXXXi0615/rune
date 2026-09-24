import {
  leftHalfPath,
  rightHalfPath,
  NODE_LEFT,
  NODE_RIGHT,
  VOID_PATH,
  R_EMBLEM,
} from './lunartide-mark-paths';

interface LunartideEmblemProps {
  size?: number;
  className?: string;
}

export function LunartideEmblem({ size = 120, className }: LunartideEmblemProps) {
  const l = leftHalfPath(R_EMBLEM);
  const r = rightHalfPath(R_EMBLEM);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="Lunartide 月潮"
    >
      <circle cx="50" cy="50" r="46" stroke="var(--amber, #e8a55a)" strokeWidth=".5" strokeDasharray="3 4" opacity=".35" />
      <path d={l} fill="var(--amber, #e8a55a)" />
      <path d={r} fill="var(--teal, #5db8a6)" />
      <circle cx={NODE_LEFT.cx - 1} cy={NODE_LEFT.cy - 1} r={NODE_LEFT.r - 0.5} fill="var(--amber, #e8a55a)" opacity=".92" />
      <circle cx={NODE_RIGHT.cx + 1} cy={NODE_RIGHT.cy + 1} r={NODE_RIGHT.r - 0.5} fill="var(--teal, #5db8a6)" opacity=".92" />
      <path d={VOID_PATH} fill="var(--bg, #f2ede4)" />
      <circle cx="21" cy="18" r="1.4" fill="var(--amber, #e8a55a)" opacity=".5" />
      <circle cx="34" cy="11" r="1" fill="var(--amber, #e8a55a)" opacity=".35" />
      <circle cx="66" cy="11" r="1" fill="var(--teal, #5db8a6)" opacity=".35" />
      <circle cx="79" cy="18" r="1.4" fill="var(--teal, #5db8a6)" opacity=".5" />
      <circle cx="12" cy="70" r=".9" fill="var(--amber, #e8a55a)" opacity=".3" />
      <circle cx="88" cy="70" r=".9" fill="var(--teal, #5db8a6)" opacity=".3" />
      <path d="M22 83C30 79 42 79 50 83S70 83 78 83" stroke="var(--amber, #e8a55a)" strokeWidth=".8" strokeLinecap="round" opacity=".4" />
      <path d="M25 87C33 84 42 84 50 87S67 84 75 87" stroke="var(--teal, #5db8a6)" strokeWidth=".6" strokeLinecap="round" opacity=".3" />
    </svg>
  );
}
