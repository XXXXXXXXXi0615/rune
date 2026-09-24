import { useEffect, useRef } from 'react';
import type { CallTranscriptEntry } from '@/types';

interface CallTranscriptProps {
  transcript: CallTranscriptEntry[];
  identityName: string;
  selfName: string;
}

function formatTime(at: number) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function CallTranscript({ transcript, identityName, selfName }: CallTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [transcript.length]);

  return (
    <div className="call-transcript" role="log" aria-label="通話逐字稿" data-testid="call-transcript">
      {transcript.length === 0 && <p className="call-transcript__empty">逐字稿會在你們開始說話後出現。</p>}
      {transcript.map((entry) => (
        <div key={entry.id} className={`call-transcript__entry is-${entry.speaker}`}>
          <span className="call-transcript__meta">
            {entry.speaker === 'me' ? selfName : identityName} · {formatTime(entry.at)}
          </span>
          <p>{entry.text}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
