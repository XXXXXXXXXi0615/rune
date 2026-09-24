/**
 * TIDEWATCH — message telemetry subscription.
 *
 * React hook that watches useAppStore messages and automatically records
 * writing telemetry events. No raw text is persisted.
 *
 * User messages: inputChars = committedChars = grapheme count of content.
 * Agent messages: inputChars = 0, committedChars = grapheme count of content.
 *
 * Each message is tracked by its ID (sourceId deduplication).
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useWritingTelemetryStore } from './writingTelemetryStore';
import { emitWritingActivity } from './activityLedgerStore';
import { countWritingGraphemes } from '@/utils/countWritingGraphemes';
import type { Message } from '@/types';

function isTextMessage(msg: Message): msg is Message & { type: 'text'; content: string } {
  return msg.type === 'text' && 'content' in msg && typeof (msg as { content?: unknown }).content === 'string';
}

/**
 * Install the message telemetry subscription.
 * Call once at app root (App.tsx).
 */
export function useMessageTelemetrySubscription() {
  const messages = useAppStore((s) => s.messages);
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!messages) return;

    for (const msg of messages) {
      if (processedRef.current.has(msg.id)) continue;
      processedRef.current.add(msg.id);

      if (!isTextMessage(msg)) continue;
      if (!msg.content) continue;

      const chars = countWritingGraphemes(msg.content);

      if (msg.sender === 'me') {
        // User message — check sourceId dedup
        const { todayEvents } = useWritingTelemetryStore.getState();
        if (todayEvents.some((e) => e.sourceId === msg.id)) continue;

        useWritingTelemetryStore.getState().recordEvent({
          actor: 'user',
          surface: 'chat',
          inputChars: chars,
          committedChars: chars,
          sourceId: msg.id,
        });
        emitWritingActivity('chat', chars);
      } else if (msg.sender === 'assistant') {
        // Agent message — count finalized output once
        const { todayEvents } = useWritingTelemetryStore.getState();
        if (todayEvents.some((e) => e.sourceId === msg.id)) continue;

        useWritingTelemetryStore.getState().recordEvent({
          actor: 'agent',
          surface: 'chat',
          inputChars: 0,
          committedChars: chars,
          sourceId: msg.id,
        });
        emitWritingActivity('chat', chars);
      }
    }
  }, [messages]);
}
