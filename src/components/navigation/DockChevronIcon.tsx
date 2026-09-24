export function DockChevronIcon({ expanded }: { expanded: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6" transform={expanded ? undefined : 'rotate(180 12 12)'} /></svg>;
}
