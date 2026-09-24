import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: string;
  description?: string;
  backLabel?: string;
  reloadLabel?: string;
}

export function PlayroomRouteErrorBoundary({ children, fallback, description, backLabel, reloadLabel }: Props) {
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate('/'), [navigate]);
  const reload = useCallback(() => window.location.reload(), []);

  return (
    <ErrorBoundary
      fallback={fallback}
      description={description}
      onBack={goHome}
      onReload={reload}
      backLabel={backLabel}
      secondaryLabel={reloadLabel}
      onSecondary={reload}
    >
      {children}
    </ErrorBoundary>
  );
}
