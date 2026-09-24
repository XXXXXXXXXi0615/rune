import { useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useEchoMemoryWindowStore } from '@/store/useEchoMemoryWindowStore';
import { MemoryIcon } from './VoiceIcons';
import styles from './EchoMemoryWindow.module.css';

interface EchoMemoryWindowProps {
  onSaved: (messageId: string, memoryEntryId: string) => void;
}

function formatDuration(ms?: number): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function parseTags(value: string): string[] {
  return Array.from(new Set(
    value
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean),
  )).slice(0, 6);
}

export function EchoMemoryWindow({ onSaved }: EchoMemoryWindowProps) {
  const isOpen = useEchoMemoryWindowStore((state) => state.isOpen);
  const draft = useEchoMemoryWindowStore((state) => state.draft);
  const position = useEchoMemoryWindowStore((state) => state.position);
  const close = useEchoMemoryWindowStore((state) => state.close);
  const updateDraft = useEchoMemoryWindowStore((state) => state.updateDraft);
  const setPosition = useEchoMemoryWindowStore((state) => state.setPosition);
  const addMemoryEntry = useAppStore((state) => state.addMemoryEntry);
  const updateMemoryEntry = useAppStore((state) => state.updateMemoryEntry);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const tagText = useMemo(() => draft?.tags.join(', ') || '', [draft?.tags]);

  const beginDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  }, [draft, position.x, position.y]);

  const moveDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = 390;
    const height = 480;
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    setPosition({
      x: Math.min(Math.max(margin, drag.originX + event.clientX - drag.startX), maxX),
      y: Math.min(Math.max(margin, drag.originY + event.clientY - drag.startY), maxY),
    });
  }, [setPosition]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!draft) return;
    const transcript = draft.transcript.trim();
    if (!transcript) return;
    const title = draft.title.trim() || 'Undertone · 音訊轉錄';
    const tags = draft.tags.length ? draft.tags : ['undertone', 'voice'];
    const metadata = {
      messageId: draft.messageId,
      fileName: draft.fileName,
      durationMs: draft.durationMs,
      transcriptSource: draft.transcriptSource,
      transcriptEdited: draft.transcriptEdited,
      audioPersistence: draft.audioPersistence,
      audioSaved: false,
      artworkSaved: false,
      persistenceMode: draft.persistenceMode,
      audioLocalOnly: true,
    };

    if (draft.memoryEntryId) {
      updateMemoryEntry(draft.memoryEntryId, {
        title,
        scene: title,
        content: transcript,
        triggerText: transcript,
        bodyThoughts: transcript,
        owner: draft.owner,
        createdBy: 'user',
        source: 'voice',
        type: 'voice-transcript',
        status: 'active',
        tags,
        pinned: false,
        localOnly: true,
        sensitive: false,
        allowAiRecall: draft.allowAiRecall,
        metadata,
      });
      onSaved(draft.messageId, draft.memoryEntryId);
      close();
      return;
    }

    const id = addMemoryEntry({
      scene: title,
      triggerText: transcript,
      bodyThoughts: transcript,
      anxietyLevel: 0,
      nextStep: '',
      title,
      content: transcript,
      owner: draft.owner,
      createdBy: 'user',
      source: 'voice',
      type: 'voice-transcript',
      status: 'active',
      tags,
      pinned: false,
      localOnly: true,
      sensitive: false,
      allowAiRecall: draft.allowAiRecall,
      metadata,
    });
    onSaved(draft.messageId, id);
    close();
  }, [addMemoryEntry, close, draft, onSaved, updateMemoryEntry]);

  if (!isOpen || !draft) return null;

  return (
    <section
      className={styles.window}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      role="dialog"
      aria-modal="false"
      aria-label="Echo Memory"
    >
      <div
        className={styles.titlebar}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.titleIdentity}>
          <span className={styles.icon}><MemoryIcon size={16} /></span>
          <div>
            <strong>Echo Memory</strong>
            <span>把這段聲音收進記憶庫。</span>
          </div>
        </div>
        <button type="button" className={styles.closeButton} onClick={close} aria-label="關閉 Echo Memory">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {draft.transcriptSource === 'mock' && (
          <div className={styles.warning}>這是 mock 轉錄，請先確認內容。</div>
        )}

        <label className={styles.field}>
          <span>標題</span>
          <input
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            placeholder="Undertone · 音訊轉錄"
          />
        </label>

        <label className={styles.field}>
          <span>轉錄文字</span>
          <textarea
            value={draft.transcript}
            onChange={(event) => updateDraft({ transcript: event.target.value, transcriptEdited: true, transcriptSource: 'manual' })}
            rows={6}
            placeholder="貼上或修正這段音訊的文字..."
          />
        </label>

        <label className={styles.field}>
          <span>標籤</span>
          <input
            value={tagText}
            onChange={(event) => updateDraft({ tags: parseTags(event.target.value) })}
            placeholder="undertone, voice"
          />
        </label>

        <div className={styles.segmentGroup} aria-label="記憶歸屬">
          <button
            type="button"
            className={draft.owner === 'user' ? styles.activeSegment : ''}
            onClick={() => updateDraft({ owner: 'user' })}
          >
            我的
          </button>
          <button
            type="button"
            className={draft.owner === 'shared' ? styles.activeSegment : ''}
            onClick={() => updateDraft({ owner: 'shared' })}
          >
            共同
          </button>
        </div>

        <div className={styles.persistenceBox} aria-label="保存策略">
          <span className={styles.persistenceTitle}>保存策略</span>
          <label className={styles.persistenceOption}>
            <input
              type="radio"
              name="echo-persistence-mode"
              checked={draft.persistenceMode === 'transcript-only'}
              onChange={() => updateDraft({ persistenceMode: 'transcript-only', audioPersistence: 'session' })}
            />
            <span>
              <strong>只保存轉錄</strong>
              <small>音訊與封面仍為本次 session 暫存。</small>
            </span>
          </label>
          <label className={`${styles.persistenceOption} ${styles.persistenceOptionDisabled}`}>
            <input
              type="radio"
              name="echo-persistence-mode"
              checked={draft.persistenceMode === 'audio-and-transcript'}
              disabled
              onChange={() => updateDraft({ persistenceMode: 'audio-and-transcript' })}
            />
            <span>
              <strong>保存音訊與轉錄</strong>
              <small>Coming soon · 將使用本機 IndexedDB 保存。</small>
            </span>
          </label>
        </div>

        <label className={styles.switchRow}>
          <span>
            <strong>允許 AI 參考</strong>
            <small>開啟後會計入 AI 可參考記憶。</small>
          </span>
          <input
            type="checkbox"
            checked={draft.allowAiRecall}
            onChange={(event) => updateDraft({ allowAiRecall: event.target.checked })}
          />
        </label>

        <div className={styles.metaGrid}>
          <span>來源：Undertone</span>
          <span>長度：{formatDuration(draft.durationMs)}</span>
          <span>轉錄：{draft.transcriptSource}</span>
          <span>本次暫存</span>
          <span>已保存轉錄</span>
          <span>音訊原檔未保存</span>
        </div>
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.secondaryButton} onClick={close}>取消</button>
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={!draft.transcript.trim()}>
          保存到記憶庫
        </button>
      </footer>
    </section>
  );
}
