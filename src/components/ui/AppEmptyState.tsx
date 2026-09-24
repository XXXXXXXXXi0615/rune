import type { ReactNode } from 'react';
import { AppCard } from '@/components/ui/AppPrimitives';

export function AppEmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <AppCard className="app-empty-state">
      {icon && <div className="app-empty-state__icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </AppCard>
  );
}
