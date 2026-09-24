import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { useCallStore, type ActiveCallSession } from '@/store/useCallStore';
import { CallTranscript } from '@/components/call/CallTranscript';

interface CallEndSummaryProps {
  session: ActiveCallSession;
  selfName: string;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds >= 60) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  return `${seconds} 秒`;
}

function transcriptToText(session: ActiveCallSession, selfName: string) {
  return session.transcript
    .map((entry) => `${entry.speaker === 'me' ? selfName : session.identityName}：${entry.text}`)
    .join('\n');
}

/**
 * End-of-call screen. Persists nothing beyond the CallRecord by default;
 * saving to journal / memory only happens on explicit user action.
 */
export function CallEndSummary({ session, selfName }: CallEndSummaryProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const addJournalWorkspaceEntry = useAppStore((s) => s.addJournalWorkspaceEntry);
  const addMemoryEntry = useAppStore((s) => s.addMemoryEntry);
  const dismissCall = useCallStore((s) => s.dismissCall);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [savedJournal, setSavedJournal] = useState(false);
  const [savedMemory, setSavedMemory] = useState(false);

  const durationMs = session.connectedAt && session.endedAt ? session.endedAt - session.connectedAt : 0;
  const kindLabel = session.kind === 'video' ? '影片通話' : '語音通話';
  const failed = session.state === 'failed';

  const close = () => {
    dismissCall();
    navigate(session.conversationId ? `/chat/${session.conversationId}` : '/chat');
  };

  const saveToJournal = () => {
    if (savedJournal) return;
    const body = transcriptToText(session, selfName);
    addJournalWorkspaceEntry({
      kind: 'diary',
      author: 'user',
      title: `與 ${session.identityName} 的${kindLabel}`,
      content: `通話時長 ${formatDuration(durationMs)}。\n\n${body || '（沒有逐字稿）'}`,
      moodId: undefined,
      tags: ['通話'],
      attachments: [],
      favorite: false,
      pinned: false,
      archived: false,
      aiAccess: 'private',
      source: 'chat',
    });
    setSavedJournal(true);
    showToast('已保存到手記。');
  };

  const saveToMemory = () => {
    if (savedMemory) return;
    addMemoryEntry({
      title: `與 ${session.identityName} 的${kindLabel}`,
      content: transcriptToText(session, selfName) || `通話時長 ${formatDuration(durationMs)}`,
      source: 'chat',
      scene: '通話',
      triggerText: `${kindLabel} · ${formatDuration(durationMs)}`,
      bodyThoughts: '',
      anxietyLevel: 0,
      nextStep: '',
    });
    setSavedMemory(true);
    showToast('已加入記憶。');
  };

  return (
    <div className="call-end-summary" role="dialog" aria-label="通話結束" data-testid="call-end-summary">
      <span className="call-end-summary__avatar" aria-hidden="true">{session.identityName.charAt(0).toUpperCase()}</span>
      <h2>{failed ? '通話失敗' : '通話已結束'}</h2>
      <p className="call-end-summary__meta">
        {session.identityName} · {kindLabel}
        {!failed && ` · ${formatDuration(durationMs)}`}
        {failed && session.endReason ? ` · ${session.endReason}` : ''}
      </p>
      <p className="call-end-summary__stats">
        逐字稿 {session.transcript.length} 句 · 分享內容 {session.sharedContexts.length} 項
      </p>

      <div className="call-end-summary__actions">
        <button type="button" onClick={saveToJournal} disabled={savedJournal} data-testid="call-save-journal">
          {savedJournal ? '已保存到手記' : '保存到手記'}
        </button>
        <button type="button" onClick={saveToMemory} disabled={savedMemory} data-testid="call-save-memory">
          {savedMemory ? '已加入記憶' : '加入記憶'}
        </button>
        <button type="button" onClick={() => setTranscriptOpen((open) => !open)} aria-expanded={transcriptOpen} data-testid="call-view-transcript">
          {transcriptOpen ? '收起逐字稿' : '查看逐字稿'}
        </button>
        <button type="button" className="is-primary" onClick={close} data-testid="call-close-summary">
          關閉
        </button>
      </div>

      {transcriptOpen && (
        <div className="call-end-summary__transcript">
          <CallTranscript transcript={session.transcript} identityName={session.identityName} selfName={selfName} />
        </div>
      )}
    </div>
  );
}
