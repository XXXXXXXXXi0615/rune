import { useEffect, useRef, useState } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import type { MomentComment } from '@/features/moments/domain';
import { useMomentsStore } from '@/features/moments/store';

export function MomentCommentSheet({ postId, replyTo, replyToName, onClose }: { postId: string; replyTo?: MomentComment; replyToName?: string; onClose: () => void }) {
  const addComment = useMomentsStore((state) => state.addComment);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, sending]);

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true); setError('');
    try { await addComment(postId, text, replyTo?.id); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '留言失敗'); setSending(false); }
  };

  return (
    <MobileShellOverlay variant="dialog" onClose={() => { if (!sending) onClose(); }} className="moments-overlay">
      <section className="moment-comment-sheet" role="dialog" aria-modal="true" aria-labelledby="moment-comment-title" data-pet-safe-region="interactive">
        <header><button type="button" onClick={onClose} disabled={sending}>取消</button><h2 id="moment-comment-title">{replyTo ? `回覆 ${replyToName || '留言'}` : '留下評論'}</h2><button type="button" className="is-primary" onClick={submit} disabled={sending || !text.trim()}>{sending ? '送出中' : '送出'}</button></header>
        <textarea ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} placeholder={replyTo ? `回覆 ${replyToName || '這則留言'}…` : '寫下你的回應…'} aria-label={replyTo ? '回覆內容' : '評論內容'} maxLength={1000} />
        {error && <p className="moments-form-error" role="alert">{error}</p>}
      </section>
    </MobileShellOverlay>
  );
}
