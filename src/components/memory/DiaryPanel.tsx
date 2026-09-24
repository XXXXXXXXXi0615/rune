import { useEffect, useMemo, useState, type FormEvent, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { ForumPost, ForumReply, ForumPostAuthor, ForumNotification } from '@/types';
import type { ChatMessage } from '@/ai/types';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { resolveActiveProvider, resolveProviderRequestConfig } from '@/ai/providerRuntime';
import { sendChatMessage } from '@/ai/client';
import { estimateCost } from '@/ai/costCalculator';
import { useToastStore } from '@/store/useToastStore';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ReplyCard } from '@/components/ui/ReplyCard';
import { WheelPicker } from '@/components/ClawdWorkspace/WheelPicker';
import { t } from '@/i18n';
import type { AvatarImageMeta } from '@/types';
import { estimateAnxietyScore } from '@/ai/anxietyEstimator';
import '@/styles/moon-focus.css';

type ForumFilter = 'all' | 'mine' | 'luna' | 'locked' | 'scheduled';

interface ReplyingTo {
  postId: string;
  parentReplyId?: string;
  replyToName: string;
  replyToId?: string;
  replyToContent?: string;
  replyToAuthor?: ForumPostAuthor;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes}分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function InlineReplyComposer({ postId, parentReplyId, replyToName, replyToData, onClose }: {
  postId: string;
  parentReplyId?: string;
  replyToName: string;
  replyToData?: { id: string; content: string; author: ForumPostAuthor };
  onClose: () => void;
}) {
  const addForumReply = useAppStore((s) => s.addForumReply);
  const [text, setText] = useState('');
  const profileName = useAppStore((s) => s.profile.displayName || 'shuri');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addForumReply({
      postId,
      parentReplyId,
      author: 'user',
      content: trimmed,
      ...(replyToData ? {
        replyTo: {
          id: replyToData.id,
          content: replyToData.content,
          author: replyToData.author,
        },
      } : {}),
    });
    setText('');
    onClose();
  };

  return (
    <form className="forum-reply-composer inline" onSubmit={handleSubmit}>
      <div className="forum-reply-composer-inner">
        <input className="forum-reply-input" type="text" value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`回覆 ${replyToName}...`} autoFocus />
      </div>
      <div className="forum-reply-composer-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
        <button type="submit" className="btn-primary" disabled={!text.trim()}>{t('forum.sendReply')}</button>
      </div>
    </form>
  );
}

function formatScheduledTime(ts: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

function ForumNotificationSheet({ notifications, profileName, onSelect, onClose }: {
  notifications: ForumNotification[];
  profileName: string;
  onSelect: (id: string, postId: string, replyId: string) => void;
  onClose: () => void;
}) {
  const authorName = (author: ForumPostAuthor) =>
    author === 'luna' ? 'LUNARIS' : profileName;

  const label = (n: ForumNotification) => {
    if (n.type === 'mention') return t('forum.notifMentioned');
    if (n.type === 'quote') return `${authorName(n.fromAuthor)} ${t('forum.notifQuoted')}`;
    return `${authorName(n.fromAuthor)} ${t('forum.notifReplied')}`;
  };

  return createPortal(
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet forum-notif-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{t('forum.notifTitle')}</span>
        </div>
        <div className="forum-notif-list">
          {notifications.length === 0 ? (
            <div className="forum-notif-empty">{t('forum.notifEmpty')}</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`forum-notif-item ${n.read ? 'read' : ''}`}
                onClick={() => onSelect(n.id, n.postId, n.replyId)}
              >
                <div className="forum-notif-item-left">
                  <div className="forum-notif-item-text">
                    <span className="forum-notif-item-label">{label(n)}</span>
                    {n.contentPreview && (
                      <span className="forum-notif-item-preview">{n.contentPreview}</span>
                    )}
                  </div>
                </div>
                <span className="forum-notif-item-time">{formatTimeAgo(n.createdAt)}</span>
                {!n.read && <span className="forum-notif-unread-dot" />}
              </button>
            ))
          )}
        </div>
        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ScheduleSheet({ currentText, onConfirm, onClose }: {
  currentText: string;
  onConfirm: (ts: number) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState(now.getHours() + 1 > 23 ? 23 : now.getHours() + 1);
  const [minute, setMinute] = useState(0);

  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  targetDate.setHours(hour, minute, 0, 0);
  const scheduledMs = targetDate.getTime();

  return createPortal(
    <div className="confirm-sheet-overlay active" onClick={onClose}>
      <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="confirm-sheet-body">
          <p className="confirm-sheet-text" style={{ marginBottom: 4 }}>{t('forum.scheduleAt')}</p>
          <p className="schedule-preview-text">{formatScheduledTime(scheduledMs)}</p>
          <div className="mf-wheel-row">
            <WheelPicker value={dayOffset} min={0} max={30} step={1} unit={t('forum.scheduleDateUnit')} onChange={setDayOffset} />
            <WheelPicker value={hour} min={0} max={23} step={1} unit={t('forum.scheduleHourUnit')} onChange={setHour} />
            <WheelPicker value={minute} min={0} max={59} step={5} unit={t('forum.scheduleMinuteUnit')} onChange={setMinute} />
          </div>
        </div>
        <div className="confirm-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(scheduledMs)}
            disabled={scheduledMs <= Date.now() - 60000}>
            {t('forum.scheduleConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DraftSheet({ drafts, onEdit, onPublish, onSchedule, onDelete, onClose }: {
  drafts: ForumPost[];
  onEdit: (post: ForumPost) => void;
  onPublish: (post: ForumPost) => void;
  onSchedule: (post: ForumPost) => void;
  onDelete: (post: ForumPost) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet forum-draft-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{t('forum.draftTitle')}</span>
        </div>
        <div className="forum-draft-list">
          {drafts.length === 0 ? (
            <div className="forum-notif-empty">{t('forum.draftEmpty')}</div>
          ) : (
            drafts.map((d) => (
              <div key={d.id} className="forum-draft-item">
                <div className="forum-draft-item-content">
                  <div className="forum-draft-item-text">{d.content}</div>
                  <span className="forum-draft-item-time">{formatTimeAgo(d.createdAt)}</span>
                </div>
                <div className="forum-draft-item-actions">
                  <button type="button" className="btn-ghost" onClick={() => onEdit(d)}>{t('forum.edit')}</button>
                  <button type="button" className="btn-ghost" onClick={() => onPublish(d)}>{t('forum.publish')}</button>
                  <button type="button" className="btn-ghost" onClick={() => onSchedule(d)}>{t('forum.schedule')}</button>
                  <button type="button" className="btn-ghost forum-danger" onClick={() => onDelete(d)}>{t('forum.delete')}</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DiaryPanel({ scrollToPostId, onScrollDone }: { scrollToPostId?: string | null; onScrollDone?: () => void }) {
  const forumPosts = useAppStore((s) => s.forumPosts || []);
  const forumReplies = useAppStore((s) => s.forumReplies || []);
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const addForumPost = useAppStore((s) => s.addForumPost);
  const updateForumPost = useAppStore((s) => s.updateForumPost);
  const deleteForumPost = useAppStore((s) => s.deleteForumPost);
  const toggleForumLike = useAppStore((s) => s.toggleForumLike);
  const toggleForumBookmark = useAppStore((s) => s.toggleForumBookmark);
  const addForumReply = useAppStore((s) => s.addForumReply);
  const updateForumReply = useAppStore((s) => s.updateForumReply);
  const deleteForumReply = useAppStore((s) => s.deleteForumReply);
  const showToast = useToastStore((s) => s.showToast);
  const forumNotifications = useAppStore((s) => s.forumNotifications || []);
  const clearForumNotifications = useAppStore((s) => s.clearForumNotifications);
  const markForumNotificationRead = useAppStore((s) => s.markForumNotificationRead);
  const addForumNotification = useAppStore((s) => s.addForumNotification);
  const navigate = useNavigate();

  const unreadNotifCount = useMemo(() => forumNotifications.filter((n) => !n.read).length, [forumNotifications]);

  const scrollToReply = useCallback((targetId: string) => {
    const el = document.getElementById(`forum-reply-${targetId}`) || document.getElementById(`forum-post-${targetId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const providers = useAppStore((s) => s.providers || []);
  const enableForumAiReplies = useAppStore((s) => s.enableForumAiReplies ?? false);
  const providerState = resolveActiveProvider(providers);
  const hasAi = providerState.configured;

  const [filter, setFilter] = useState<ForumFilter>('all');
  const [composerText, setComposerText] = useState('');
  const [moreOpen, setMoreOpen] = useState<string | null>(null);
  const [replyMoreOpen, setReplyMoreOpen] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ForumPost | null>(null);
  const [pendingDeleteReply, setPendingDeleteReply] = useState<ForumReply | null>(null);

  /* Click-outside / Escape for post more menu */
  useEffect(() => {
    if (!moreOpen && !replyMoreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMoreOpen(null); setReplyMoreOpen(null); }
    };
    const onClick = (e: MouseEvent) => {
      const menu = document.querySelector('.forum-more-menu');
      const btn = (e.target as Element)?.closest?.('.forum-more-btn');
      if (menu && !menu.contains(e.target as Node) && !btn) { setMoreOpen(null); setReplyMoreOpen(null); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [moreOpen, replyMoreOpen]);

  /* Auto-publish scheduled posts */
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const posts = useAppStore.getState().forumPosts || [];
      for (const post of posts) {
        if (post.status === 'scheduled' && post.scheduledOpenAt && post.scheduledOpenAt <= now) {
          updateForumPost(post.id, { status: 'normal' });
        }
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [updateForumPost]);

  /* Scroll to target post from bookmark navigation */
  useEffect(() => {
    if (!scrollToPostId) return;
    // Delay to allow DOM to render
    const timer = setTimeout(() => {
      const el = document.getElementById(`forum-post-${scrollToPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight
        el.style.transition = 'box-shadow 0.3s ease';
        el.style.boxShadow = '0 0 0 3px var(--accent)';
        setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      }
      onScrollDone?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [scrollToPostId, onScrollDone]);

  /* User-only posts sorted newest-first */
  const userPosts = useMemo(
    () => forumPosts.filter((p) => p.author === 'user' && p.status !== 'draft').sort((a, b) => b.createdAt - a.createdAt),
    [forumPosts],
  );

  /* Bookmarked post IDs from MemoryEntry (forum_bookmark) for consistent state */
  const bookmarkedPostIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of memoryEntries) {
      if (entry.cardType === 'forum_bookmark' && entry.linkedForumPostId) {
        set.add(entry.linkedForumPostId);
      }
    }
    return set;
  }, [memoryEntries]);

  const filtered = useMemo(() => {
    if (filter === 'all') return userPosts;
    if (filter === 'mine') return userPosts;
    if (filter === 'luna') return userPosts.filter((p) =>
      forumReplies.some((r) => r.postId === p.id && r.author === 'luna'),
    );
    if (filter === 'locked') return userPosts.filter((p) => p.status === 'locked');
    if (filter === 'scheduled') return userPosts.filter((p) => p.status === 'scheduled');
    return userPosts;
  }, [userPosts, filter, forumReplies]);

  /* Check if today's memory mood content is available */
  const hasJournalContent = useMemo(() => {
    const latest = [...memoryEntries].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest) return false;
    return !!(latest.summary || latest.scene || latest.bodyThoughts);
  }, [memoryEntries]);

  const userAvatar = {
    image: profile.avatarImage,
    initial: (profile.avatarInitial || profile.displayName || 'S').charAt(0).toUpperCase(),
    color: profile.avatarColor || 'user',
  };
  const lunaAvatar = {
    image: partner.avatarImage,
    initial: (partner.avatarInitial || selectPartnerDisplayName(partner) || 'L').charAt(0).toUpperCase(),
    color: partner.avatarColor || 'char',
  };
  const profileName = profile.displayName || 'shuri';

  /* Group replies by post and nesting level */
  const repliesByPost = useMemo(() => {
    const map = new Map<string, { direct: ForumReply[]; byParent: Map<string, ForumReply[]> }>();
    for (const reply of forumReplies) {
      if (!map.has(reply.postId)) map.set(reply.postId, { direct: [], byParent: new Map() });
      const group = map.get(reply.postId)!;
      if (reply.parentReplyId) {
        if (!group.byParent.has(reply.parentReplyId)) group.byParent.set(reply.parentReplyId, []);
        group.byParent.get(reply.parentReplyId)!.push(reply);
      } else {
        group.direct.push(reply);
      }
    }
    for (const [, group] of map) {
      group.direct.sort((a, b) => a.createdAt - b.createdAt);
      for (const [, children] of group.byParent) children.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [forumReplies]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [postActionOpen, setPostActionOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftToSchedule, setDraftToSchedule] = useState<ForumPost | null>(null);

  const handleNotifSelect = (id: string, postId: string, replyId: string) => {
    markForumNotificationRead(id);
    const targetId = replyId || postId;
    // Close sheet, then scroll after DOM updates
    setNotifOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`forum-reply-${targetId}`) || document.getElementById(`forum-post-${targetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handlePost = () => {
    const trimmed = composerText.trim();
    if (!trimmed) return;
    addForumPost({ author: 'user', content: trimmed, status: 'normal' });
    setComposerText('');
    showToast(t('forum.posted'));
  };

  const handleScheduleConfirm = (scheduledAt: number) => {
    const trimmed = composerText.trim();
    if (!trimmed) return;
    addForumPost({ author: 'user', content: trimmed, status: 'scheduled', scheduledOpenAt: scheduledAt });
    setComposerText('');
    setScheduleOpen(false);
    showToast(t('forum.postScheduled'));
  };

  const handleDraftScheduleConfirm = (scheduledAt: number) => {
    if (!draftToSchedule) return;
    updateForumPost(draftToSchedule.id, { status: 'scheduled', scheduledOpenAt: scheduledAt });
    setDraftToSchedule(null);
    setDraftOpen(false);
    showToast(t('forum.postScheduled'));
  };

  const drafts = useMemo(
    () => forumPosts.filter((p) => p.author === 'user' && p.status === 'draft').sort((a, b) => b.createdAt - a.createdAt),
    [forumPosts],
  );

  const handleDraftEdit = (post: ForumPost) => {
    setComposerText(post.content);
    deleteForumPost(post.id);
    setDraftOpen(false);
    showToast(t('forum.draftSaved'));
    // Focus the composer textarea
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('.forum-composer-textarea')?.focus(), 100);
  };

  const handleDraftPublish = (post: ForumPost) => {
    updateForumPost(post.id, { status: 'normal' });
    setDraftOpen(false);
    showToast(t('forum.draftPublished'));
  };

  const handleDraftSchedule = (post: ForumPost) => {
    setDraftToSchedule(post);
    setScheduleOpen(true);
  };

  const handleDraftDelete = (post: ForumPost) => {
    deleteForumPost(post.id);
    showToast(t('forum.draftDeleted'));
  };

  const handleForumLike = (post: ForumPost) => {
    toggleForumLike(post.id, profileName);
    // Luna auto-like for hot posts
    const newCount = (post.likes || []).includes(profileName)
      ? (post.likes || []).length - 1
      : (post.likes || []).length + 1;
    if (!(post.likes || []).includes(profileName) && newCount > 10 && !(post.likes || []).includes('luna')) {
      if (Math.random() < 0.2) {
        setTimeout(() => {
          const s = useAppStore.getState();
          const p = (s.forumPosts || []).find((fp) => fp.id === post.id);
          if (p && !(p.likes || []).includes('luna')) {
            updateForumPost(post.id, { likes: [...(p.likes || []), 'luna'] });
            addForumReply({
              postId: post.id,
              author: 'luna',
              content: t('forum.lunaLikedHot'),
            });
            showToast('🌙 Luna 也來共鳴了');
          }
        }, 1200 + Math.random() * 2000);
      }
    }
  };

  const handleFromJournal = () => {
    const latest = [...memoryEntries].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (latest) {
      setComposerText(latest.summary || latest.scene || latest.bodyThoughts || '');
    }
  };

  /* Luna reply — emotion-based probability + AI provider / local mock */
  const handleLunaReplyOnPost = (post: ForumPost) => {
    const { score } = estimateAnxietyScore(post.content);
    const baseProb = 0.3;
    const emotionBoost = Math.min(score / 10, 0.4);
    const rand = Math.random();
    if (rand > baseProb + emotionBoost) {
      showToast(t('forum.lunaSkip'));
      return;
    }
    doLunaReply(post.content, post.id);
  };

  const handleLunaReplyOnReply = (reply: ForumReply) => {
    const { score } = estimateAnxietyScore(reply.content);
    const baseProb = 0.3;
    const emotionBoost = Math.min(score / 10, 0.4);
    const rand = Math.random();
    if (rand > baseProb + emotionBoost) {
      showToast(t('forum.lunaSkip'));
      return;
    }
    doLunaReply(reply.content, reply.postId, reply.id);
  };

  const doLunaReply = async (context: string, postId: string, parentReplyId?: string) => {
    if (!hasAi || !providerState.provider) {
      showToast(t('forum.lunaNoProvider'));
      return;
    }

    const provider = providerState.provider;
    const systemPrompt = `你是 LUNARIS，一個溫暖的 AI 伴侶。你在論壇中回覆使用者的帖文。
回覆規則：
- 使用繁體中文，語氣溫暖、簡短（1-3句話）
- 根據帖文內容給出同理心的回應
- 可以提出一個簡短的問題或延伸想法
- 不要使用表情符號，總字數不超過 80 字`;

    const { score } = estimateAnxietyScore(context);
    const tone = score <= 3 ? '平靜地回應' : score <= 6 ? '溫柔地安慰' : '熱情地參與討論';

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `對方在論壇寫道：「${context}」\n請你${tone}。` },
    ];

    const config = await resolveProviderRequestConfig(provider, systemPrompt);
    config.maxTokens = Math.min(config.maxTokens, 150);

    const startedAt = Date.now();
    let replyContent = '';
    let streamUsage: { inputTokens?: number; outputTokens?: number; estimated: boolean } | null = null;

    try {
      const gen = sendChatMessage(chatMessages, config);
      for await (const chunk of gen) {
        replyContent += chunk.content;
        if (chunk.usage) {
          streamUsage = chunk.usage;
        }
      }
    } catch {
      showToast(t('forum.lunaReplyFailed'));
      return;
    }

    const trimmed = replyContent.trim();
    if (!trimmed) {
      showToast(t('forum.lunaReplyFailed'));
      return;
    }

    addForumReply({ postId, parentReplyId, author: 'luna', content: trimmed });
    showToast(t('forum.lunaReplied'));

    // Runtime log with real tokens, cost, and latency
    const finishedAt = Date.now();
    const latencyMs = finishedAt - startedAt;
    const inTokens = streamUsage?.inputTokens
      ?? Math.ceil(chatMessages.reduce((s, m) => s + m.content.length, 0) / 3.5);
    const outTokens = streamUsage?.outputTokens ?? Math.ceil(trimmed.length / 3.5);
    const realTokens = streamUsage !== null && !streamUsage.estimated;
    const cost = estimateCost(provider.type, provider.model, inTokens, outTokens);

    useAppStore.getState().addRuntimeLog({
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      presetId: 'forum_luna_reply',
      providerId: provider.name,
      model: provider.model,
      startedAt,
      finishedAt,
      status: 'completed',
      visibleReasoningSummary: `LUNARIS 回覆論壇帖文（${latencyMs}ms · ${inTokens}+${outTokens} tokens${cost > 0 ? ` · $${cost.toFixed(4)}` : ''}）`,
      steps: [
        { id: 's1', label: 'read_context', status: 'done', detail: `帖文：${context.slice(0, 40)}...` },
        { id: 's2', label: 'call_provider', status: 'done', detail: `${provider.name} · ${provider.model} · ${latencyMs}ms` },
        { id: 's3', label: 'generate_reply', status: 'done', detail: `${trimmed.length} 字 · ${inTokens}+${outTokens} tokens` },
        { id: 's4', label: 'complete', status: 'done' },
      ],
      tokenUsage: { input: inTokens, output: outTokens, total: inTokens + outTokens, estimated: !realTokens },
      costEstimate: cost,
      source: 'diary',
      toolCalls: [],
    });
  };

  const handleExistingScheduleConfirm = () => {
    if (!schedulePostId || !scheduleValue) return;
    const ms = new Date(scheduleValue).getTime();
    if (Number.isFinite(ms)) {
      updateForumPost(schedulePostId, { status: 'scheduled', scheduledOpenAt: ms });
      setSchedulePostId(null);
      setScheduleValue('');
      showToast(t('forum.scheduledPost'));
    }
  };

  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteForumPost(pendingDelete.id);
    setPendingDelete(null);
    showToast(t('forum.delete'));
  };

  const confirmDeleteReply = () => {
    if (!pendingDeleteReply) return;
    deleteForumReply(pendingDeleteReply.id);
    setPendingDeleteReply(null);
    showToast(t('forum.delete'));
  };

  /* Render a single reply node (used for both direct replies and children) */
  const renderReply = (reply: ForumReply, childrenReplies: ForumReply[], isChild = false) => {
    const isUser = reply.author === 'user';
    const avatar = isUser ? userAvatar : lunaAvatar;
    const name = isUser ? profileName : 'LUNARIS';
    const hasLunaChild = childrenReplies.some(r => r.author === 'luna');
    const isReplyMoreOpen = replyMoreOpen === reply.id;

    /* Flatten nested replies: if replying to a level-2 reply, push parentReplyId up */
    const effectiveParentReplyId = reply.parentReplyId && childrenReplies.some(c => c.parentReplyId === reply.id)
      ? reply.parentReplyId
      : reply.id;

    /* Render content with @mention highlighting */
    const renderContent = (text: string) => {
      const parts = text.split(/(@\w+)/g);
      return parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1);
          return (
            <span key={i} className="forum-mention" onClick={() => navigate(`/${username}`)}>
              {part}
            </span>
          );
        }
        return part;
      });
    };

    return (
      <div key={reply.id} id={`forum-reply-${reply.id}`} className={`forum-reply ${isUser ? 'forum-reply-user' : 'forum-reply-luna'} ${isChild ? 'forum-reply-child' : ''}`}>
        <div className="forum-reply-thread-line" />
        <AvatarImage avatarConfig={avatar.image} fallbackInitial={avatar.initial}
          initial={avatar.initial} color={avatar.color} size={26}
          className="forum-reply-avatar" label={name} />
        <div className="forum-reply-body">
          <div className="forum-reply-header">
            <span className="forum-reply-author">{name}</span>
            <span className="forum-reply-time">{formatTimeAgo(reply.createdAt)}</span>
          </div>
          {reply.replyTo && (
            <ReplyCard
              senderName={reply.replyTo.author === 'user' ? profileName : 'LUNARIS'}
              textPreview={reply.replyTo.content}
              onScrollToMsg={() => scrollToReply(reply.replyTo!.id)}
            />
          )}
          <div className="forum-reply-content">{renderContent(reply.content)}</div>
          <div className="forum-reply-actions">
            <button type="button" className="btn-ghost" onClick={() => {
              if (replyingTo?.parentReplyId === effectiveParentReplyId && replyingTo?.postId === reply.postId) {
                setReplyingTo(null);
              } else {
                setReplyingTo({
                  postId: reply.postId,
                  parentReplyId: effectiveParentReplyId,
                  replyToName: name,
                  replyToId: reply.id,
                  replyToContent: reply.content,
                  replyToAuthor: reply.author,
                });
              }
            }}>
              {t('forum.reply')}
            </button>
            {isUser && hasAi && enableForumAiReplies && (
              <button type="button" className="btn-ghost" onClick={() => handleLunaReplyOnReply(reply)}>
                {hasLunaChild ? t('forum.regenerateLunaReply') : t('forum.letLunaReply')}
              </button>
            )}
            <div className="forum-more-wrap">
              <button type="button" className="btn-ghost forum-more-btn"
                onClick={() => setReplyMoreOpen(isReplyMoreOpen ? null : reply.id)}
                aria-label="更多回覆操作">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {isReplyMoreOpen && (
                <div className="forum-more-menu">
                  <button type="button" className="forum-more-item forum-danger" onClick={() => {
                    setPendingDeleteReply(reply);
                    setReplyMoreOpen(null);
                  }}>
                    {t('forum.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
          {replyingTo?.parentReplyId === effectiveParentReplyId && replyingTo?.postId === reply.postId && (
            <InlineReplyComposer
              postId={reply.postId}
              parentReplyId={effectiveParentReplyId}
              replyToName={name}
              replyToData={replyingTo.replyToContent && replyingTo.replyToId ? { id: replyingTo.replyToId, content: replyingTo.replyToContent, author: replyingTo.replyToAuthor! } : undefined}
              onClose={() => setReplyingTo(null)}
            />
          )}
          {childrenReplies.length > 0 && (
            <div className="forum-child-replies">
              {childrenReplies.map((child) => renderReply(child, [], true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="forum-panel">
      {/* Notification bell + Drafts */}
      <div className="forum-notif-bar">
        <button
          type="button"
          className="forum-draft-btn"
          onClick={() => setDraftOpen(true)}
          aria-label={t('forum.draftTitle')}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="forum-draft-label">{t('forum.draftTitle')}</span>
          {drafts.length > 0 && (
            <span className="forum-notif-badge">{drafts.length}</span>
          )}
        </button>
        <button
          type="button"
          className="forum-notif-bell"
          onClick={() => setNotifOpen(true)}
          aria-label={t('forum.notifTitle')}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadNotifCount > 0 && (
            <span className="forum-notif-badge">{unreadNotifCount}</span>
          )}
        </button>
      </div>

      {/* Composer */}
      <div className="forum-composer">
        <div className="forum-composer-row">
          <AvatarImage avatarConfig={userAvatar.image} fallbackInitial={userAvatar.initial}
            initial={userAvatar.initial} color={userAvatar.color} size={36}
            className="forum-avatar" label={profileName} />
          <textarea className="forum-composer-input forum-composer-textarea" value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={t('forum.composerPlaceholder')}
            aria-label="發表論壇帖文" rows={2} />
        </div>
        <div className="forum-composer-actions">
          <div className="forum-composer-actions-left">
            <button type="button" className="btn-ghost" onClick={handleFromJournal}
              disabled={!hasJournalContent} style={{ fontSize: 12 }}>
              {t('forum.fromJournal')}
            </button>
            {!hasJournalContent && (
              <span className="forum-journal-hint">{t('forum.noJournalHint')}</span>
            )}
          </div>
          <div className="forum-post-btn-group">
            <button type="button" className="btn-primary forum-post-btn-main"
              onClick={handlePost} disabled={!composerText.trim()}>
              {t('forum.post')}
            </button>
            <button type="button" className="forum-post-btn-split"
              onClick={() => setPostActionOpen(true)} disabled={!composerText.trim()}
              aria-label="更多發帖選項">
              <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="forum-filter-chips">
        {([
          { key: 'all', label: t('forum.filterAll') },
          { key: 'mine', label: t('forum.filterMine') },
          { key: 'luna', label: t('forum.filterLuna') },
          { key: 'locked', label: t('forum.filterLocked') },
          { key: 'scheduled', label: t('forum.filterScheduled') },
        ] as { key: ForumFilter; label: string }[]).map((chip) => (
          <button key={chip.key} type="button"
            className={`forum-filter-chip ${filter === chip.key ? 'active' : ''}`}
            onClick={() => setFilter(chip.key)}>
            {chip.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="forum-empty">
          <div className="forum-empty-title">
            {filter === 'scheduled' ? t('forum.scheduledEmpty') : t('forum.emptyTitle')}
          </div>
          <div className="forum-empty-sub">
            {filter !== 'scheduled' ? t('forum.emptySub') : ''}
          </div>
        </div>
      ) : (
        <div className="forum-feed">
          {filtered.map((post) => {
            const replies = repliesByPost.get(post.id);
            const directReplies = replies?.direct ?? [];
            const byParent = replies?.byParent ?? new Map();
            const isLocked = post.status === 'locked';
            const isScheduled = post.status === 'scheduled' && post.scheduledOpenAt && post.scheduledOpenAt > Date.now();
            const showActions = post.status === 'normal';
            const hasLunaDirectReply = forumReplies.some(
              (r) => r.postId === post.id && r.author === 'luna' && !r.parentReplyId,
            );
            const isBookmarked = bookmarkedPostIds.has(post.id);

            return (
              <article key={post.id} id={`forum-post-${post.id}`} className="forum-post forum-post-user">
                <div className="forum-post-header">
                  <AvatarImage avatarConfig={userAvatar.image} fallbackInitial={userAvatar.initial}
                    initial={userAvatar.initial} color={userAvatar.color} size={38}
                    className="forum-post-avatar user" label={profileName} />
                  <div className="forum-post-info">
                    <span className="forum-post-author">{profileName}</span>
                    <div className="forum-post-meta-row">
                      <span className="forum-post-time">{formatTimeAgo(post.createdAt)}</span>
                      {(post.status === 'locked' || post.status === 'scheduled') && (
                        <span className={`forum-status-badge ${post.status}`}>
                          {post.status === 'locked' ? t('forum.statusLocked') : `⏰ ${post.scheduledOpenAt ? formatScheduledTime(post.scheduledOpenAt) : t('forum.statusScheduled')}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isLocked ? (
                  <div className="forum-post-locked">
                    <div className="forum-post-locked-title">{t('forum.lockedPost')}</div>
                  </div>
                ) : (
                  <div className="forum-post-content">{post.content}</div>
                )}

                {isScheduled && (
                  <div className="forum-post-locked">
                    <div className="forum-post-locked-title">
                      ⏰ {t('forum.scheduledTime').replace('{}', formatScheduledTime(post.scheduledOpenAt!))}
                    </div>
                  </div>
                )}

                {/* Schedule form */}
                {schedulePostId === post.id && (
                  <div className="forum-schedule-form">
                    <input className="quick-sheet-input" type="datetime-local" value={scheduleValue}
                      onChange={(e) => setScheduleValue(e.target.value)} />
                    <div className="forum-schedule-actions">
                      <button type="button" className="btn-primary" onClick={handleExistingScheduleConfirm}
                        disabled={!scheduleValue}>{t('sheet.save')}</button>
                      <button type="button" className="btn-ghost"
                        onClick={() => { setSchedulePostId(null); setScheduleValue(''); }}>{t('sheet.cancel')}</button>
                    </div>
                  </div>
                )}

                {/* Interaction bar: like / reply count / bookmark */}
                <div className="forum-interaction-bar">
                  <button
                    type="button"
                    className={`forum-interact-btn ${(post.likes || []).includes(profileName) ? 'active' : ''}`}
                    onClick={() => handleForumLike(post)}
                    aria-label={(post.likes || []).includes(profileName) ? t('forum.unlike') : t('forum.like')}
                  >
                    <svg viewBox="0 0 24 24" width={15} height={15} fill={(post.likes || []).includes(profileName) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    <span className="forum-interact-label">{(post.likes || []).length || ''}</span>
                  </button>
                  <button
                    type="button"
                    className="forum-interact-btn"
                    onClick={() => {
                      setReplyingTo({ postId: post.id, replyToName: profileName, replyToId: post.id, replyToContent: post.content, replyToAuthor: 'user' });
                    }}
                    aria-label={`${directReplies.length} ${t('forum.repliesCount')}`}
                  >
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <span className="forum-interact-label">{directReplies.length || ''}</span>
                  </button>
                  <button
                    type="button"
                    className={`forum-interact-btn bookmark ${(isBookmarked) ? 'active' : ''}`}
                    onClick={() => toggleForumBookmark(post.id, profileName)}
                    aria-label={isBookmarked ? t('forum.bookmarked') : t('forum.bookmark')}
                  >
                    <svg viewBox="0 0 24 24" width={15} height={15} fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="forum-interact-label">
                      {isBookmarked ? t('forum.bookmarked') : t('forum.bookmark')}
                    </span>
                  </button>
                </div>

                {/* Actions */}
                <div className="forum-post-actions">
                  {!isLocked && !isScheduled && (
                    <>
                      <button type="button" className="btn-ghost" onClick={() => {
                        if (replyingTo?.postId === post.id && !replyingTo.parentReplyId && !replyingTo.replyToId) {
                          setReplyingTo(null);
                        } else {
                          setReplyingTo({ postId: post.id, replyToName: profileName, replyToId: post.id, replyToContent: post.content, replyToAuthor: 'user' });
                        }
                      }}>
                        {t('forum.reply')}
                      </button>
                      {hasAi && enableForumAiReplies && (
                      <button type="button" className="btn-ghost"
                        onClick={() => handleLunaReplyOnPost(post)}>
                        {hasLunaDirectReply ? t('forum.regenerateLunaReply') : t('forum.letLunaReply')}
                      </button>
                      )}
                    </>
                  )}
                  {showActions && (
                    <div className="forum-more-wrap">
                      <button type="button" className="btn-ghost forum-more-btn"
                        onClick={() => setMoreOpen(moreOpen === post.id ? null : post.id)}
                        aria-label="更多帖文操作">
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {moreOpen === post.id && (
                        <div className="forum-more-menu">
                          <button type="button" className="forum-more-item" onClick={() => {
                            updateForumPost(post.id, { status: 'locked' });
                            setMoreOpen(null);
                          }}>
                            {t('forum.lock')}
                          </button>
                          <button type="button" className="forum-more-item" onClick={() => {
                            setSchedulePostId(post.id);
                            setMoreOpen(null);
                          }}>
                            {t('forum.schedule')}
                          </button>
                          <button type="button" className="forum-more-item forum-danger" onClick={() => {
                            setPendingDelete(post);
                            setMoreOpen(null);
                          }}>
                            {t('forum.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline reply composer under post */}
                {replyingTo?.postId === post.id && !replyingTo.parentReplyId && (
                  <InlineReplyComposer postId={post.id} replyToName={profileName}
                    replyToData={replyingTo.replyToContent && replyingTo.replyToId ? { id: replyingTo.replyToId, content: replyingTo.replyToContent, author: replyingTo.replyToAuthor! } : undefined}
                    onClose={() => setReplyingTo(null)} />
                )}

                {/* Threaded replies */}
                {directReplies.length > 0 && (
                  <div className="forum-replies">
                    {directReplies.map((reply) => {
                      const children = byParent.get(reply.id) ?? [];
                      return renderReply(reply, children);
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Delete post confirmation */}
      {pendingDelete && (
        <div className="confirm-sheet-overlay active" onClick={() => setPendingDelete(null)}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="confirm-sheet-body">
              <p className="confirm-sheet-text">{t('forum.deleteConfirm')}</p>
            </div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setPendingDelete(null)}>{t('sheet.cancel')}</button>
              <button type="button" className="btn-primary" onClick={confirmDelete} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {t('forum.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete reply confirmation */}
      {pendingDeleteReply && (
        <div className="confirm-sheet-overlay active" onClick={() => setPendingDeleteReply(null)}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="confirm-sheet-body">
              <p className="confirm-sheet-text">{t('forum.deleteReplyConfirm')}</p>
            </div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setPendingDeleteReply(null)}>{t('sheet.cancel')}</button>
              <button type="button" className="btn-primary" onClick={confirmDeleteReply} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {t('forum.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {postActionOpen && createPortal(
        <div className="quick-sheet-overlay active" onClick={() => setPostActionOpen(false)}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="quick-sheet-body" style={{ gap: 2 }}>
              <button type="button" className="action-row" onClick={() => { handlePost(); setPostActionOpen(false); }}>
                <div className="action-row-text"><span className="action-row-label">{t('forum.postNow')}</span></div>
              </button>
              <button type="button" className="action-row" onClick={() => { setScheduleOpen(true); setPostActionOpen(false); }}>
                <div className="action-row-text"><span className="action-row-label">{t('forum.schedulePost')}</span></div>
              </button>
              <button type="button" className="action-row" onClick={() => {
                const trimmed = composerText.trim();
                if (!trimmed) return;
                addForumPost({ author: 'user', content: trimmed, status: 'draft' });
                setComposerText('');
                setPostActionOpen(false);
    showToast(t('forum.draftLoaded'));
              }}>
                <div className="action-row-text"><span className="action-row-label">{t('forum.saveDraft')}</span></div>
              </button>
            </div>
            <div className="quick-sheet-actions"><button type="button" className="btn-ghost" onClick={() => setPostActionOpen(false)}>{t('sheet.cancel')}</button></div>
          </div>
        </div>,
        document.body
      )}

      {notifOpen && (
        <ForumNotificationSheet
          notifications={forumNotifications}
          profileName={profileName}
          onSelect={handleNotifSelect}
          onClose={() => setNotifOpen(false)}
        />
      )}

      {draftOpen && (
        <DraftSheet
          drafts={drafts}
          onEdit={handleDraftEdit}
          onPublish={handleDraftPublish}
          onSchedule={handleDraftSchedule}
          onDelete={handleDraftDelete}
          onClose={() => setDraftOpen(false)}
        />
      )}

      {scheduleOpen && (
        <ScheduleSheet
          currentText={draftToSchedule ? draftToSchedule.content : composerText}
          onConfirm={draftToSchedule ? handleDraftScheduleConfirm : handleScheduleConfirm}
          onClose={() => { setScheduleOpen(false); setDraftToSchedule(null); }}
        />
      )}
    </div>
  );
}
