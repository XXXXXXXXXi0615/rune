import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MomentCommentSheet } from '@/components/chat/moments/MomentCommentSheet';
import { MomentConfirmDialog } from '@/components/chat/moments/MomentConfirmDialog';
import { MomentPostCard } from '@/components/chat/moments/MomentPostCard';
import type { MomentComment, MomentPost } from '@/features/moments/domain';
import { useMomentsStore } from '@/features/moments/store';

type DeleteTarget = { kind: 'post'; post: MomentPost } | { kind: 'comment'; comment: MomentComment };

export function ChatMomentDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const posts = useMomentsStore((state) => state.posts);
  const comments = useMomentsStore((state) => state.comments);
  const hydrated = useMomentsStore((state) => state.hydrated);
  const hydrate = useMomentsStore((state) => state.hydrate);
  const toggleLike = useMomentsStore((state) => state.toggleLike);
  const deletePost = useMomentsStore((state) => state.deletePost);
  const deleteComment = useMomentsStore((state) => state.deleteComment);
  const [commentTarget, setCommentTarget] = useState<{ post: MomentPost; replyTo?: MomentComment }>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const post = posts.find((item) => item.id === postId);

  useEffect(() => { void hydrate().catch(() => {}); }, [hydrate]);
  const closeOverlay = useCallback(() => {
    setCommentTarget(undefined);
    setDeleteTarget(undefined);
    window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, []);
  const remember = (element: HTMLElement) => { restoreFocusRef.current = element; };

  return (
    <section className="moment-detail-page" data-testid={hydrated && !post ? 'moment-detail-not-found' : 'moment-detail-page'} data-moment-post-id={postId}>
      <header className="moment-detail-header">
        <Link to="/chat/moments" aria-label="返回朋友圈"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></Link>
        <h1>動態詳情</h1>
      </header>
      {!hydrated && <p className="moments-loading" role="status">正在整理這條動態…</p>}
      {hydrated && post && <MomentPostCard
        post={post} comments={comments} detail
        onLike={(item) => void toggleLike(item.id)}
        onComment={(item, trigger) => { remember(trigger); setCommentTarget({ post: item }); }}
        onReply={(item, replyTo, trigger) => { remember(trigger); setCommentTarget({ post: item, replyTo }); }}
        onDeletePost={(item, trigger) => { remember(trigger); setDeleteTarget({ kind: 'post', post: item }); }}
        onDeleteComment={(item, trigger) => { remember(trigger); setDeleteTarget({ kind: 'comment', comment: item }); }}
      />}
      {hydrated && !post && <div className="moment-detail-empty"><p>找不到這條動態。</p><Link to="/chat/moments">回到朋友圈</Link></div>}
      {commentTarget && <MomentCommentSheet postId={commentTarget.post.id} replyTo={commentTarget.replyTo} replyToName={commentTarget.replyTo ? '這則留言' : undefined} onClose={closeOverlay} />}
      {deleteTarget && <MomentConfirmDialog
        title={deleteTarget.kind === 'post' ? '刪除這條動態？' : '刪除這則留言？'}
        description={deleteTarget.kind === 'post' ? '動態、留言與未被引用的圖片都會從本機移除。' : '只會移除這則留言。'}
        onCancel={closeOverlay}
        onConfirm={async () => {
          if (deleteTarget.kind === 'post') {
            const removed = await deletePost(deleteTarget.post.id);
            if (removed) { navigate('/chat/moments', { replace: true }); return; }
          } else await deleteComment(deleteTarget.comment.id);
          closeOverlay();
        }}
      />}
    </section>
  );
}
