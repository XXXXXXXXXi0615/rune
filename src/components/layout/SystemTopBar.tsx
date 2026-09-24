import { ThemeToggle } from '@/components/home/ThemeToggle';
import { RouteStatusIsland } from '@/components/layout/RouteStatusIsland';
import { UsageHost } from '@/components/usage/UsageHost';

/**
 * System top bar — Phase D.1 composition closure.
 *
 * Exactly three visual groups:
 *   [Rune avatar: identity] [Utility Island: today state] [Theme Toggle: appearance]
 *
 * The wide Rune wordmark capsule was retired here (Rune identity stays as the
 * compact avatar anchor; the Rune wordmark component itself is untouched and
 * still used by login/Settings branding). The Utility Island owns the primary
 * capsule and the freed horizontal space.
 *
 * The bar is a container so the utility capsule can contract its copy against
 * the FRAME width — the app shell is a max-430px frame at every outer viewport,
 * so outer-viewport media queries are not a valid sizing input here.
 */
export function SystemTopBar() {
  return (
    <header className="system-top-bar">
      <RouteStatusIsland />
      <div className="stb-utility">
        <UsageHost />
      </div>
      <div className="stb-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
