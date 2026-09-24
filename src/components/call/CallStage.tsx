import { useRef, useState } from 'react';
import type { ActiveCallSession } from '@/store/useCallStore';
import type { IdentityCallMedia } from '@/types';
import { CallParticipantTile } from '@/components/call/CallParticipantTile';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';

interface CallStageProps {
  session: ActiveCallSession;
  callMedia?: IdentityCallMedia;
  selfName: string;
}

const REACTION_ICONS: Record<string, React.ReactNode> = {
  heart: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.7-9.2C.9 8.6 2.7 5 6.1 5c2 0 3.3 1 4.1 2.3h3.6C14.6 6 15.9 5 17.9 5c3.4 0 5.2 3.6 3.8 6.8C19.5 16.4 12 21 12 21Z" transform="scale(.92) translate(1 .5)"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.4 5.8 6.2.5-4.7 4.1 1.4 6.1L12 16.3l-5.3 3.2 1.4-6.1L3.4 9.3l6.2-.5z"/></svg>,
  wave: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>,
};

export function CallStage({ session, callMedia, selfName }: CallStageProps) {
  const backgroundUrl = useAssetBlobUrl(
    session.backgroundPresetId === 'custom' ? callMedia?.callBackgroundAssetId : undefined,
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const onPipPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    try { target.setPointerCapture(event.pointerId); } catch { /* synthetic */ }
  };

  const onPipPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const tileRect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - stageRect.left - drag.offsetX), stageRect.width - tileRect.width);
    const y = Math.min(Math.max(0, event.clientY - stageRect.top - drag.offsetY), stageRect.height - tileRect.height);
    setPipPosition({ x, y });
  };

  const onPipPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* synthetic */ }
  };

  const latestAiLine = [...session.transcript].reverse().find((entry) => entry.speaker === 'ai');

  return (
    <div
      ref={stageRef}
      className={`call-stage call-stage--${session.backgroundPresetId}`}
      data-testid="call-stage"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
    >
      <div className="call-stage__scrim" aria-hidden="true" />

      <CallParticipantTile
        name={session.identityName}
        variant="main"
        speaking={session.aiSpeaking}
        cameraOn={session.kind === 'video'}
        portraitAssetId={callMedia?.callPortraitAssetId}
        cameraOffAssetId={callMedia?.cameraOffAssetId}
        crop={callMedia?.crop}
        motionPreset={callMedia?.motionPreset || 'breathe'}
      />

      {session.kind === 'video' && (
        <div
          className="call-stage__pip"
          style={pipPosition ? { left: pipPosition.x, top: pipPosition.y, right: 'auto', bottom: 'auto' } : undefined}
          onPointerDown={onPipPointerDown}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
          role="group"
          aria-label="你的畫面（可拖曳）"
        >
          <CallParticipantTile name={selfName} variant="pip" isSelf cameraOn={session.cameraOn} />
        </div>
      )}

      {session.captionsOn && latestAiLine && (
        <p className="call-stage__caption" data-testid="call-caption" aria-live="polite">
          {latestAiLine.text}
        </p>
      )}

      <div className="call-stage__reactions" aria-hidden="true">
        {session.reactions.slice(-6).map((reaction) => (
          <span key={reaction.id} className="call-stage__reaction">
            {REACTION_ICONS[reaction.name] || REACTION_ICONS.heart}
          </span>
        ))}
      </div>
    </div>
  );
}
