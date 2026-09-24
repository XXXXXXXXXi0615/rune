import { Navigate, useLocation } from 'react-router-dom';

/** Legacy MoonHealth deep-link compatibility shim.
 *  MoonHealth content now lives inside the Calendar Health Hub
 *  (/calendar?view=overview|schedule|cycle|body). */
export function HealthHubRedirect() {
  const { pathname } = useLocation();
  const mapped: Record<string, string> = {
    '/health': '/calendar?view=overview',
    '/health/body': '/calendar?view=body',
    '/health/period': '/calendar?action=period',
    '/health/cycle': '/calendar?action=period',
    '/health/diet': '/calendar',
  };
  const target = mapped[pathname] ?? '/calendar?view=overview';
  return <Navigate to={target} replace />;
}
