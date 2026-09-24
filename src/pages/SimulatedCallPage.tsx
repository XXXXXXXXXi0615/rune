import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { useCallStore } from '@/store/useCallStore';
import { callStateLabel } from '@/utils/callMachine';
import { CallStage } from '@/components/call/CallStage';
import { CallControls } from '@/components/call/CallControls';
import { CallTranscript } from '@/components/call/CallTranscript';
import { CallTextComposer } from '@/components/call/CallTextComposer';
import { CallContextDrawer } from '@/components/call/CallContextDrawer';
import { CallEndSummary } from '@/components/call/CallEndSummary';
import { IdentityCallMediaSheet } from '@/components/call/IdentityCallMediaSheet';
import { CallParticipantTile } from '@/components/call/CallParticipantTile';
import '@/styles/call.css';

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type SidePanel = 'none' | 'transcript' | 'share' | 'media';

/** Simulated AI call page. No WebRTC — real human calls will use WebRTC in a later phase. */
export function SimulatedCallPage() {
  const session = useCallStore((s) => s.session);
  const answerCall = useCallStore((s) => s.answerCall);
  const toggleMic = useCallStore((s) => s.toggleMic);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
  const toggleCaptions = useCallStore((s) => s.toggleCaptions);
  const addReaction = useCallStore((s) => s.addReaction);
  const setMinimized = useCallStore((s) => s.setMinimized);
  const sendCallText = useCallStore((s) => s.sendCallText);
  const hangUp = useCallStore((s) => s.hangUp);
  const profile = useAppStore((s) => s.profile);
  const identity = useIdentityStore((s) => s.identities.find((entry) => entry.id === session?.identityId));
  const navigate = useNavigate();
  const [panel, setPanel] = useState<SidePanel>('none');
  const [nowTs, setNowTs] = useState(0);

  const state = session?.state;
  const isLive = state === 'ringing' || state === 'connecting' || state === 'active' || state === 'reconnecting';

  useEffect(() => {
    if (state !== 'active') return undefined;
    const id = window.setInterval(() => setNowTs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state]);

  if (!session) return <Navigate to="/chat" replace />;

  const selfName = profile.displayName || '我';

  if (session.state === 'ended' || session.state === 'failed') {
    return (
      <main className="call-page is-ended" aria-label="通話結束頁">
        <CallEndSummary session={session} selfName={selfName} />
      </main>
    );
  }

  const minimize = () => {
    setMinimized(true);
    navigate(session.conversationId ? `/chat/${session.conversationId}` : '/chat');
  };

  return (
    <main className={`call-page is-${session.state} is-${session.kind}`} aria-label="擬真通話頁" data-testid="call-page" data-call-state={session.state}>
      {session.state === 'ringing' || session.state === 'connecting' ? (
        <div className="call-ringing" data-testid="call-ringing">
          <CallParticipantTile
            name={session.identityName}
            variant="main"
            cameraOn={session.kind === 'video'}
            portraitAssetId={identity?.callMedia?.callPortraitAssetId}
            cameraOffAssetId={identity?.callMedia?.cameraOffAssetId}
            crop={identity?.callMedia?.crop}
            motionPreset={identity?.callMedia?.motionPreset || 'breathe'}
            speaking
          />
          <h2>{session.identityName}</h2>
          <p role="status">{callStateLabel(session.state)}</p>
          <div className="call-ringing__actions">
            {session.state === 'ringing' && (
              <button type="button" className="call-ringing__answer" onClick={answerCall} data-testid="call-answer">
                接聽
              </button>
            )}
            <button
              type="button"
              className="call-ringing__cancel"
              onClick={() => hangUp('cancelled')}
              aria-label="取消通話"
              data-testid="call-cancel"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className={`call-layout${panel !== 'none' ? ' has-panel' : ''}`}>
          <section className="call-main">
            <header className="call-main__status">
              <span className="call-main__badge" data-testid="call-status">
                {session.state === 'reconnecting'
                  ? callStateLabel('reconnecting')
                  : session.connectedAt && nowTs
                    ? formatDuration(Math.max(0, nowTs - session.connectedAt))
                    : callStateLabel(session.state)}
              </span>
              <span className="call-main__title">{session.identityName} · {session.kind === 'video' ? '影片通話' : '語音通話'}（模擬）</span>
            </header>

            <CallStage session={session} callMedia={identity?.callMedia} selfName={selfName} />

            <div className="call-participant-strip" aria-label="參與者">
              <CallParticipantTile
                name={session.identityName}
                variant="strip"
                speaking={session.aiSpeaking}
                cameraOn={session.kind === 'video'}
                portraitAssetId={identity?.callMedia?.callPortraitAssetId}
                cameraOffAssetId={identity?.callMedia?.cameraOffAssetId}
                motionPreset={identity?.callMedia?.motionPreset || 'breathe'}
              />
              <CallParticipantTile name={selfName} variant="strip" isSelf cameraOn={session.cameraOn && session.kind === 'video'} />
            </div>

            <CallControls
              micOn={session.micOn}
              cameraOn={session.cameraOn}
              speakerOn={session.speakerOn}
              captionsOn={session.captionsOn}
              isVideo={session.kind === 'video'}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              onToggleSpeaker={toggleSpeaker}
              onToggleCaptions={toggleCaptions}
              onBackground={() => setPanel(panel === 'media' ? 'none' : 'media')}
              onReaction={() => addReaction('heart')}
              onShare={() => setPanel(panel === 'share' ? 'none' : 'share')}
              onMinimize={minimize}
              onHangUp={() => hangUp('user')}
            />

            <button
              type="button"
              className="call-transcript-toggle"
              onClick={() => setPanel(panel === 'transcript' ? 'none' : 'transcript')}
              aria-expanded={panel === 'transcript'}
              data-testid="call-transcript-toggle"
            >
              {panel === 'transcript' ? '收起字幕與訊息' : '字幕與訊息'}
            </button>
          </section>

          {panel !== 'none' && (
            <aside className="call-side" data-testid="call-side-panel">
              {panel === 'transcript' && (
                <div className="call-side__transcript">
                  <header className="call-side__head">
                    <h3>字幕與訊息</h3>
                    <button type="button" onClick={() => setPanel('none')} aria-label="關閉字幕面板">
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
                    </button>
                  </header>
                  <CallTranscript transcript={session.transcript} identityName={session.identityName} selfName={selfName} />
                  <CallTextComposer disabled={!isLive || session.state !== 'active'} onSend={sendCallText} />
                </div>
              )}
              {panel === 'share' && <CallContextDrawer onClose={() => setPanel('none')} />}
              {panel === 'media' && (
                <IdentityCallMediaSheet
                  identityId={session.identityId}
                  identityName={session.identityName}
                  onClose={() => setPanel('none')}
                />
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
