import { LunartideEmblem } from './LunartideEmblem';
import { LunartideMark } from './LunartideMark';
import { LunartideMarkAnimated } from './LunartideMarkAnimated';

interface LunartideLogoProps {
  variant?: 'primary' | 'ui' | 'animated';
  state?: 'idle' | 'thinking';
  size?: number;
  className?: string;
  decorative?: boolean;
  'aria-label'?: string;
}

export function LunartideLogo({
  variant = 'ui',
  state = 'idle',
  size,
  className,
  decorative,
  'aria-label': ariaLabel,
}: LunartideLogoProps) {
  if (variant === 'animated' || state === 'thinking') {
    return <LunartideMarkAnimated size={size} className={className} active={state === 'thinking'} decorative={decorative} ariaLabel={ariaLabel} />;
  }
  if (variant === 'primary') {
    return <LunartideEmblem size={size} className={className} />;
  }
  return <LunartideMark size={size} className={className} decorative={decorative} ariaLabel={ariaLabel} />;
}
