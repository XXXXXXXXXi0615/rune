import { type ReactNode, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn btn-danger',
  icon: 'btn-icon',
};

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClass[variant]} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
