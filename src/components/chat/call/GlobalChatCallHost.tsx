import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { AvatarAssetImage, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import { selectAgentDisplayName, selectPartnerAvatar, useAppStore } from '@/store/useAppStore';
import { useChatCallStore } from '@/store/useChatCallStore';
import { formatCallDuration } from './ActiveCallView';
import './GlobalChatCallHost.css';

const EDGE_MARGIN = 18;

function clampPosition(x: number, y: number, width: number, height: number) {
  const bottomReserve = window.innerWidth < 768 ? 104 : EDGE_MARGIN;
  return {
    x: Math.max(EDGE_MARGIN, Math.min(window.innerWidth - width - EDGE_MARGIN, x)),
    y: Math.max(72, Math.min(window.innerHeight - height - bottomReserve, y)),
  };
}

export function GlobalChatCallHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useChatCallStore((state) => state.session);
  const presentationMode = useChatCallStore((state) => state.presentationMode);
  const setPresentationMode = useChatCallStore((state) => state.setPresentationMode);
  const toggleMute = useChatCallStore((state) => state.toggleMute);
  const endCall = useChatCallStore((state) => state.endCall);
  const finalizeCall = useChatCallStore((state) => state.finalizeCall);
  const dismissCall = useChatCallStore((state) => state.dismissCall);
  const partner = useAppStore((state) => state.partner);
  const profile = useAppStore((state) => state.profile);
  const partnerName = selectAgentDisplayName(partner);
  const partnerAvatar = selectPartnerAvatar(partner);
  const remoteUrl = useAssetBlobUrl(session?.videoScene?.partnerVideoAssetId);
  const [elapsed, setElapsed] = useState(0);
  const [position, setPosition] = useState(() => ({ x: Math.max(18, window.innerWidth - 318), y: 92 }));
  const [endedVisible, setEndedVisible] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressBubbleClickRef = useRef(false);
  const onChatRoute = location.pathname.startsWith('/chat');

  useEffect(() => { (window as any).__chatCallStore = useChatCallStore; }, []);

  useEffect(() => {
    if (!session || !['connecting', 'active', 'ending'].includes(session.status)) return;
    const desired = onChatRoute ? 'full' : (presentationMode === 'full' ? 'floating' : presentationMode);
    if (desired !== presentationMode) setPresentationMode(desired);
  }, [onChatRoute, presentationMode, session, setPresentationMode]);

  useEffect(() => {
    if (!session || !['connecting', 'active', 'ending'].includes(session.status)) return;
    const tick = () => setElapsed(Math.floor((Date.now() - (session.connectedAt || session.startedAt)) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status, session?.connectedAt, session?.startedAt]);

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current.x, current.y, presentationMode === 'bubble' ? 64 : 292, presentationMode === 'bubble' ? 64 : 190));
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [presentationMode]);

  const beginDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: position.x, y: position.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [position]);

  const moveDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    const size = presentationMode === 'bubble' ? { width: 64, height: 64 } : { width: 292, height: 190 };
    setPosition(clampPosition(drag.x + dx, drag.y + dy, size.width, size.height));
  }, [presentationMode]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = presentationMode === 'bubble' ? 64 : 292;
    suppressBubbleClickRef.current = drag.moved;
    setPosition((current) => ({ ...current, x: current.x + width / 2 < window.innerWidth / 2 ? EDGE_MARGIN : window.innerWidth - width - EDGE_MARGIN }));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }, [presentationMode]);

  const returnToCall = () => {
    setPresentationMode('full');
    navigate(`/chat/${session?.conversationId || ''}`);
  };

  const hangUp = () => {
    endCall();
    window.setTimeout(() => {
      finalizeCall();
      setEndedVisible(true);
      window.setTimeout(() => { setEndedVisible(false); dismissCall(); }, 1800);
    }, 220);
  };

  if (onChatRoute || !session || !['connecting', 'active', 'ending'].includes(session.status)) {
    return endedVisible && !onChatRoute ? <div className="gcc-ended-toast" role="status">通話結束 · {formatCallDuration(elapsed)}</div> : null;
  }

  if (presentationMode === 'bubble') {
    return (
      <button
        type="button"
        className="gcc-bubble"
        style={{ left: position.x, top: position.y }}
        data-testid="global-call-bubble"
        aria-label={`展開與 ${partnerName} 的通話`}
        onClick={() => {
          if (suppressBubbleClickRef.current) { suppressBubbleClickRef.current = false; return; }
          setPresentationMode('floating');
        }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {remoteUrl && session.mode === 'video' ? <img src={remoteUrl} alt="" /> : partnerAvatar?.key ? <AvatarAssetImage assetId={partnerAvatar.key} alt="" /> : <IdentityAvatar identityId="lunaris" size={56} label={partnerName} />}
        <span aria-hidden="true">{session.mode === 'video' ? '▣' : '⌕'}</span>
      </button>
    );
  }

  return (
    <section className={`gcc-floating gcc-floating--${session.mode}`} style={{ left: position.x, top: position.y }} data-testid="global-call-floating" aria-label={`${partnerName} 通話小視窗`}>
      <header className="gcc-floating__drag" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <strong>{partnerName} · {session.mode === 'video' ? '視訊通話' : '語音通話'}</strong>
        <span>{formatCallDuration(elapsed)}</span>
      </header>
      <div className="gcc-floating__media">
        {remoteUrl && session.mode === 'video' ? <img src={remoteUrl} alt="" style={{ objectFit: session.videoScene?.partnerFit, objectPosition: `${session.videoScene?.partnerPositionX}% ${session.videoScene?.partnerPositionY}%` }} /> : (
          partnerAvatar?.key ? <AvatarAssetImage assetId={partnerAvatar.key} alt={partnerName} /> : <IdentityAvatar identityId="lunaris" size={72} label={partnerName} />
        )}
        {session.mode === 'video' && <div className="gcc-floating__self"><AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={(profile.displayName || '我').charAt(0)} initial={(profile.displayName || '我').charAt(0)} color={profile.avatarColor || 'user'} size={34} label="我的畫面" /></div>}
      </div>
      <footer className="gcc-floating__controls">
        <button type="button" onClick={toggleMute} aria-label={session.muteState ? '開啟麥克風' : '關閉麥克風'}>{session.muteState ? '靜音' : '麥克風'}</button>
        <button type="button" onClick={() => setPresentationMode('bubble')} aria-label="最小化成通話浮球">最小化</button>
        <button type="button" onClick={returnToCall} aria-label="返回完整通話">返回通話</button>
        <button type="button" className="is-danger" onClick={hangUp} aria-label="掛斷通話">掛斷</button>
      </footer>
    </section>
  );
}
