import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { deriveRuneWorldDaypart, resolveRuneWorldHotspots } from '@/features/home/runePixelWorld';
import './RunePixelWorld.css';

export function RunePixelWorld() {
  const navigate = useNavigate();
  const now = useNow('minute');
  const daypart = deriveRuneWorldDaypart(now);
  const hotspots = useMemo(resolveRuneWorldHotspots, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [artState, setArtState] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const assetBase = `${import.meta.env.BASE_URL}assets/home/rune-world`;
  const dayAsset = `${assetBase}/day.png`;
  const nightAsset = `${assetBase}/night.png`;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const probes: HTMLImageElement[] = [];

    void Promise.all([dayAsset, nightAsset].map(async (source) => {
      const response = await fetch(source, { method: 'HEAD', signal: controller.signal });
      return response.ok && response.headers.get('content-type')?.startsWith('image/');
    })).then((available) => {
      if (cancelled) return;
      if (!available.every(Boolean)) {
        setArtState('unavailable');
        return;
      }

      let loaded = 0;
      [dayAsset, nightAsset].forEach((source) => {
        const image = new Image();
        image.onload = () => {
          loaded += 1;
          if (!cancelled && loaded === 2) setArtState('available');
        };
        image.onerror = () => {
          if (!cancelled) setArtState('unavailable');
        };
        image.src = source;
        probes.push(image);
      });
    }).catch(() => {
      if (!cancelled) setArtState('unavailable');
    });

    return () => {
      cancelled = true;
      controller.abort();
      probes.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [dayAsset, nightAsset]);

  const artAvailable = artState === 'available';
  const handleRenderedArtError = () => setArtState('unavailable');

  return (
    <section
      className="rune-pixel-world"
      data-testid="rune-pixel-world"
      data-world-daypart={daypart}
      data-art-state={artState}
      aria-label="Rune 像素世界導航"
    >
      <div className="rune-pixel-world__viewport">
        {artAvailable ? (
          <>
            <div className="rune-pixel-world__art" aria-hidden="true">
              <img className="rune-pixel-world__map rune-pixel-world__map--day" src={dayAsset} alt="" draggable="false" onError={handleRenderedArtError} />
              <img className="rune-pixel-world__map rune-pixel-world__map--night" src={nightAsset} alt="" draggable="false" onError={handleRenderedArtError} />
              <span className="rune-pixel-world__ambient" />
            </div>
            <nav className="rune-pixel-world__hotspots" aria-label="Rune 世界地點">
              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  tabIndex={0}
                  className="rune-world-hotspot"
                  data-hotspot-id={hotspot.id}
                  data-module-id={hotspot.moduleId}
                  data-route={hotspot.route}
                  data-pet-safe-region="interactive"
                  data-active={activeId === hotspot.id}
                  onPointerEnter={(event) => { if (event.pointerType !== 'touch') setActiveId(hotspot.id); }}
                  onPointerLeave={() => setActiveId(null)}
                  onPointerDown={() => setActiveId(hotspot.id)}
                  onFocus={() => setActiveId(hotspot.id)}
                  onBlur={() => setActiveId(null)}
                  onKeyDown={(event) => { if (event.key === 'Escape') setActiveId(null); }}
                  style={{ '--hotspot-x': hotspot.x, '--hotspot-y': hotspot.y } as React.CSSProperties}
                  aria-label={`前往${hotspot.label}`}
                  onClick={() => navigate(hotspot.route)}
                >
                  <span className="rune-world-hotspot__core" aria-hidden="true" />
                  {activeId === hotspot.id && <span className="rune-world-hotspot__label" data-pet-safe-region="interactive">{hotspot.label}</span>}
                </button>
              ))}
            </nav>
          </>
        ) : (
          <div className="rune-pixel-world__resting-surface" aria-hidden="true">
            <span className="rune-pixel-world__resting-orbit" />
          </div>
        )}
      </div>
    </section>
  );
}
