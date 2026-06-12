import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { useAppStore } from '@/store/useAppStore';
import { t, type Language } from '@/i18n';
import type { ChatContact, Message, ActivityLogEntry } from '@/types';

// ── Icons ──

function SearchIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21a9 9 0 0 1 18 0" />
    </svg>
  );
}

function messagePreview(message: Message | undefined): string {
  if (!message) return t('chat.inbox.lunaEmpty');
  if (message.type === 'text') return message.content;
  if (message.type === 'image') return t('chat.inbox.image');
  if (message.type === 'file') return t('chat.inbox.file');
  return t('chat.inbox.sticker');
}

function formatInboxTime(iso: string | undefined, language: Language): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const locale = language === 'en' ? 'en-US' : 'zh-TW';
  if (sameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  return date.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
}

function formatUnixTime(ts: number | undefined, language: Language): string {
  if (!ts) return '';
  return formatInboxTime(new Date(ts).toISOString(), language);
}

type LunaStatus = 'online' | 'thinking' | 'reading';

const LUNA_STATUS_LABELS: Record<LunaStatus, string> = {
  online: '在線',
  thinking: '思考中',
  reading: '閱讀中',
};

// ── Inbox Row ──

interface InboxRowProps {
  contact: ChatContact;
  title: string;
  status?: LunaStatus | null;
  subtitle?: string;
  preview: string;
  time: string;
  unreadCount: number;
  onClick?: () => void;
}

function InboxRow({ contact, title, status, subtitle, preview, time, unreadCount, onClick }: InboxRowProps) {
  const partner = useAppStore((s) => s.partner);

  const content = (
    <>
      <div className={`chat-inbox-avatar chat-inbox-avatar--${contact.avatar}`}>
        {contact.avatar === 'partner' ? (
          <AvatarImage
            avatarConfig={partner.avatarImage}
            fallbackInitial={partner.avatarInitial || 'L'}
            initial={partner.avatarInitial || 'L'}
            color={partner.avatarColor || 'char'}
            size={50}
            label={partner.name || 'LUNARIS'}
          />
        ) : contact.avatar === 'system' ? <BellIcon /> : <UserIcon />}
        {unreadCount > 0 && (
          <span className="chat-inbox-status-dot chat-inbox-status-dot--online" aria-hidden="true" />
        )}
      </div>
      <div className="chat-inbox-copy">
        <div className="chat-inbox-row-top">
          <strong>{title}</strong>
          <time>{time}</time>
        </div>
        {status && (
          <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500, marginBottom: 1 }}>
            {LUNA_STATUS_LABELS[status]}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 1 }}>{subtitle}</div>
        )}
        <div className="chat-inbox-row-bottom">
          <span>{preview}</span>
          {unreadCount > 0 && (
            <span className="chat-inbox-unread" aria-label={t('chat.inbox.unread')}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (contact.route) {
    return <Link className="chat-inbox-row" to={contact.route}>{content}</Link>;
  }
  if (onClick) {
    return (
      <button
        className="chat-inbox-row"
        onClick={onClick}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {content}
      </button>
    );
  }
  return <article className="chat-inbox-row chat-inbox-row--placeholder" aria-disabled="true">{content}</article>;
}

// ── Page ──

export function ChatInboxPage() {
  const navigate = useNavigate();
  const language = useAppStore((s) => s.language);
  const contacts = useAppStore((s) => s.chatContacts);
  const messages = useAppStore((s) => s.messages);
  const partner = useAppStore((s) => s.partner);
  const providers = useAppStore((s) => s.providers || []);
  const activityLogs = useAppStore((s) => s.activityLogs || []);
  const agentRuntimeLogs = useAppStore((s) => s.agentRuntimeLogs || []);
  const [query, setQuery] = useState('');

  // Active provider
  const activeProvider = providers.find((p) => p.isDefault && p.enabled)
    || providers.find((p) => p.enabled)
    || null;

  // Luna status: check recent runtime logs for thinking/reading activity
  const recentLog = agentRuntimeLogs[agentRuntimeLogs.length - 1];
  const isThinking = recentLog && recentLog.status === 'thinking';
  const isReading = recentLog && recentLog.source === 'moonread'
    && (Date.now() - recentLog.startedAt < 5 * 60 * 1000); // last 5 min
  const lunaStatus: LunaStatus = isThinking ? 'thinking' : isReading ? 'reading' : 'online';

  // Last Luna message
  const lastLunaMsg = [...messages].reverse().find((m) => m.sender === 'assistant');
  const lastMsgTime = lastLunaMsg?.time;

  // System activity
  const latestLogs = activityLogs.filter(
    (l) => l.type === 'settings' || l.type === 'chat' || l.type === 'memory',
  ).slice(0, 3);
  const unreadActivityCount = activityLogs.filter((l) => !l.read).length;

  // Contacts
  const lunaContact = contacts.find((c) => c.id === 'luna');
  const systemContact = contacts.find((c) => c.id === 'system');
  const customContact = contacts.find((c) => c.id === 'custom-placeholder');

  const lunaSubtitle = activeProvider
    ? `${activeProvider.name} · ${activeProvider.model || '未設定 model'}`
    : '未設定 Provider';

  const allRows = [
    ...(lunaContact
      ? [{
          key: 'luna',
          contact: lunaContact,
          title: partner.name || 'LUNARIS',
          status: lunaStatus as LunaStatus | null,
          subtitle: lunaSubtitle,
          preview: messagePreview(lastLunaMsg),
          time: formatInboxTime(lastMsgTime, language),
          unreadCount: lunaContact.unreadCount,
          onClick: undefined as (() => void) | undefined,
        }]
      : []),
    ...(systemContact
      ? [{
          key: 'system',
          contact: systemContact,
          title: t('chat.inbox.system'),
          status: null as LunaStatus | null,
          subtitle: undefined as string | undefined,
          preview: latestLogs.length > 0
            ? latestLogs.map((l) => l.title).join(' · ')
            : '月潮待命中',
          time: formatUnixTime(latestLogs[0]?.createdAt, language),
          unreadCount: unreadActivityCount,
          onClick: undefined as (() => void) | undefined,
        }]
      : []),
    ...(customContact
      ? [{
          key: 'character',
          contact: { ...customContact, avatar: 'partner' as const, route: '' },
          title: '角色中心',
          status: null as LunaStatus | null,
          subtitle: undefined as string | undefined,
          preview: '建立角色 · 保留未來擴充空間',
          time: '',
          unreadCount: 0,
          onClick: () => navigate('/profile'),
        }]
      : []),
  ];

  const filtered = allRows.filter((row) => {
    const kw = query.trim().toLocaleLowerCase();
    if (!kw) return true;
    return `${row.title} ${row.preview} ${row.subtitle || ''}`.toLocaleLowerCase().includes(kw);
  });

  return (
    <section className="chat-inbox-view">
      <header className="chat-inbox-header">
        <div>
          <span className="chat-inbox-eyebrow">{t('chat.inbox.eyebrow')}</span>
          <h1>{t('chat.inbox.title')}</h1>
        </div>
      </header>

      <label className="chat-inbox-search">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chat.inbox.search')}
          aria-label={t('chat.inbox.search')}
        />
      </label>

      <div className="chat-inbox-list" aria-label={t('chat.inbox.title')}>
        {filtered.map(({ key, ...row }) => (
          <InboxRow key={key} {...row} />
        ))}
        {filtered.length === 0 && (
          <p className="chat-inbox-empty">{t('chat.inbox.noResults')}</p>
        )}
      </div>
    </section>
  );
}
