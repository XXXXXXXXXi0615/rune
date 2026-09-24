import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMusicStore } from '@/store/musicStore';
import { parseLRC, findCurrentLine, type LyricLine } from '@/utils/lrcParser';

export function LyricsPane({ trackId, title }: { trackId: string; title: string }) {
  const currentTime = useMusicStore((s) => s.currentTime);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const seek = useMusicStore((s) => s.seek);

  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [lyricStatus, setLyricStatus] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading');
  const [lyricText, setLyricText] = useState<string>('');
  const [userScrolling, setUserScrolling] = useState(false);
  const [showBackToCurrent, setShowBackToCurrent] = useState(false);
  const [quotaError, setQuotaError] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedLyrics = useRef(false);

  const currentIdx = useMemo(() => findCurrentLine(lyricLines, currentTime), [lyricLines, currentTime]);

  const lyricsKey = trackId ? `lunartide_lyrics_${trackId}` : '';

  const safeSetLyrics = useCallback((text: string): boolean => {
    if (!lyricsKey) return false;
    try {
      localStorage.setItem(lyricsKey, text);
      return true;
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        setQuotaError(true);
      }
      return false;
    }
  }, [lyricsKey]);

  useEffect(() => {
    setLyricLines([]);
    setLyricStatus('loading');
    setLyricText('');
    hasLoadedLyrics.current = false;
    setUserScrolling(false);
    setShowBackToCurrent(false);
    setQuotaError(false);

    if (!lyricsKey) { setLyricStatus('empty'); return; }

    try {
      const raw = localStorage.getItem(lyricsKey);
      if (raw) {
        const parsed = parseLRC(raw);
        if (parsed.length > 0) {
          setLyricLines(parsed);
          setLyricText(raw);
          setLyricStatus('ready');
          hasLoadedLyrics.current = true;
          return;
        }
        const textOnly = raw.trim();
        if (textOnly && !textOnly.match(/\[\d+:/)) {
          setLyricText(textOnly);
          setLyricLines(textOnly.split(/\r?\n/).filter(Boolean).map((t, i) => ({ time: -1, text: t.trim() })));
          setLyricStatus('ready');
          hasLoadedLyrics.current = true;
          return;
        }
        setLyricStatus('error');
      } else {
        setLyricStatus('empty');
      }
    } catch {
      setLyricStatus('error');
    }
  }, [trackId]);

  useEffect(() => {
    if (!activeLineRef.current || userScrolling || lyricLines.length === 0) return;
    if (currentIdx < 0) return;
    activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIdx, userScrolling, lyricLines.length]);

  const handleScroll = useCallback(() => {
    setUserScrolling(true);
    setShowBackToCurrent(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setUserScrolling(false);
      setShowBackToCurrent(false);
      if (currentIdx >= 0 && activeLineRef.current) {
        activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 3000);
  }, [currentIdx]);

  const handleLineClick = useCallback((timeMs: number) => {
    if (timeMs >= 0) seek(timeMs);
  }, [seek]);

  const handleBackToCurrent = useCallback(() => {
    setUserScrolling(false);
    setShowBackToCurrent(false);
    if (currentIdx >= 0 && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIdx]);

  const handleImportLRC = useCallback(() => { lrcInputRef.current?.click(); }, []);

  const handleLRCFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseLRC(text);
      if (parsed.length === 0) {
        setLyricStatus('error');
        return;
      }
      if (!safeSetLyrics(text)) return;
      setLyricLines(parsed);
      setLyricText(text);
      setLyricStatus('ready');
      hasLoadedLyrics.current = true;
    };
    reader.onerror = () => setLyricStatus('error');
    reader.readAsText(file);
  }, [trackId, safeSetLyrics]);

  const handlePasteLyrics = useCallback(() => {
    const text = prompt('請貼上歌詞（支援 LRC 格式或純文字）：');
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    const parsed = parseLRC(trimmed);
    if (parsed.length === 0) {
      if (!safeSetLyrics(trimmed)) return;
      setLyricText(trimmed);
      setLyricLines(trimmed.split(/\r?\n/).filter(Boolean).map((t, i) => ({ time: -1, text: t.trim() })));
      setLyricStatus('ready');
      hasLoadedLyrics.current = true;
      return;
    }
    if (!safeSetLyrics(trimmed)) return;
    setLyricLines(parsed);
    setLyricText(trimmed);
    setLyricStatus('ready');
    hasLoadedLyrics.current = true;
  }, [trackId]);

  const handleClearLyrics = useCallback(() => {
    if (lyricsKey) {
      try { localStorage.removeItem(lyricsKey); } catch {}
    }
    setLyricLines([]);
    setLyricText('');
    setLyricStatus('empty');
    hasLoadedLyrics.current = false;
    setQuotaError(false);
  }, [lyricsKey]);

  if (quotaError) {
    return (
      <div className="im-lyrics-pane">
        <div className="lyrics-error">
          <h3>歌詞儲存空間不足</h3>
          <p>請清理瀏覽器儲存空間後再試。</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="im-lyrics-btn" onClick={() => setQuotaError(false)}>關閉</button>
          </div>
        </div>
      </div>
    );
  }

  if (lyricStatus === 'loading') {
    return (
      <div className="im-lyrics-pane">
        <div className="lyrics-loading"><p>正在整理歌詞…</p></div>
      </div>
    );
  }

  if (lyricStatus === 'error') {
    return (
      <div className="im-lyrics-pane">
        <div className="lyrics-error">
          <h3>無法讀取這份歌詞</h3>
          <p>請重新選擇檔案，或貼上有效 LRC 歌詞內容。</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="im-lyrics-btn primary" onClick={handleImportLRC}>重新選擇檔案</button>
            <button className="im-lyrics-btn" onClick={handlePasteLyrics}>貼上歌詞</button>
            <button className="im-lyrics-btn" onClick={handleClearLyrics}>清除歌詞</button>
          </div>
        </div>
        <input ref={lrcInputRef} type="file" accept=".lrc,.txt,text/plain" hidden onChange={handleLRCFile} />
      </div>
    );
  }

  if (lyricStatus === 'empty') {
    return (
      <div className="im-lyrics-pane">
        <div className="im-lyrics-empty">
          <h3>這首音訊還沒有歌詞</h3>
          <p>匯入 LRC 歌詞檔案或貼上歌詞內容。</p>
          <div className="im-lyrics-empty-actions">
            <button className="im-lyrics-btn primary" onClick={handleImportLRC}>匯入 LRC</button>
            <button className="im-lyrics-btn" onClick={handlePasteLyrics}>貼上歌詞</button>
          </div>
        </div>
        <input ref={lrcInputRef} type="file" accept=".lrc,.txt,text/plain" hidden onChange={handleLRCFile} />
      </div>
    );
  }

  const isSynced = lyricLines.some(l => l.time >= 0);

  return (
    <div className="im-lyrics-pane">
      {showBackToCurrent && isSynced && (
        <div className="im-lyrics-back-to-current">
          <button onClick={handleBackToCurrent}>回到目前歌詞</button>
        </div>
      )}
      <div className="im-lyrics-inner" ref={lyricsScrollRef} onScroll={handleScroll}>
        {lyricLines.map((line, idx) => (
          <div
            key={`${idx}-${line.time}`}
            ref={idx === currentIdx ? activeLineRef : undefined}
            className={`im-lyrics-line${idx === currentIdx ? ' active' : ''}`}
            onClick={() => handleLineClick(line.time)}
          >
            {line.text}
          </div>
        ))}
      </div>
      {hasLoadedLyrics.current && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', gap: 8 }}>
          <button className="im-lyrics-btn" onClick={handleImportLRC} style={{ fontSize: 11 }}>匯入 LRC</button>
          <button className="im-lyrics-btn" onClick={handlePasteLyrics} style={{ fontSize: 11 }}>貼上歌詞</button>
          <button className="im-lyrics-btn" onClick={handleClearLyrics} style={{ fontSize: 11 }}>清除歌詞</button>
        </div>
      )}
      <input ref={lrcInputRef} type="file" accept=".lrc,.txt,text/plain" hidden onChange={handleLRCFile} />
    </div>
  );
}
