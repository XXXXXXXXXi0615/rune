import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}

export function Card({ children, glow = false, className }: CardProps) {
  return (
    <div className={`card ${glow ? 'card-glow' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}
