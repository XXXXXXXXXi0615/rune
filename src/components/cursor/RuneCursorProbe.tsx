import './RuneCursorProbe.css';

export function RuneCursorProbe() {
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('cursorProbe')) return null;

  return (
    <aside className="rune-cursor-probe" aria-label="Rune cursor development probe" data-testid="rune-cursor-probe">
      <strong>Rune Cursor Probe</strong>
      <div className="rune-cursor-probe__grid">
        <div data-cursor-probe="default">default</div>
        <div data-cursor-probe="pointer">pointer</div>
        <div data-cursor-probe="wait">wait</div>
      </div>
      <small>Development only · query: cursorProbe</small>
    </aside>
  );
}
