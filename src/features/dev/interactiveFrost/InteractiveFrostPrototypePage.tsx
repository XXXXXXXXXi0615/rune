import { useState } from 'react';
import { InteractiveBlurReveal, type FrostVariant } from '@/components/effects/InteractiveBlurReveal';
import './interactive-frost.css';

type PrototypeMode = 'original' | 'rune' | 'reduced' | 'fallback';

const MODES: Array<{ id: PrototypeMode; label: string; note: string }> = [
  { id: 'original', label: 'Original', note: 'ObsidianUI visual baseline' },
  { id: 'rune', label: 'Rune Frost', note: 'Moonmilk pearl adaptation' },
  { id: 'reduced', label: 'Reduced Motion', note: 'Static semantic fallback' },
  { id: 'fallback', label: 'WebGL Fallback', note: 'Forced unsupported state' },
];

const RUNE_ART = '/branding/rune/rune-login-soft.png';

export function InteractiveFrostPrototypePage() {
  const [mode, setMode] = useState<PrototypeMode>('rune');
  const variant: FrostVariant = mode === 'original' ? 'original' : 'rune';

  return (
    <main className="interactive-frost-prototype" data-testid="interactive-frost-prototype">
      <header className="interactive-frost-prototype__header">
        <p className="interactive-frost-prototype__eyebrow">Phase 0 · standalone visual study</p>
        <h1>Rune Interactive Frost</h1>
        <p>Decorative reveal only. No authentication, routing, or Moon Gate runtime is connected.</p>
      </header>

      <nav className="interactive-frost-prototype__modes" aria-label="Frost comparison modes">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? 'is-active' : ''}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.note}</small>
          </button>
        ))}
      </nav>

      <section className="interactive-frost-prototype__stage" aria-labelledby="frost-stage-title">
        <div className="interactive-frost-prototype__copy">
          <p className="interactive-frost-prototype__mode">{MODES.find((item) => item.id === mode)?.label}</p>
          <h2 id="frost-stage-title">Moonmilk veil</h2>
          <p>{mode === 'original'
            ? 'Cool grey baseline with the source visual parameters.'
            : mode === 'rune'
              ? 'Warm pearl frost, pale ice-blue light and restrained distortion.'
              : 'A stable artwork-first presentation with no motion dependency.'}</p>
          <p className="interactive-frost-prototype__hint">Fine pointer: move across the portrait. Touch and coarse pointers remain static.</p>
        </div>
        <InteractiveBlurReveal
          key={mode}
          imageSrc={RUNE_ART}
          alt="Rune portrait beneath a pale moonmilk frost veil"
          variant={variant}
          forceReducedMotion={mode === 'reduced'}
          forceFallback={mode === 'fallback'}
          showDiagnostics
        />
      </section>

      <footer className="interactive-frost-prototype__footer">
        <span>WebGL2 enhancement</span>
        <span>Static image fallback</span>
        <span>DPR capped at 1.5</span>
      </footer>
    </main>
  );
}

export default InteractiveFrostPrototypePage;
