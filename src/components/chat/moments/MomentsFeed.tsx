import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MomentComment, MomentPost } from '@/features/moments/domain';
import { selectChronologicalMomentPosts } from '@/features/moments/selectors';
import { useMomentsStore } from '@/features/moments/store';
import { MomentCommentSheet } from './MomentCommentSheet';
import { MomentConfirmDialog } from './MomentConfirmDialog';
import { MomentPostCard } from './MomentPostCard';
import { MomentsComposerSheet } from './MomentsComposerSheet';
import { MomentsBoardProjections } from './MomentsBoardProjections';

type CommentTarget = { post: MomentPost; replyTo?: MomentComment };
type DeleteTarget = { kind: 'post'; post: MomentPost } | { kind: 'comment'; comment: MomentComment };

export function MomentsFeed() {
  const posts = useMomentsStore((state) => state.posts);
  const comments = useMomentsStore((state) => state.comments);
  const hydrated = useMomentsStore((state) => state.hydrated);
  const loading = useMomentsStore((state) => state.loading);
  const error = useMomentsStore((state) => state.error);
  const hydrate = useMomentsStore((state) => state.hydrate);
  const toggleLike = useMomentsStore((state) => state.toggleLike);
  const deletePost = useMomentsStore((state) => state.deletePost);
  const deleteComment = useMomentsStore((state) => state.deleteComment);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<MomentPost>();
  const [commentTarget, setCommentTarget] = useState<CommentTarget>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const feedPosts = useMemo(() => selectChronologicalMomentPosts(posts), [posts]);

  useEffect(() => { void hydrate().catch(() => {}); }, [hydrate]);
  useEffect(() => {
    document.body.classList.add('chat-moments-active');
    return () => document.body.classList.remove('chat-moments-active');
  }, []);
  const rememberTrigger = (trigger: HTMLElement) => { restoreFocusRef.current = trigger; };
  const closeOverlay = useCallback(() => {
    setComposerOpen(false); setEditingPost(undefined); setCommentTarget(undefined); setDeleteTarget(undefined);
    window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, []);
  const openComposer = (trigger: HTMLElement) => { rememberTrigger(trigger); setComposerOpen(true); };

  return (
    <section className="moments-feed" data-testid="moments-feed" aria-busy={loading}>
      <MomentsBoardProjections />
      <div className="moments-feed-toolbar"><p>PRIVATE STREAM</p><button type="button" onClick={(event) => openComposer(event.currentTarget)} aria-label="發一條動態" data-pet-safe-region="interactive"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></div>
      {!hydrated && loading && <p className="moments-loading" role="status">正在整理朋友圈…</p>}
      {error && <p className="moments-load-error" role="alert">朋友圈暫時無法載入：{error}</p>}
      {hydrated && feedPosts.length === 0 && <div className="moments-empty-state">
        <span className="moments-empty-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32"><path d="M7 8.5h18v13H14l-5 4v-4H7z" /><path d="M11 13h10M11 17h7" /></svg>
        </span>
        <div>
          <p className="moments-empty-eyebrow">朋友圈</p>
          <h2>還沒有朋友圈內容</h2>
          <p>把今天想留下的片段放在這裡。</p>
        </div>
        <button type="button" onClick={(event) => openComposer(event.currentTarget)} data-pet-safe-region="interactive">發第一條</button>
      </div>}
      {hydrated && feedPosts.length > 0 && <div className="moments-post-list">{feedPosts.map((post) => <MomentPostCard key={post.id} post={post} comments={comments} onLike={(item) => void toggleLike(item.id)} onComment={(item, trigger) => { rememberTrigger(trigger); setCommentTarget({ post: item }); }} onReply={(item, replyTo, trigger) => { rememberTrigger(trigger); setCommentTarget({ post: item, replyTo }); }} onEditPost={(item, trigger) => { rememberTrigger(trigger); setEditingPost(item); }} onDeletePost={(item, trigger) => { rememberTrigger(trigger); setDeleteTarget({ kind: 'post', post: item }); }} onDeleteComment={(item, trigger) => { rememberTrigger(trigger); setDeleteTarget({ kind: 'comment', comment: item }); }} />)}</div>}
      {composerOpen && <MomentsComposerSheet onClose={closeOverlay} />}
      {editingPost && <MomentsComposerSheet post={editingPost} onClose={closeOverlay} />}
      {commentTarget && <MomentCommentSheet postId={commentTarget.post.id} replyTo={commentTarget.replyTo} replyToName={commentTarget.replyTo ? '這則留言' : undefined} onClose={closeOverlay} />}
      {deleteTarget && <MomentConfirmDialog title={deleteTarget.kind === 'post' ? '刪除這條動態？' : '刪除這則留言？'} description={deleteTarget.kind === 'post' ? '動態、留言與未被引用的圖片都會從本機移除。' : '只會移除這則留言。'} onCancel={closeOverlay} onConfirm={async () => { if (deleteTarget.kind === 'post') await deletePost(deleteTarget.post.id); else await deleteComment(deleteTarget.comment.id); closeOverlay(); }} />}
    </section>
  );
}
