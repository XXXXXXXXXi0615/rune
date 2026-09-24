import { Component, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { hashPassword, verifyPassword } from '@/utils/auth';
import { resolveRuneWordmarkAsset, type RuneLoginPortraitState } from '@/components/branding/runeBrandAssets';
import { generateAccessString, isValidInvitationCode } from '@/features/auth/runeLogin';
import { resolveChatProvider } from '@/ai/providerRuntime';
import { GuestLounge } from '@/components/auth/GuestLounge';
import { MoonGateFrostArtwork } from '@/components/auth/MoonGateFrostArtwork';
import './rune-login-gate.css';

/* ── Icons ── */

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>;
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/></svg>;
}

function VisibilityIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.3-5.3 9-5.3S21 12 21 12s-3.3 5.3-9 5.3S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.4" />
      {revealed ? <path d="m4.5 4.5 15 15" /> : null}
    </svg>
  );
}

function RuneLoginAtmosphere() {
  return (
    <div className="rlg-atmosphere" aria-hidden="true">
      <span className="rlg-ambient-glow" />
      <span className="rlg-moon-disc" />
      <svg className="rlg-orbits" viewBox="0 0 760 620" fill="none">
        <ellipse cx="360" cy="302" rx="292" ry="154" />
        <ellipse cx="360" cy="302" rx="245" ry="112" transform="rotate(-18 360 302)" />
      </svg>
      <span className="rlg-star rlg-star--one" />
      <span className="rlg-star rlg-star--two" />
      <span className="rlg-star rlg-star--three" />
    </div>
  );
}

function RuneLoginThemeToggle() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const handleThemeToggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <button
      type="button"
      className="rlg-theme-toggle"
      onClick={handleThemeToggle}
      aria-label={isDark ? '切換至淺色模式' : '切換至深色模式'}
      data-testid="rune-login-theme-toggle"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.3A8.7 8.7 0 0 1 8.7 3.5 8.8 8.8 0 1 0 20.5 15.3Z" /></svg>
      )}
    </button>
  );
}

/* ── Types ── */

type GateStage = 'invitation' | 'invitation_invalid' | 'generated' | 'returning' | 'returning_invalid' | 'verifying';

interface RuneGateErrorBoundaryState { error: Error | null; }

class RuneGateErrorBoundary extends Component<{ children: ReactNode }, RuneGateErrorBoundaryState> {
  state: RuneGateErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (import.meta.env.DEV) console.error('[RuneLoginGate ErrorBoundary]', error.message, '\n', error.stack, '\n', info.componentStack);
  }
  handleReset = () => { this.setState({ error: null }); window.location.reload(); };
  render() {
    if (this.state.error) {
      return <main className="rune-login-gate" data-testid="rune-login-gate" data-rune-gate-state="error-boundary">
        <div className="rlg-veil" aria-hidden="true" />
        <section className="rlg-panel">
          <div className="rlg-greeting"><h1>Rune couldn&apos;t open just yet.</h1></div>
          <p className="rlg-note">Something unexpected happened. Your data was not sent anywhere.</p>
          <button className="rlg-cta" type="button" onClick={this.handleReset}>Reload</button>
        </section>
      </main>;
    }
    return this.props.children;
  }
}

function RuneWelcomeCopy({ isFirstRun, isReady }: { isFirstRun: boolean; isReady: boolean }) {
  if (isReady) {
    return (
      <div className="rlg-ready-copy">
        <h1 id="rune-login-title">Rune is ready.</h1>
        <p>Keep this Access String somewhere safe.</p>
      </div>
    );
  }

  if (isFirstRun) {
    return <h1 id="rune-login-title">Welcome to Rune.</h1>;
  }

  return (
    <div className="rlg-returning-copy">
      <p className="rlg-returning-kicker">Welcome back,</p>
      <h1 id="rune-login-title">Master.</h1>
      <p className="rlg-returning-support">Rune is waiting.</p>
    </div>
  );
}

function RuneValidationSlot({ message }: { message: string }) {
  return (
    <div
      id="rune-gate-feedback"
      className="rlg-validation-slot"
      role={message ? 'alert' : undefined}
      aria-atomic="true"
      data-has-message={message ? 'true' : 'false'}
    >
      {message ? <p className="rlg-error">{message}</p> : null}
    </div>
  );
}

function RuneLoadingLabel({ loading, idle, busy = 'Opening…' }: { loading: boolean; idle: string; busy?: string }) {
  return (
    <span className="rlg-button-label">
      {loading ? <span className="rlg-loading-mark" aria-hidden="true" /> : null}
      {loading ? busy : idle}
    </span>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ── Main Component ── */

export function AuthGate() {
  const auth = useAppStore((state) => state.auth);
  const establishRuneAccess = useAppStore((state) => state.establishRuneAccess);
  const unlockAuth = useAppStore((state) => state.unlockAuth);
  const providers = useAppStore((state) => state.providers || []);
  const aiRoles = useAppStore((state) => state.aiRoles);
  const navigate = useNavigate();

  const guestProvider = useMemo(() => {
    const resolution = resolveChatProvider(aiRoles, providers);
    return resolution.configured ? resolution.provider : null;
  }, [aiRoles, providers]);

  const isFirstRun = !auth.onboardingComplete;

  const [stage, setStage] = useState<GateStage>(isFirstRun ? 'invitation' : 'returning');
  const [invitation, setInvitation] = useState('');
  const [invitationError, setInvitationError] = useState('');
  const [draftAccessString, setDraftAccessString] = useState<string | null>(null);
  const [returningAccess, setReturningAccess] = useState('');
  const [returningAccessVisible, setReturningAccessVisible] = useState(false);
  const [returningError, setReturningError] = useState('');
  const [copied, setCopied] = useState(false);

  const submittingRef = useRef(false);
  const invitationInputRef = useRef<HTMLInputElement>(null);
  const returningInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); };
  }, []);

  const completeUnlock = (commit: () => void) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const run = () => { commit(); navigate('/', { replace: true }); };
    const transition = (document as Document & { startViewTransition?: (callback: () => void) => void }).startViewTransition;
    window.setTimeout(() => (transition ? transition.call(document, run) : run()), reduced ? 150 : 340);
  };

  const handleInvitationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setInvitationError('');
    if (!isValidInvitationCode(invitation)) {
      setStage('invitation_invalid');
      setInvitationError('That invitation code doesn’t match. Check it and try again.');
      requestAnimationFrame(() => invitationInputRef.current?.focus());
      return;
    }
    setDraftAccessString(generateAccessString());
    setCopied(false);
    setStage('generated');
  };

  const handleRegenerate = () => {
    if (submittingRef.current || stage !== 'generated') return;
    setDraftAccessString(generateAccessString());
    setCopied(false);
    setInvitationError('');
  };

  const handleCopy = async () => {
    if (!draftAccessString) return;
    const ok = await copyText(draftAccessString);
    if (ok) {
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterFirstRun = async () => {
    if (submittingRef.current || !draftAccessString) return;
    submittingRef.current = true;
    setStage('verifying');
    try {
      const accessString = draftAccessString;
      const passwordHash = await hashPassword(accessString);
      const fallbackName = useAppStore.getState().userName?.trim() || 'user';
      completeUnlock(() => establishRuneAccess({ username: fallbackName, passwordHash, accessString }));
    } catch {
      submittingRef.current = false;
      setStage('generated');
      setInvitationError('Rune couldn’t finish setup on this device. Please try again.');
    }
  };

  const handleReturningSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setReturningError('');
    if (!returningAccess.trim()) {
      setStage('returning_invalid');
      setReturningError('Enter your Access String to open Rune.');
      requestAnimationFrame(() => returningInputRef.current?.focus());
      return;
    }
    submittingRef.current = true;
    setStage('verifying');
    try {
      const valid = await verifyPassword(returningAccess, auth.passwordHash);
      if (!valid) {
        submittingRef.current = false;
        setStage('returning_invalid');
        setReturningError('That Access String doesn’t match.');
        requestAnimationFrame(() => { returningInputRef.current?.focus(); returningInputRef.current?.select(); });
        return;
      }
      completeUnlock(unlockAuth);
    } catch {
      submittingRef.current = false;
      setStage('returning');
      setReturningError('Verification failed on this device. Please try again.');
      requestAnimationFrame(() => returningInputRef.current?.focus());
    }
  };

  const stateLabel = isFirstRun
    ? stage === 'invitation_invalid' ? 'invitation_invalid'
      : stage === 'generated' ? 'generated'
        : stage === 'verifying' ? 'verifying'
          : 'invitation'
    : stage === 'returning_invalid' ? 'returning_invalid'
      : stage === 'verifying' ? 'verifying'
        : 'returning';

  const isVerifying = stage === 'verifying';
  const banner = invitationError || returningError;
  const isFirstRunSuccess = isFirstRun
    && Boolean(draftAccessString)
    && (stage === 'generated' || stage === 'verifying');
  const portraitState: RuneLoginPortraitState = isFirstRun && (stage === 'generated' || stage === 'verifying')
    ? 'soft'
    : 'neutral';

  return (
    <RuneGateErrorBoundary>
      <main
        className="rune-login-gate"
        data-testid="rune-login-gate"
        data-rune-gate-state={stateLabel}
        data-rune-mode={isFirstRun ? 'first_run' : 'returning'}
        aria-busy={isVerifying || undefined}
      >
        <RuneLoginAtmosphere />
        <RuneLoginThemeToggle />

        <div className="rlg-composition">
          <MoonGateFrostArtwork state={portraitState} />

          <section className="rlg-panel" aria-labelledby="rune-login-title" data-screen={isFirstRunSuccess ? 'success' : isFirstRun ? 'invitation' : 'returning'}>
            <header className="rlg-brand" aria-label="Rune">
              <img
                className="rlg-brand-wordmark"
                src={resolveRuneWordmarkAsset()}
                alt=""
                aria-hidden="true"
                data-testid="rune-wordmark"
              />
            </header>
            <div className="rlg-greeting">
              <RuneWelcomeCopy isFirstRun={isFirstRun} isReady={isFirstRunSuccess} />
            </div>

            <div className="rlg-flow">
            {!isFirstRun && (
              <form className="rlg-form" onSubmit={handleReturningSubmit} noValidate aria-busy={isVerifying || undefined}>
                <label className="rlg-field" htmlFor="rune-access-input">
                  <span>Access String</span>
                  <span className="rlg-input-shell">
                    <input
                      ref={returningInputRef}
                      id="rune-access-input"
                      name="accessString"
                      type={returningAccessVisible ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={returningAccess}
                      onChange={(event) => {
                        setReturningAccess(event.target.value);
                        setReturningError('');
                        if (stage === 'returning_invalid') setStage('returning');
                      }}
                      placeholder="Enter your Access String"
                      aria-invalid={stage === 'returning_invalid' || undefined}
                      aria-describedby="rune-gate-feedback"
                      disabled={isVerifying}
                      data-testid="rune-access-input"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="rlg-access-visibility"
                      aria-label={returningAccessVisible ? 'Hide Access String' : 'Show Access String'}
                      aria-pressed={returningAccessVisible}
                      data-testid="rune-access-visibility"
                      disabled={isVerifying}
                      onClick={() => setReturningAccessVisible((visible) => !visible)}
                    >
                      <VisibilityIcon revealed={returningAccessVisible} />
                    </button>
                  </span>
                </label>
                <RuneValidationSlot message={banner} />
                <button
                  className="rlg-cta"
                  type="submit"
                  aria-label="Enter Rune"
                  disabled={isVerifying || !returningAccess.trim()}
                  data-testid="rune-enter"
                >
                  <RuneLoadingLabel loading={isVerifying} idle="Enter Rune" busy="Verifying…" />
                </button>
              </form>
            )}

            {isFirstRun && stage !== 'generated' && stage !== 'verifying' && (
              <form className="rlg-form" onSubmit={handleInvitationSubmit} noValidate>
                <label className="rlg-field" htmlFor="rune-invitation-input">
                  <span>Invitation Code</span>
                  <input
                    ref={invitationInputRef}
                    id="rune-invitation-input"
                    name="invitationCode"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                    value={invitation}
                    onChange={(event) => {
                      setInvitation(event.target.value);
                      setInvitationError('');
                      if (stage === 'invitation_invalid') setStage('invitation');
                    }}
                    placeholder="Enter your invitation code"
                    aria-invalid={stage === 'invitation_invalid' || undefined}
                    aria-describedby="rune-gate-feedback"
                    data-testid="rune-invitation-input"
                    autoFocus
                  />
                </label>
                <RuneValidationSlot message={banner} />
                <button
                  className="rlg-cta"
                  type="submit"
                  aria-label="Continue"
                  data-testid="rune-continue"
                >
                  Continue
                </button>
              </form>
            )}

            {isFirstRunSuccess && draftAccessString && (
              <div className="rlg-generated" aria-busy={isVerifying || undefined}>
                <div className="rlg-field">
                  <span id="rune-access-string-label">Your Access String</span>
                  <output className="rlg-access-display" aria-labelledby="rune-access-string-label" data-testid="rune-access-string">
                    <code>{draftAccessString}</code>
                  </output>
                </div>
                <div className="rlg-compact-actions">
                  <button type="button" className="rlg-action" onClick={() => void handleCopy()} data-testid="rune-copy" aria-label="Copy Access String" disabled={isVerifying}>
                    <CopyIcon /> {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" className="rlg-action" onClick={handleRegenerate} data-testid="rune-regenerate" aria-label="Regenerate Access String" disabled={isVerifying}>
                    <RefreshIcon /> Regenerate
                  </button>
                </div>
                <RuneValidationSlot message={banner} />
                <button
                  className="rlg-cta rlg-cta--enter"
                  type="button"
                  aria-label="Enter Rune"
                  data-testid="rune-enter"
                  onClick={() => void handleEnterFirstRun()}
                  disabled={isVerifying}
                >
                  <RuneLoadingLabel loading={isVerifying} idle="Enter Rune" />
                </button>
              </div>
            )}
            </div>
          </section>
        </div>
        <GuestLounge
          provider={guestProvider}
          onReturnToLogin={() => {
            const target = returningInputRef.current
              || invitationInputRef.current
              || document.querySelector<HTMLElement>('.rlg-panel .rlg-cta:not(:disabled)');
            target?.focus();
          }}
        />
      </main>
    </RuneGateErrorBoundary>
  );
}
