import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { deriveRuneWorldDaypart, resolveRuneWorldHotspots } from '@/features/home/runePixelWorld';
import { RUNE_WORLD_ACTOR } from '@/features/home/runeWorldActor';
import { subscribeDailyCheckInCompleted } from '@/features/tideclock/dailyCheckInEvents';
import { RuneWorldActorRuntime, createRuneWanderSeededRandom, type RuneActorSnapshot, type RuneFacing, type RuneMovementCommandSnapshot, type RuneWanderSnapshot } from '@/features/home/runeWorldActorRuntime';
import './RunePixelWorld.css';

interface RuneActorTestHarness {
  setMovement: (deltaX: number, deltaY: number) => void;
  stop: () => void;
  step: (deltaMs: number) => void;
  getSnapshot: () => RuneActorSnapshot;
  startWander: (nowMs: number) => void;
  advanceWander: (nowMs: number) => void;
  getWanderSnapshot: () => RuneWanderSnapshot;
  getMovementCommandSnapshot: () => RuneMovementCommandSnapshot;
  requestWave: (nowMs: number) => void;
  getReaction: () => { reaction: RuneActorSnapshot['reaction']; reactionFrame: number; pending: boolean };
}

export function RunePixelWorld() {
  const navigate = useNavigate();
  const now = useNow('minute');
  const daypart = deriveRuneWorldDaypart(now);
  const hotspots = useMemo(resolveRuneWorldHotspots, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [artState, setArtState] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [actorAvailable, setActorAvailable] = useState(true);
  const [failedWalkDirections, setFailedWalkDirections] = useState<ReadonlySet<RuneFacing>>(() => new Set());
  const [waveAvailable, setWaveAvailable] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const commandUserMove = useRef<(target: { x: number; y: number }) => boolean>(() => false);
  const manualClock = import.meta.env.DEV && new URLSearchParams(window.location.search).get('runeActorHarness') === '1';
  const actorRuntime = useRef<RuneWorldActorRuntime | null>(null);
  if (!actorRuntime.current) actorRuntime.current = new RuneWorldActorRuntime(manualClock ? createRuneWanderSeededRandom(0x1c2026) : Math.random);
  const [actorSnapshot, setActorSnapshot] = useState(() => actorRuntime.current!.getSnapshot());
  const assetBase = `${import.meta.env.BASE_URL}assets/home/rune-world`;
  const dayAsset = `${assetBase}/day.png`;
  const nightAsset = `${assetBase}/night.png`;
  const actorIdleAsset = `${assetBase}/actors/rune/v0.1/character-rune-idle-4dir.runtime.png`;

  useEffect(() => {
    const runtime = actorRuntime.current!;
    let frameRequest = 0;
    let idleTimer = 0;
    let ticking = false;
    let intersecting = false;
    let active = false;
    let harnessTime = 0;
    const cancelScheduled = () => {
      if (frameRequest) cancelAnimationFrame(frameRequest);
      if (idleTimer) clearTimeout(idleTimer);
      frameRequest = 0;
      idleTimer = 0;
    };
    const schedule = () => {
      if (!active || manualClock || frameRequest || idleTimer || !runtime.isWanderStarted()) return;
      if (runtime.getSnapshot().reaction === 'wave' || runtime.getMovementCommandSnapshot().movementSource === 'user') {
        frameRequest = requestAnimationFrame(tick);
        return;
      }
      const wander = runtime.getWanderSnapshot();
      if (wander.wanderPhase === 'walking') frameRequest = requestAnimationFrame(tick);
      else idleTimer = window.setTimeout(wake, Math.max(0, wander.idleUntil - performance.now()));
    };
    const tick = (now: number) => {
      frameRequest = 0;
      ticking = true;
      runtime.advanceWander(now);
      ticking = false;
      schedule();
    };
    const wake = () => {
      idleTimer = 0;
      ticking = true;
      runtime.advanceWander(performance.now());
      ticking = false;
      schedule();
    };
    const unsubscribe = runtime.subscribe((next) => {
      setActorSnapshot(next);
      if (!ticking) schedule();
    });
    const harness: RuneActorTestHarness | null = manualClock ? {
      setMovement: (x, y) => runtime.setMovement(x, y),
      stop: () => runtime.stop(),
      step: (ms) => runtime.step(ms),
      getSnapshot: () => runtime.getSnapshot(),
      startWander: (ms) => { harnessTime = ms; runtime.startWander(ms); },
      advanceWander: (ms) => { harnessTime = ms; runtime.advanceWander(ms); },
      getWanderSnapshot: () => runtime.getWanderSnapshot(),
      getMovementCommandSnapshot: () => runtime.getMovementCommandSnapshot(),
      requestWave: (nowMs) => { runtime.requestWave(nowMs); schedule(); },
      getReaction: () => ({ reaction: runtime.getSnapshot().reaction, reactionFrame: runtime.getSnapshot().reactionFrame, pending: runtime.hasPendingWave() }),
    } : null;
    const testWindow = window as Window & { __runeActorHarness?: RuneActorTestHarness };
    if (harness) testWindow.__runeActorHarness = harness;
    const unsubscribeCheckIn = subscribeDailyCheckInCompleted(() => {
      if ((!active && !manualClock) || !actorAvailable || artState !== 'available' || !waveAvailable) return;
      runtime.requestWave(manualClock ? harnessTime : performance.now());
      cancelScheduled();
      schedule();
    });
    commandUserMove.current = (target) => {
      const accepted = runtime.commandUserMove(target, manualClock ? harnessTime : performance.now());
      if (accepted) {
        cancelScheduled();
        schedule();
      }
      return accepted;
    };
    const updateActive = () => {
      const next = intersecting && !document.hidden;
      if (next === active) return;
      active = next;
      cancelScheduled();
      if (!next) runtime.pauseWander(performance.now());
      else {
        if (!runtime.isWanderStarted()) runtime.startWander(performance.now());
        else runtime.resumeWander(performance.now());
        schedule();
      }
    };
    const observer = !manualClock && artState === 'available' && actorAvailable && viewportRef.current
      ? new IntersectionObserver((entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting);
        updateActive();
      }) : null;
    if (observer && viewportRef.current) {
      observer.observe(viewportRef.current);
      document.addEventListener('visibilitychange', updateActive);
    }
    return () => {
      unsubscribe();
      unsubscribeCheckIn();
      cancelScheduled();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updateActive);
      commandUserMove.current = () => false;
      if (harness && testWindow.__runeActorHarness === harness) delete testWindow.__runeActorHarness;
    };
  }, [actorAvailable, artState, manualClock, waveAvailable]);

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
  const showWave = actorSnapshot.reaction === 'wave' && waveAvailable;
  const showWalk = !showWave && actorSnapshot.motion === 'walking' && !failedWalkDirections.has(actorSnapshot.facing);
  const actorFrame = showWave ? actorSnapshot.reactionFrame : showWalk ? actorSnapshot.animationFrame : RUNE_WORLD_ACTOR.idle.directions.indexOf(actorSnapshot.facing);
  const actorSpriteAsset = showWave
    ? `${assetBase}/actors/rune/v0.1/character-rune-wave-down-6f.runtime.png`
    : showWalk
    ? `${assetBase}/actors/rune/v0.1/character-rune-walk-${actorSnapshot.facing}-4f.runtime.png`
    : actorIdleAsset;
  const isInteractivePointerTarget = (target: EventTarget) => target instanceof Element
    && Boolean(target.closest('button, a, input, select, textarea, [role="button"], [data-pet-safe-region="interactive"]'));
  const handleGroundPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || isInteractivePointerTarget(event.target)) {
      pointerStart.current = null;
      return;
    }
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const handleGroundPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || event.pointerId !== start.id || isInteractivePointerTarget(event.target)
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const viewport = viewportRef.current;
    if (!viewport || !artAvailable || !actorAvailable) return;
    const bounds = viewport.getBoundingClientRect();
    const target = {
      x: (event.clientX - bounds.left - viewport.clientLeft) / viewport.clientWidth * 941,
      y: (event.clientY - bounds.top - viewport.clientTop) / viewport.clientHeight * 1672,
    };
    commandUserMove.current(target);
  };

  return (
    <section
      className="rune-pixel-world"
      data-testid="rune-pixel-world"
      data-world-daypart={daypart}
      data-art-state={artState}
      aria-label="Rune 像素世界導航"
    >
      <div ref={viewportRef} className="rune-pixel-world__viewport">
        {artAvailable ? (
          <>
            <div className="rune-pixel-world__art" aria-hidden="true">
              <img className="rune-pixel-world__map rune-pixel-world__map--day" src={dayAsset} alt="" draggable="false" onError={handleRenderedArtError} />
              <img className="rune-pixel-world__map rune-pixel-world__map--night" src={nightAsset} alt="" draggable="false" onError={handleRenderedArtError} />
              <span className="rune-pixel-world__ambient" />
            </div>
            {actorAvailable && (
              <div
                className="rune-pixel-world__actor"
                data-testid="rune-world-actor"
                data-actor-id={RUNE_WORLD_ACTOR.id}
                data-facing={actorSnapshot.facing}
                data-motion={actorSnapshot.motion}
                data-frame={showWave ? actorSnapshot.reactionFrame : actorSnapshot.animationFrame}
                data-sprite-kind={showWave ? 'wave' : showWalk ? 'walk' : 'idle'}
                aria-hidden="true"
                style={{
                  '--actor-x': actorSnapshot.worldX / 941,
                  '--actor-y': actorSnapshot.worldY / 1672,
                  '--actor-width': `${RUNE_WORLD_ACTOR.renderedWorldWidth / 941 * 100}%`,
                  '--actor-anchor-x': `${RUNE_WORLD_ACTOR.anchor.x * 100}%`,
                  '--actor-anchor-y': `${RUNE_WORLD_ACTOR.anchor.y * 100}%`,
                  '--actor-frame-offset': `${-actorFrame * 100}%`,
                  '--actor-sheet-width': showWave ? '600%' : '400%',
                } as React.CSSProperties}
              >
                <img
                  src={actorSpriteAsset}
                  alt=""
                  draggable="false"
                  onError={() => {
                    if (showWave) {
                      actorRuntime.current?.cancelWave(performance.now());
                      setWaveAvailable(false);
                    } else if (showWalk) setFailedWalkDirections((failed) => new Set(failed).add(actorSnapshot.facing));
                    else setActorAvailable(false);
                  }}
                />
              </div>
            )}
            <nav
              className="rune-pixel-world__hotspots"
              aria-label="Rune 世界地點"
              onPointerDown={handleGroundPointerDown}
              onPointerUp={handleGroundPointerUp}
              onPointerCancel={() => { pointerStart.current = null; }}
            >
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
