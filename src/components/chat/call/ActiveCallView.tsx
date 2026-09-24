import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, selectPartnerDisplayName, selectPartnerAvatar } from '@/store/useAppStore';
import { AvatarAssetImage, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { useChatCallStore } from '@/store/useChatCallStore';
import type { ChatCallSession, CallAppearance, PipCorner } from '@/types/call';
import { CallTextComposer } from './CallTextComposer';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import './ActiveCallView.css';

export type VoiceCallState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface ActiveCallViewProps {
  session: ChatCallSession;
  appearance: CallAppearance;
  elapsed: number;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onOpenSettings: () => void;
  onStartMic: () => void;
  onStopMic: () => void;
  isMobile: boolean;
  /** Real voice pipeline state */
  voiceState: VoiceCallState;
  micStreaming: boolean;
  micPermDenied: boolean;
  liveWaveform?: number[] | null;
  /** Routes to the canonical Chat send action */
  onTextSubmit?: (text: string) => void;
}

export function formatCallDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AVATAR_PX = 76;

const PIP_CORNERS: Record<PipCorner, { top: string; left: string; right: string; bottom: string }> = {
  'left-top':    { top: '16px', left: '16px', right: 'auto', bottom: 'auto' },
  'right-top':   { top: '16px', left: 'auto', right: '16px', bottom: 'auto' },
  'left-bottom': { top: 'auto', left: '16px', right: 'auto', bottom: '80px' },
  'right-bottom':{ top: 'auto', left: 'auto', right: '16px', bottom: '80px' },
};

export function ActiveCallView({
  session,
  appearance,
  elapsed,
  onEnd,
  onToggleSpeaker,
  onOpenSettings,
  onStartMic,
  onStopMic,
  isMobile,
  voiceState,
  micStreaming,
  micPermDenied,
  liveWaveform,
  onTextSubmit,
}: ActiveCallViewProps) {
  const partner = useAppStore((s) => s.partner);
  const profile = useAppStore((s) => s.profile);
  const partnerName = selectPartnerDisplayName(partner);
  const partnerAvatar = selectPartnerAvatar(partner);
  const userName = profile.displayName?.trim() || '使用者';
  const bgUrl = useAssetBlobUrl(appearance.backgroundAssetId ?? '');
  const hasBackground = !!appearance.backgroundAssetId && !!bgUrl;
  const setVideoScene = useChatCallStore((s) => s.setVideoScene);

  // Video scene assets
  const partnerSceneUrl = useAssetBlobUrl(session.videoScene?.partnerVideoAssetId ?? '');
  const selfSceneUrl = useAssetBlobUrl(session.videoScene?.selfVideoAssetId ?? '');
  const isVideo = session.mode === 'video';
  const vs = session.videoScene;

  const transcriptRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [composerOpen, setComposerOpen] = useState(false);

  // ── PiP drag state ──
  const [draggingPip, setDraggingPip] = useState(false);
  const pipRef = useRef<HTMLDivElement>(null);
  const pipCorner = vs?.pipCorner ?? 'right-top';

  const handlePipPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingPip(true);
  }, []);

  const handlePipPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingPip) return;
    const stage = pipRef.current?.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX;
    const cy = e.clientY;

    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    const isRight = cx > midX;
    const isBottom = cy > midY;

    let corner: PipCorner;
    if (isRight && isBottom) corner = 'right-bottom';
    else if (isRight && !isBottom) corner = 'right-top';
    else if (!isRight && isBottom) corner = 'left-bottom';
    else corner = 'left-top';

    setVideoScene({ pipCorner: corner });
  }, [draggingPip, setVideoScene]);

  const handlePipPointerUp = useCallback(() => {
    setDraggingPip(false);
  }, []);

  const pipStyle = useMemo(() => {
    return PIP_CORNERS[pipCorner];
  }, [pipCorner]);

  // ── Tone / tint classes ──
  const toneClass = (() => {
    switch (appearance.tone) {
      case 'cool': return 'cc-active--cool';
      case 'neutral': return 'cc-active--neutral';
      default: return 'cc-active--warm';
    }
  })();
  const tintClass = appearance.tintEnabled ? '' : 'cc-active--no-tint';

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) { el.scrollTop = el.scrollHeight; }
  }, [session.transcript]);

  useEffect(() => {
    if (!composerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setComposerOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [composerOpen]);

  const voiceStatusLabel = (() => {
    if (micPermDenied) return '麥克風未授權';
    switch (voiceState) {
      case 'listening': return '正在聆聽';
      case 'transcribing': return '辨識中';
      case 'thinking': return '思考中';
      case 'speaking': return '正在說話';
      default: return '';
    }
  })();

  // Waveform: real analyser data when available, otherwise ambient idle breathing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function draw() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cy = h / 2;
      const isCool = appearance.tone === 'cool';
      const glowColor = isCool ? '218,234,255' : '255,240,216';

      ctx!.clearRect(0, 0, w, h);

      if (prefersReduced) {
        ctx!.beginPath();
        ctx!.moveTo(0, cy);
        ctx!.lineTo(w, cy);
        ctx!.strokeStyle = `rgba(${glowColor}, 0.15)`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      } else if (liveWaveform && liveWaveform.length > 0) {
        const step = w / liveWaveform.length;
        ctx!.beginPath();
        for (let i = 0; i < liveWaveform.length; i++) {
          const x = i * step;
          const v = liveWaveform[i] * 0.6;
          const y = cy + v * h * 0.45;
          i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgba(${glowColor}, 0.5)`;
        ctx!.lineWidth = 2;
        ctx!.stroke();
      } else {
        const amp = 0.05;
        const N = 30;
        const F = 3.4;
        for (let i = 0; i < N; i++) {
          const frac = i / (N - 1);
          const fi = F * (1 + (frac - 0.5) * 0.8);
          const amul = 0.4 + 0.5 * Math.sin(frac * Math.PI);
          const alpha = 0.04 + 0.04 * Math.sin(frac * Math.PI);
          ctx!.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const nx = x / w;
            const env = Math.pow(Math.sin(Math.PI * nx), 3);
            const arg = (nx - 0.5) * Math.PI * 2 * fi + t * 1.4;
            const y = cy + env * (amp * amul * h) * Math.sin(arg);
            x === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
          }
          ctx!.strokeStyle = `rgba(${glowColor}, ${alpha})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }
      }

      if (session.status === 'active' || session.status === 'ending') {
        t += 0.03;
        animRef.current = requestAnimationFrame(draw);
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [appearance.tone, session.status, liveWaveform, micStreaming]);

  const handleEnd = useCallback(() => {
    setComposerOpen(false);
    onEnd();
  }, [onEnd]);

  const handleTextSubmit = useCallback((text: string) => {
    onTextSubmit?.(text);
  }, [onTextSubmit]);

  const speakerOn = session.speakerState !== false;

  const renderTranscript = () => {
    if (session.transcript.length === 0) return null;
    return session.transcript.map((line) => (
      <div
        key={line.id}
        className={`cc-active-bubble cc-active-bubble--${line.speaker}${line.isStreaming ? ' is-streaming' : ''}`}
      >
        <span className="cc-active-bubble-text">
          {line.text}
          {line.isStreaming && <span className="cc-active-caret" aria-hidden="true" />}
        </span>
      </div>
    ));
  };

  const renderCallHeader = () => (
    <div className="cc-active-hud" data-testid="call-hud">
      <div className="cc-active-hud-left">
        <span className="cc-active-hud-dot" aria-hidden="true" />
        <span className="cc-active-hud-label">{partnerName} · {isVideo ? '視訊通話' : '語音通話'}</span>
      </div>
      <div className="cc-active-hud-center">
        <span className="cc-active-hud-timer" role="timer" aria-live="off" data-testid="call-timer">
          {formatCallDuration(elapsed)}
        </span>
      </div>
      <div className="cc-active-hud-right">
        <span className="cc-active-hud-status" aria-label="私人安全通話">⌁</span>
        <button type="button" className="cc-active-hud-gear" onClick={onOpenSettings} aria-label="通話設定" data-testid="call-settings-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2.3" /><circle cx="9" cy="17" r="2.3" />
          </svg>
        </button>
      </div>
    </div>
  );

  const compositeClass = [
    'cc-active',
    toneClass,
    tintClass,
    isMobile ? 'is-mobile' : '',
    micStreaming ? 'is-mic-on' : '',
    voiceState === 'speaking' ? 'is-lunaris-speaking' : '',
    composerOpen ? 'has-textcomposer' : '',
    isVideo ? 'is-video-call' : '',
  ].filter(Boolean).join(' ');

  const view = (
    <div
      className={compositeClass}
      data-testid="active-call-view"
      data-call-mode={session.mode}
      data-call-shell
    >
      <div className="cc-active-bg" />
      {hasBackground && (
        <div
          className="cc-active-bg-img"
          style={{
            backgroundImage: `url(${bgUrl!})`,
            opacity: appearance.backgroundOpacity ?? 1,
            backgroundSize: appearance.backgroundFit ?? 'cover',
            backgroundPosition: `${appearance.backgroundPositionX ?? 50}% ${appearance.backgroundPositionY ?? 50}%`,
          }}
          aria-hidden="true"
        />
      )}
      {appearance.tintEnabled && <div className="cc-active-tint" />}
      {renderCallHeader()}

      {isVideo ? (
        /* ═══════════════════════════════════════════
           VIDEO MODE — HUD / Stage / Controls
           ═══════════════════════════════════════════ */
        <>
          <div className="cc-active-video-stage" ref={pipRef} data-testid="call-video-stage">
            {/* Partner Scene — full-size main area */}
            <div className="cc-active-video-remote">
              {partnerSceneUrl ? (
                <>
                  <img src={partnerSceneUrl} alt="" className="cc-active-video-img-bg" />
                  <img
                    src={partnerSceneUrl}
                    alt=""
                    className="cc-active-video-img"
                    style={{
                      objectFit: vs?.partnerFit ?? 'contain',
                      objectPosition: `${vs?.partnerPositionX ?? 50}% ${vs?.partnerPositionY ?? 50}%`,
                    }}
                  />
                </>
              ) : (
                <div className="cc-active-video-fallback">
                  <div className="cc-active-video-fallback-bg" />
                  <div className="cc-active-video-fallback-avatar">
                    {partnerAvatar?.key ? (
                      <AvatarAssetImage
                        assetId={partnerAvatar.key}
                        alt={partnerName}
                        fallback={<IdentityAvatar identityId="lunaris" size={AVATAR_PX} label={partnerName} />}
                      />
                    ) : (
                      <IdentityAvatar identityId="lunaris" size={AVATAR_PX} label={partnerName} />
                    )}
                  </div>
                  <div className="cc-active-video-fallback-name">{partnerName}</div>
                  <div className="cc-active-video-fallback-hint">尚未設定視訊畫面</div>
                  <button
                    type="button"
                    className="cc-active-video-fallback-setup"
                    onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                  >
                    設定視訊畫面
                  </button>
                </div>
              )}
              {/* Breathing animation + readability gradient overlays */}
              <div className={`cc-active-video-breath${voiceState === 'speaking' ? ' is-active' : ''}`} aria-hidden="true" />
              <div className="cc-active-video-gradient" aria-hidden="true" />
              <div className="cc-active-video-grain" aria-hidden="true" />
            </div>

            {/* Self PiP */}
            {(vs?.selfPreviewVisible ?? true) && (
              <div
                className={`cc-active-video-pip${draggingPip ? ' is-dragging' : ''}`}
                aria-hidden="true"
                style={pipStyle}
                data-testid="call-video-pip"
                data-pip-corner={pipCorner}
                onPointerDown={handlePipPointerDown}
                onPointerMove={handlePipPointerMove}
                onPointerUp={handlePipPointerUp}
                role="group"
                aria-label={userName}
                tabIndex={0}
              >
                {selfSceneUrl ? (
                  <img
                    src={selfSceneUrl}
                    alt=""
                    style={{
                      objectFit: vs?.selfFit ?? 'cover',
                      objectPosition: `${vs?.selfPositionX ?? 50}% ${vs?.selfPositionY ?? 50}%`,
                      transform: vs?.selfMirror ? 'scaleX(-1)' : undefined,
                    }}
                  />
                ) : (
                  <div className="cc-active-video-pip-fallback">
                    <AvatarImage
                      avatarConfig={profile.avatarImage}
                      fallbackInitial={userName.charAt(0)}
                      initial={userName.charAt(0)}
                      color={profile.avatarColor || 'user'}
                      size={60}
                      label={userName}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Transcript (floating above video, above controls) */}
            <div className="cc-active-video-transcript" ref={transcriptRef} aria-label="通話字幕" role="log" aria-live="polite">
              {renderTranscript()}
            </div>
          </div>

          {/* ── CallControls (video) ── */}
          <div className="cc-active-dock cc-active-dock--video">
            <CallTextComposer
              open={composerOpen}
              isMobile={isMobile}
              onSubmit={handleTextSubmit}
              onClose={() => setComposerOpen(false)}
            />
            {renderCallControls()}
          </div>
        </>
      ) : (
        /* ═══════════════════════════════════════════
           VOICE MODE — Legacy layout
           ═══════════════════════════════════════════ */
        <>
          <div className="cc-active-stage">
            {/* Participants */}
            <div className="cc-active-participants" data-testid="call-participants">
              <div className="cc-active-pair">
                <div
                  className={`cc-active-avatar${voiceState === 'speaking' ? ' is-speaking' : ''}`}
                  data-testid="call-avatar-lunaris"
                >
                  {partnerAvatar?.key ? (
                    <AvatarAssetImage
                      assetId={partnerAvatar.key}
                      alt={partnerName}
                      fallback={<IdentityAvatar identityId="lunaris" size={AVATAR_PX} label={partnerName} />}
                    />
                  ) : (
                    <IdentityAvatar identityId="lunaris" size={AVATAR_PX} label={partnerName} />
                  )}
                </div>
                <div
                  className={`cc-active-avatar${micStreaming ? ' is-speaking' : ''}`}
                  data-testid="call-avatar-user"
                >
                  <AvatarImage
                    avatarConfig={profile.avatarImage}
                    fallbackInitial={userName.charAt(0)}
                    initial={userName.charAt(0)}
                    color={profile.avatarColor || 'user'}
                    size={AVATAR_PX}
                    label={userName}
                  />
                </div>
              </div>
              <div className="cc-active-names">
                <span className={voiceState === 'speaking' ? 'is-active' : undefined}>{partnerName}</span>
                <span className={micStreaming ? 'is-active' : undefined}>{userName}</span>
              </div>
            </div>

            {/* Waveform */}
            <div className="cc-active-wave">
              <canvas ref={canvasRef} className="cc-active-waveform" aria-hidden="true" />
            </div>

            {/* Transcript */}
            <div className="cc-active-transcript" ref={transcriptRef} aria-label="通話字幕" role="log" aria-live="polite">
              {renderTranscript()}
            </div>
          </div>

          {/* CallControls (voice) */}
          <div className="cc-active-dock">
            <CallTextComposer
              open={composerOpen}
              isMobile={isMobile}
              onSubmit={handleTextSubmit}
              onClose={() => setComposerOpen(false)}
            />
            {renderCallControls()}
          </div>
        </>
      )}

    </div>
  );

  function renderCallControls() {
    return (
      <>
        <button type="button"
          className={`cc-active-ctrl${micStreaming ? ' is-on' : ''}`}
          data-testid="call-ctrl-mic"
          onClick={micStreaming ? onStopMic : onStartMic}
          aria-label={micStreaming ? '停止麥克風' : '開啟麥克風'}
          disabled={micPermDenied}>
          <span className="cc-active-ctrl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {micPermDenied ? (
                <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M3 3l18 18" /></>
              ) : (
                <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>
              )}
            </svg>
          </span>
          <span className="cc-active-ctrl-label">{micPermDenied ? '無授權' : '麥克風'}</span>
        </button>

        <button type="button"
          className={`cc-active-ctrl${speakerOn ? '' : ' is-off'}`}
          data-testid="call-ctrl-speaker"
          onClick={onToggleSpeaker}
          aria-label={speakerOn ? '揚聲器開啟' : '揚聲器靜音'}
          title="控制 LUNARIS 語音播放">
          <span className="cc-active-ctrl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
              {speakerOn ? <path d="M16.5 8.5a4 4 0 0 1 0 7" /> : <path d="M16 9.5l4 5M20 9.5l-4 5" />}
            </svg>
          </span>
          <span className="cc-active-ctrl-label">揚聲器</span>
        </button>

        <button type="button"
          className={`cc-active-ctrl${composerOpen ? ' is-on' : ''}`}
          data-testid="call-ctrl-text"
          aria-expanded={composerOpen}
          onClick={() => setComposerOpen((s) => !s)}
          aria-label={composerOpen ? '收起文字輸入' : '開啟文字輸入'}>
          <span className="cc-active-ctrl-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z" />
              <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="12" y2="11" />
            </svg>
          </span>
          <span className="cc-active-ctrl-label">文字</span>
        </button>

        <button type="button"
          className="cc-active-ctrl cc-active-ctrl--end"
          data-testid="call-ctrl-end"
          onClick={handleEnd}
          aria-label="結束通話">
          <span className="cc-active-ctrl-ico">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <g transform="rotate(135 12 12)">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.4 0 .8-.2 1l-3 2.2z" />
              </g>
            </svg>
          </span>
          <span className="cc-active-ctrl-label">掛斷</span>
        </button>
      </>
    );
  }

  return isMobile ? createPortal(view, document.getElementById('app') ?? document.body) : view;
}

interface EndedCallShellProps {
  mode: 'voice' | 'video';
  partnerName: string;
  elapsed: number;
  isMobile: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function EndedCallShell({ mode, partnerName, elapsed, isMobile, onRetry, onDismiss }: EndedCallShellProps) {
  const view = (
    <section
      className={`cc-active cc-active--ended${isMobile ? ' is-mobile' : ''}`}
      data-testid="call-ended-overlay"
      data-call-mode={mode}
      data-call-shell
      aria-labelledby="call-ended-title"
    >
      <div className="cc-active-bg" aria-hidden="true" />
      <div className="cc-ended-shell-content">
        <span className="cc-ended-shell-mark" aria-hidden="true">✓</span>
        <h2 id="call-ended-title">通話結束</h2>
        <p className="cc-ended-partner">{partnerName}</p>
        <p className="cc-ended-mode">{mode === 'video' ? '視訊通話' : '語音通話'}</p>
        <strong className="cc-ended-duration">{formatCallDuration(elapsed)}</strong>
        <div className="cc-ended-actions">
          <button type="button" className="cc-ended-retry" onClick={onRetry}>再次通話</button>
          <button type="button" className="cc-ended-dismiss" onClick={onDismiss}>返回聊天</button>
        </div>
      </div>
    </section>
  );
  return isMobile ? createPortal(view, document.getElementById('app') ?? document.body) : view;
}
