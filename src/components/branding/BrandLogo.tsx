import type { ImgHTMLAttributes } from 'react';

const SIZE_MAP: Record<string, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const VARIANT_SRC: Record<string, string> = {
  primary: `${import.meta.env.BASE_URL}branding/lunartide-logo-primary.png`,
  small: `${import.meta.env.BASE_URL}branding/lunartide-logo-mark-small.png`,
};

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> {
  variant?: 'primary' | 'small';
  size?: 'sm' | 'md' | 'lg' | number;
  decorative?: boolean;
}

export function BrandLogo({
  variant = 'primary',
  size = 'md',
  decorative = false,
  className,
  style,
  ...rest
}: BrandLogoProps) {
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 48);

  return (
    <img
      src={VARIANT_SRC[variant]}
      alt={decorative ? '' : 'Lunartide 月潮'}
      width={px}
      height={px}
      className={className}
      role={decorative ? 'presentation' : 'img'}
      loading="eager"
      style={{ objectFit: 'contain', ...style }}
      {...rest}
    />
  );
}
