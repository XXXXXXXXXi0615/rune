/**
 * LocationIcon — renders an inline SVG for a given location iconType.
 *
 * Supported iconType values:
 *   insomniaStreet | rainyCafe | bufferStation | moonTearLake | tidalSea
 *   pin | home | briefcase | school | sleep | star | musicNote
 *
 * Old emoji strings (🌙 ☕ 🚉 💧 🌊 📍 🏠 💼 🏫 💤 🌟 🎵) are
 * mapped to their corresponding iconType so existing data renders
 * without changes.
 */

const EMOJI_TO_TYPE: Record<string, string> = {
  '🌙': 'insomniaStreet',
  '☕': 'rainyCafe',
  '🚉': 'bufferStation',
  '💧': 'moonTearLake',
  '🌊': 'tidalSea',
  '📍': 'pin',
  '🏠': 'home',
  '💼': 'briefcase',
  '🏫': 'school',
  '💤': 'sleep',
  '🌟': 'star',
  '🎵': 'musicNote',
};

export type LocationIconType =
  | 'insomniaStreet'
  | 'rainyCafe'
  | 'bufferStation'
  | 'moonTearLake'
  | 'tidalSea'
  | 'pin'
  | 'home'
  | 'briefcase'
  | 'school'
  | 'sleep'
  | 'star'
  | 'musicNote'
  | 'custom';

function resolveIconType(raw: string): LocationIconType {
  // Direct match
  const known: LocationIconType[] = [
    'insomniaStreet', 'rainyCafe', 'bufferStation', 'moonTearLake', 'tidalSea',
    'pin', 'home', 'briefcase', 'school', 'sleep', 'star', 'musicNote', 'custom',
  ];
  if (known.includes(raw as LocationIconType)) return raw as LocationIconType;
  // Emoji fallback
  const mapped = EMOJI_TO_TYPE[raw];
  if (mapped) return mapped as LocationIconType;
  // Default
  return 'pin';
}

interface Props {
  iconType: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export function LocationIcon({ iconType, size = 18, className, ariaLabel }: Props) {
  const resolved = resolveIconType(iconType);
  const s = size;
  const cls = className || '';

  const svg = (children: React.ReactNode) => (
    <svg
      viewBox="0 0 24 24"
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      className={cls}
      style={{
        width: s, height: s, flexShrink: 0,
        fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
      }}
    >
      {children}
    </svg>
  );

  switch (resolved) {
    // ── insomniaStreet — crescent moon ──
    case 'insomniaStreet':
      return svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);

    // ── rainyCafe — coffee cup ──
    case 'rainyCafe':
      return svg(
        <>
          <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </>,
      );

    // ── bufferStation — transit stop ──
    case 'bufferStation':
      return svg(
        <>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <circle cx="8" cy="20" r="2" />
          <circle cx="16" cy="20" r="2" />
          <line x1="8" y1="16" x2="8" y2="18" />
          <line x1="16" y1="16" x2="16" y2="18" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </>,
      );

    // ── moonTearLake — water droplet ──
    case 'moonTearLake':
      return svg(<path d="M12 2.7c-3 5.3-8 7.8-8 11.1A8 8 0 0 0 12 21a8 8 0 0 0 8-7.2c0-3.3-5-5.8-8-11.1z" />);

    // ── tidalSea — wave ──
    case 'tidalSea':
      return svg(
        <>
          <path d="M3 17c1.7-2.5 3.7-2.5 5.5 0 1.7 2.5 3.8 2.5 5.5 0 1.7-2.5 3.7-2.5 5.5 0" />
          <path d="M3 12c1.7-2.5 3.7-2.5 5.5 0 1.7 2.5 3.8 2.5 5.5 0 1.7-2.5 3.7-2.5 5.5 0" />
        </>,
      );

    // ── pin — map pin (default for custom) ──
    case 'pin':
      return svg(
        <>
          <path d="M12 21c-4-5.3-7-9-7-12a7 7 0 0 1 14 0c0 3-3 6.7-7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </>,
      );

    // ── home — house ──
    case 'home':
      return svg(
        <>
          <path d="M3 9.5L12 3l9 6.5" />
          <path d="M5 9v10a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9" />
        </>,
      );

    // ── briefcase ──
    case 'briefcase':
      return svg(
        <>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </>,
      );

    // ── school — academic cap ──
    case 'school':
      return svg(
        <>
          <path d="M2 17 12 22 22 17" />
          <path d="M2 12 12 17 22 12" />
          <path d="M12 2 2 7l10 5 10-5-10-5z" />
          <path d="M5 9v6l7 4 7-4V9" />
        </>,
      );

    // ── sleep — Zzz ──
    case 'sleep':
      return svg(
        <>
          <path d="M17 3h4l-4 6h4" />
          <path d="M9 11h4l-4 6h4" />
          <circle cx="6" cy="18" r="3" />
        </>,
      );

    // ── star ──
    case 'star':
      return svg(
        <path d="M12 2l2.9 6.3L22 9.3l-5 5.1 1.2 7.2-6.2-3.5-6.2 3.5L7 14.4l-5-5.1 7.1-1z" />,
      );

    // ── musicNote ──
    case 'musicNote':
      return svg(
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>,
      );

    // ── custom / fallback — generic map pin ──
    default:
      return svg(
        <>
          <circle cx="12" cy="10" r="4" />
          <path d="M12 2a8 8 0 0 0-8 8c0 4.5 8 12 8 12s8-7.5 8-12a8 8 0 0 0-8-8z" />
        </>,
      );
  }
}
