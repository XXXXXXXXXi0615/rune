import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { AppTooltip } from '@/components/shared/AppTooltip';
import { SharedIdentityEditor } from '@/components/identity/SharedIdentityEditor';
import { useAppStore, selectAgentAvatar, selectAgentDisplayName } from '@/store/useAppStore';

const TOOLTIP_DELAY_MS = 300;

/**
 * Home Duo Presence — both sides are symmetric vertical identity entries:
 * avatar → display name → canonical signature (when present).
 *
 * Phase 1.1: the second line reads the canonical **signature** the identity
 * editor writes. The legacy `bio` / `status` fallbacks are retired on this
 * private Home surface so seeded product copy (e.g. the default partner bio)
 * can never leak as an invented presence line. Empty signature collapses the
 * second line — no filler text is generated.
 *
 * Each avatar retains its existing profile editor ownership; the relationship
 * glyph remains presentation only.
 *
 * Phase 2B: layout visibility and the compact (island) preset are owned by the
 * Home widget stack, so this component no longer reads the layout store; the
 * `compact` prop only shrinks the avatar inside the same presence owner.
 */
export function HomePresencePill({ compact = false }: { compact?: boolean } = {}) {
  const profile = useAppStore((s) => s.profile);
  const userName = useAppStore((s) => s.userName);
  const partner = useAppStore((s) => s.partner);

  const [userEditorOpen, setUserEditorOpen] = useState(false);
  const [charEditorOpen, setCharEditorOpen] = useState(false);
  const [userTooltip, setUserTooltip] = useState(false);
  const [charTooltip, setCharTooltip] = useState(false);
  const tooltipTimerRef = useRef<number | null>(null);

  const showTooltip = (setter: (v: boolean) => void) => {
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = window.setTimeout(() => setter(true), TOOLTIP_DELAY_MS);
  };
  const hideTooltip = (setter: (v: boolean) => void) => {
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = null;
    setter(false);
  };
  useEffect(() => () => {
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
  }, []);

  const displayName = profile.displayName || userName || '理';
  const userInitial = (profile.avatarInitial || displayName || '理').charAt(0).toUpperCase();
  const lunaName = selectAgentDisplayName(partner);
  const lunaAvatar = selectAgentAvatar(partner);
  const lunaInitial = (partner.avatarInitial || lunaName || '智').charAt(0).toUpperCase();
  /* Canonical signature only — no bio/status fallback (§1, §7). */
  const userIntro = (profile.signature || '').trim();
  const charIntro = (partner.signature || '').trim();
  const avatarSize = compact ? 44 : 60;

  return (
    <div
      className="home-presence-pill-zone"
      data-home-presence-pill
      data-presence-anchor="center"
      data-duo-presence
      data-pet-safe-region="interactive"
      style={{ '--pp-x-ratio': 0.5, '--pp-y': '8px' } as CSSProperties}
    >
      <div
        className="home-presence-pill home-duo-presence"
        data-testid="home-presence-pill"
        title={`${lunaName} × ${displayName}`}
      >
        <span className="home-presence-pill__identity" data-presence-char-entry>
          <span className="home-presence-pill__avatar-wrap">
            <AppTooltip
              open={charTooltip}
              testId="char-avatar-tooltip"
              lines={['編輯角色資料', ...(charIntro ? [charIntro] : [])]}
            />
            <button
              type="button"
              className="home-presence-pill__avatar home-presence-pill__avatar--action"
              data-testid="char-avatar"
              aria-label="編輯角色資料"
              aria-haspopup="dialog"
              aria-expanded={charEditorOpen}
              onClick={() => { hideTooltip(setCharTooltip); setCharEditorOpen(true); }}
              onMouseEnter={() => showTooltip(setCharTooltip)}
              onMouseLeave={() => hideTooltip(setCharTooltip)}
              onFocus={() => showTooltip(setCharTooltip)}
              onBlur={() => hideTooltip(setCharTooltip)}
            >
              <AvatarImage
                avatarConfig={lunaAvatar}
                fallbackInitial={lunaInitial}
                initial={lunaInitial}
                color={partner.avatarColor || 'char'}
                size={avatarSize}
                label={`當前智能體：${lunaName}`}
              />
            </button>
          </span>
          <strong className="home-presence-pill__name">{lunaName}</strong>
          {charIntro && <small className="home-presence-pill__intro" data-testid="char-presence-intro">{charIntro}</small>}
        </span>
        <span className="home-presence-pill__connector" aria-hidden="true">
          <svg viewBox="0 0 24 10" width="22" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <path d="M0.8 5.2C2.2 2.4 3.8 2.4 5.2 5.2S8.2 8 9.6 5.2" />
            <path d="M14.4 5.2C15.8 2.4 17.4 2.4 18.8 5.2S21.8 8 23.2 5.2" />
            <circle cx="12" cy="5" r="1.55" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="home-presence-pill__identity" data-presence-user-entry>
          <span className="home-presence-pill__avatar-wrap">
            <AppTooltip
              open={userTooltip}
              testId="user-avatar-tooltip"
              lines={['編輯個人資料']}
            />
            <button
              type="button"
              className="home-presence-pill__avatar home-presence-pill__avatar--action"
              data-testid="user-avatar"
              aria-label="編輯個人資料"
              aria-haspopup="dialog"
              aria-expanded={userEditorOpen}
              onClick={() => { hideTooltip(setUserTooltip); setUserEditorOpen(true); }}
              onMouseEnter={() => showTooltip(setUserTooltip)}
              onMouseLeave={() => hideTooltip(setUserTooltip)}
              onFocus={() => showTooltip(setUserTooltip)}
              onBlur={() => hideTooltip(setUserTooltip)}
            >
              <AvatarImage
                avatarConfig={profile.avatarImage}
                fallbackInitial={userInitial}
                initial={userInitial}
                color={profile.avatarColor || 'user'}
                size={avatarSize}
                label={`目前使用者：${displayName}`}
              />
            </button>
          </span>
          <strong className="home-presence-pill__name">{displayName}</strong>
          {userIntro && <small className="home-presence-pill__intro" data-testid="user-presence-intro">{userIntro}</small>}
        </span>
      </div>
      <SharedIdentityEditor mode="user" isOpen={userEditorOpen} onClose={() => setUserEditorOpen(false)} />
      <SharedIdentityEditor mode="rune" isOpen={charEditorOpen} onClose={() => setCharEditorOpen(false)} />
    </div>
  );
}
