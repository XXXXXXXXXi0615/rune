export type MusicSection = 'home' | 'library' | 'recent' | 'playlists' | 'search';

interface MusicDockProps {
  activeView: MusicSection;
  onViewChange: (view: MusicSection) => void;
}

const ITEMS: { id: MusicSection; label: string }[] = [
  { id: 'home', label: '共聽' },
  { id: 'library', label: '音樂庫' },
  { id: 'playlists', label: '歌單' },
];

function DockIcon({ id }: { id: MusicSection }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'library': return <svg viewBox="0 0 24 24" {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
    case 'home': return <svg viewBox="0 0 24 24" {...p}><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></svg>;
    case 'recent': return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
    case 'playlists': return <svg viewBox="0 0 24 24" {...p}><path d="M3 6h18M3 12h12M3 18h6" /></svg>;
    case 'search': return <svg viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  }
  return null;
}

export function MusicDock({ activeView, onViewChange }: MusicDockProps) {
  const activeIdx = Math.max(0, ITEMS.findIndex(i => i.id === activeView));
  const isNativeShell = typeof document !== 'undefined' && document.documentElement.dataset.nativeShell === 'ios';

  return (
    <nav className="lm-nav" style={{ '--lm-nav-cols': 3 } as React.CSSProperties} aria-label="音樂主要導覽">
      <span className="lm-nav__indicator" style={{ transform: `translate3d(${activeIdx * 100}%, 0, 0)` }} aria-hidden="true" />
      {ITEMS.map(item => (
        <button key={item.id} type="button" className="lm-nav__btn" onClick={() => onViewChange(item.id)}>
          <DockIcon id={item.id} />
          <span>{isNativeShell && item.id === 'home' ? '共聽' : item.label}</span>
        </button>
      ))}
    </nav>
  );
}
