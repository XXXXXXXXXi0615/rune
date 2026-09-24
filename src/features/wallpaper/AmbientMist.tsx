import { useEffect, useState } from 'react';

export function AmbientMist() {
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return <div className="ambient-mist" data-testid="ambient-mist" data-paused={paused ? 'true' : 'false'} aria-hidden="true">
    <span className="ambient-mist__field ambient-mist__field--pearl" />
    <span className="ambient-mist__field ambient-mist__field--ice" />
    <span className="ambient-mist__field ambient-mist__field--blush" />
  </div>;
}
