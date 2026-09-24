import { Link } from 'react-router-dom';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { CURRENT_USER_MOMENT_AUTHOR_ID, type MomentAuthorId, type MomentComment, type MomentPost } from '@/features/moments/domain';
import { selectMomentComments } from '@/features/moments/selectors';
import { useAppStore, selectAgentProfile } from '@/store/useAppStore';
import { MomentMediaGrid } from './MomentMediaGrid';

function formatMomentTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function useMomentAuthor(authorId: MomentAuthorId) {
  const profile = useAppStore((state) => state.profile);
  const userName = useAppStore((state) => state.userName || '使用者');
  const partner = useAppStore((state) => state.partner);
  if (authorId === CURRENT_USER_MOMENT_AUTHOR_ID) {
    const displayName = profile.displayName || userName;
    return { displayName, avatarImage: profile.avatarImage, initial: profile.avatarInitial || displayName.charAt(0), color: profile.avatarColor || 'user' };
  }
  const agent = selectAgentProfile(partner);
  return { displayName: agent.displayName, avatarImage: agent.avatarImage, initial: agent.avatarInitial, color: agent.avatarColor };
}

function MomentCommentRow({ comment, onReply, onDelete }: { comment: MomentComment; onReply: (comment: MomentComment, trigger: HTMLElement) => void; onDelete: (comment: MomentComment, trigger: HTMLElement) => void }) {
  const author = useMomentAuthor(comment.authorId);
  const target = useMomentAuthor(comment.replyToAuthorId ?? comment.authorId);
  return (
    <div className="moment-comment-row" data-comment-id={comment.id}>
      <p><strong>{author.displayName}</strong>{comment.parentCommentId && <><span> 回覆 </span><strong>{target.displayName}</strong></>}<span>：{comment.text}</span></p>
      <div><button type="button" onClick={(event) => onReply(comment, event.currentTarget)}>回覆</button><button type="button" onClick={(event) => onDelete(comment, event.currentTarget)}>刪除</button></div>
    </div>
  );
}

export function MomentPostCard({ post, comments, detail = false, onLike, onComment, onReply, onDeletePost, onEditPost, onDeleteComment }: {
  post: MomentPost;
  comments: MomentComment[];
  detail?: boolean;
  onLike: (post: MomentPost) => void;
  onComment: (post: MomentPost, trigger: HTMLElement) => void;
  onReply: (post: MomentPost, comment: MomentComment, trigger: HTMLElement) => void;
  onDeletePost: (post: MomentPost, trigger: HTMLElement) => void;
  onEditPost?: (post: MomentPost, trigger: HTMLElement) => void;
  onDeleteComment: (comment: MomentComment, trigger: HTMLElement) => void;
}) {
  const author = useMomentAuthor(post.authorId);
  const currentUser = useMomentAuthor(CURRENT_USER_MOMENT_AUTHOR_ID);
  const currentAgent = useMomentAuthor('agent:current');
  const postComments = selectMomentComments(post, comments);
  const liked = post.likedBy.includes(CURRENT_USER_MOMENT_AUTHOR_ID);
  return (
    <article className={`moment-post${detail ? ' is-detail' : ''}`} data-post-id={post.id}>
      <AvatarImage avatarConfig={author.avatarImage} fallbackInitial={author.initial} initial={author.initial} color={author.color} size={42} label={author.displayName} />
      <div className="moment-post-content">
        <header><strong>{author.displayName}</strong><div>{onEditPost && post.authorId === CURRENT_USER_MOMENT_AUTHOR_ID && <button type="button" onClick={(event) => onEditPost(post, event.currentTarget)} aria-label="編輯動態">編輯</button>}<button type="button" onClick={(event) => onDeletePost(post, event.currentTarget)} aria-label="刪除動態">刪除</button></div></header>
        <div className="moment-post-body">
          {post.text && <Link to={`/chat/moments/${post.id}`} aria-label={`查看 ${author.displayName} 的動態詳情`}><p>{post.text}</p></Link>}
          <MomentMediaGrid media={post.media} detail={detail} />
        </div>
        <div className="moment-post-meta"><time dateTime={new Date(post.createdAt).toISOString()}>{formatMomentTime(post.createdAt)}</time>{post.visibility === 'only-me' && <span>僅自己</span>}</div>
        <div className="moment-post-actions" data-pet-safe-region="interactive">
          <button type="button" className={liked ? 'is-active' : ''} aria-pressed={liked} onClick={() => void onLike(post)} aria-label={liked ? '取消讚' : '讚'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15.4 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8C20 15.4 12 20 12 20Z" /></svg><span>{liked ? '取消' : '讚'}</span>
          </button>
          <button type="button" onClick={(event) => onComment(post, event.currentTarget)} aria-label="評論"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H9l-4 3Z" /></svg><span>評論</span></button>
        </div>
        {(post.likedBy.length > 0 || postComments.length > 0) && <div className="moment-interactions">
          {post.likedBy.length > 0 && <p className="moment-likes"><span aria-hidden="true">♡</span>{post.likedBy.map((id) => id === CURRENT_USER_MOMENT_AUTHOR_ID ? currentUser.displayName : currentAgent.displayName).join('、')}</p>}
          {postComments.map((comment) => <MomentCommentRow key={comment.id} comment={comment} onReply={(item, trigger) => onReply(post, item, trigger)} onDelete={onDeleteComment} />)}
        </div>}
      </div>
    </article>
  );
}
