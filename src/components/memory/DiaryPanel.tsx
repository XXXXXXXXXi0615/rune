import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { DiaryEntry, DiaryMood } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import {
  DroopMoonIcon,
  HollowCircleIcon,
  MoonIcon,
  MoonWaveIcon,
  RippleAlertIcon,
  SparkleIcon,
} from '@/components/icons/LunartideIcons';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { t } from '@/i18n';
import type { AvatarImageMeta } from '@/types';

const MOODS: Array<{ value: DiaryMood; icon: typeof HollowCircleIcon; ariaKey: string; color: string }> = [
  { value: 'blank', icon: HollowCircleIcon, ariaKey: 'sheet.moodEmpty', color: 'var(--text-3)' },
  { value: 'joy', icon: SparkleIcon, ariaKey: 'sheet.moodJoyful', color: 'var(--amber)' },
  { value: 'calm', icon: MoonWaveIcon, ariaKey: 'sheet.moodCalm', color: 'var(--teal)' },
  { value: 'tired', icon: DroopMoonIcon, ariaKey: 'sheet.moodTired', color: '#a28fb8' },
  { value: 'anxious', icon: RippleAlertIcon, ariaKey: 'sheet.moodAnxious', color: 'var(--danger)' },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function moodLabel(mood?: DiaryMood): string {
  const item = MOODS.find((m) => m.value === mood);
  return item ? t(item.ariaKey) : t('sheet.moodEmpty');
}

function moodIcon(mood?: DiaryMood, size = 18) {
  const item = MOODS.find((m) => m.value === mood) ?? MOODS[0];
  const Icon = item.icon;
  return <Icon size={size} />;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string, salt = randomSalt()): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return `${salt}:${bytesToHex(digest)}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  return (await hashPassword(password, salt)) === storedHash;
}

function isAutoOpen(entry: DiaryEntry, now: number): boolean {
  return Boolean(entry.lock?.unlockAt && entry.lock.unlockAt <= now);
}

function isLocked(entry: DiaryEntry, unlockedIds: Set<string>, now: number): boolean {
  return Boolean(entry.lock?.enabled && !isAutoOpen(entry, now) && !unlockedIds.has(entry.id));
}

function remainingLabel(unlockAt: number, now: number): string {
  const diff = Math.max(0, unlockAt - now);
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return t('diary.remainingMinutes').replace('{n}', String(minutes));
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return t('diary.remainingHours').replace('{n}', String(hours));
  return t('diary.remainingDays').replace('{n}', String(Math.ceil(hours / 24)));
}

function summarize(entry: DiaryEntry, locked: boolean): string {
  if (locked) return t('diary.lockedSummary');
  const compact = entry.content.replace(/\s+/g, ' ').trim();
  return compact.length > 76 ? `${compact.slice(0, 76)}…` : compact;
}

function buildCopyText(entry: DiaryEntry, locked: boolean): string {
  return [
    `${t('diary.author')}: ${entry.author === 'luna' ? t('diary.lunaDiary') : t('diary.myDiary')}`,
    `${t('diary.titleField')}: ${entry.title}`,
    `${t('diary.date')}: ${entry.date}`,
    `${t('sheet.mood')}: ${moodLabel(entry.mood)}`,
    `${t('diary.contentField')}: ${locked ? t('diary.lockedSummary') : entry.content}`,
  ].join('\n');
}

function mockLunaContent(hasChatToday: boolean, hasMemoryToday: boolean): string {
  if (hasChatToday && hasMemoryToday) return t('diary.mockLunaChatMemory');
  if (hasChatToday) return t('diary.mockLunaChat');
  if (hasMemoryToday) return t('diary.mockLunaMemory');
  return t('diary.mockLunaQuiet');
}

function datetimeLocalToMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

interface DiaryCardProps {
  entry: DiaryEntry;
  locked: boolean;
  now: number;
  userAvatar: {
    image?: AvatarImageMeta;
    initial: string;
    color: string;
  };
  lunaAvatar: {
    image?: AvatarImageMeta;
    initial: string;
    color: string;
  };
  onCopy: (entry: DiaryEntry, locked: boolean) => void;
  onDelete: (entry: DiaryEntry) => void;
  onUnlock: (entry: DiaryEntry, password: string) => void;
}

function DiaryCard({ entry, locked, now, userAvatar, lunaAvatar, onCopy, onDelete, onUnlock }: DiaryCardProps) {
  const [password, setPassword] = useState('');
  const hasPassword = Boolean(entry.lock?.passwordHash);
  const unlockAt = entry.lock?.unlockAt;
  const cardClass = entry.author === 'luna' ? 'diary-card diary-card-luna' : 'diary-card diary-card-user';
  const avatar = entry.author === 'luna' ? lunaAvatar : userAvatar;

  return (
    <article className={cardClass}>
      <div className="diary-card-top">
        <AvatarImage
          avatarConfig={avatar.image}
          fallbackInitial={avatar.initial}
          initial={avatar.initial}
          color={avatar.color}
          size={34}
          className={`diary-avatar ${entry.author}`}
          label={entry.author === 'luna' ? 'LUNARIS' : t('diary.myDiary')}
        />
        <div className="diary-card-main">
          <div className="diary-card-title">{entry.title}</div>
          <div className="diary-card-meta">
            <span>{formatDate(entry.date)}</span>
            <span className="diary-mood-chip">{moodIcon(entry.mood)} {moodLabel(entry.mood)}</span>
            {entry.lock?.enabled && <span className="badge">{entry.visibility === 'sealed' ? t('diary.openLater') : t('diary.lock')}</span>}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="diary-lock-box">
          <div className="diary-lock-title">{t('diary.sealedMessage')}</div>
          <div className="diary-soft-note">{t('diary.softLockNote')}</div>
          {unlockAt && <div className="diary-lock-hint">{remainingLabel(unlockAt, now)}</div>}
          {entry.lock?.hint && <div className="diary-lock-hint">{t('diary.passwordHint')}: {entry.lock.hint}</div>}
          {hasPassword && (
            <div className="diary-unlock-row">
              <input
                className="quick-sheet-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('diary.temporaryPassword')}
              />
              <button type="button" className="btn-secondary" onClick={() => onUnlock(entry, password)}>
                {t('diary.unlock')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="diary-card-content">{summarize(entry, false)}</p>
      )}

      <div className="diary-card-actions">
        <button type="button" className="btn-ghost" onClick={() => onCopy(entry, locked)}>{t('diary.copy')}</button>
        <button type="button" className="btn-ghost diary-danger" onClick={() => onDelete(entry)}>{t('diary.delete')}</button>
      </div>
    </article>
  );
}

interface DiaryWriteSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function DiaryWriteSheet({ isOpen, onClose }: DiaryWriteSheetProps) {
  const addDiaryEntry = useAppStore((s) => s.addDiaryEntry);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<DiaryMood>('blank');
  const [lockEnabled, setLockEnabled] = useState(false);
  const [timedEnabled, setTimedEnabled] = useState(false);
  const [unlockAt, setUnlockAt] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setContent('');
    setMood('blank');
    setLockEnabled(false);
    setTimedEnabled(false);
    setUnlockAt('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError(t('diary.contentRequired'));
      return;
    }

    const unlockMs = timedEnabled ? datetimeLocalToMs(unlockAt) : undefined;
    if (timedEnabled && !unlockMs) {
      setError(t('diary.unlockAtRequired'));
      return;
    }
    const hasLock = lockEnabled || timedEnabled;

    addDiaryEntry({
      author: 'user',
      visibility: timedEnabled ? 'sealed' : lockEnabled ? 'locked' : 'normal',
      title: title.trim() || t('diary.defaultTitle'),
      content: trimmedContent,
      mood,
      date: todayKey(),
      source: 'manual',
      ...(hasLock
        ? {
            lock: {
              enabled: true,
              mode: 'soft',
              ...(unlockMs ? { unlockAt: unlockMs } : {}),
            },
          }
        : {}),
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="quick-sheet-overlay active" onClick={handleClose}>
      <form className="quick-sheet diary-write-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <div className="quick-sheet-head-icon"><MoonIcon size={20} /></div>
          <span className="quick-sheet-title">{t('diary.writeDiary')}</span>
        </div>

        <div className="quick-sheet-body diary-sheet-body">
          <input
            className="quick-sheet-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('diary.titleOptional')}
          />
          <textarea
            className={`quick-sheet-textarea ${error ? 'has-error' : ''}`}
            value={content}
            onChange={(e) => { setContent(e.target.value); setError(''); }}
            placeholder={t('diary.contentPlaceholder')}
            rows={5}
          />
          {error && <span className="quick-sheet-error">{error}</span>}

          <div className="quick-sheet-field">
            <span className="quick-sheet-label">{t('sheet.mood')}</span>
            <div className="mood-icons">
              {MOODS.map((item) => {
                const Icon = item.icon;
                const isActive = mood === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`mood-icon-btn ${isActive ? 'active' : ''}`}
                    style={{ '--mood-color': item.color } as CSSProperties}
                    onClick={() => setMood(item.value)}
                    aria-label={t(item.ariaKey)}
                  >
                    <Icon size={22} />
                  </button>
                );
              })}
            </div>
          </div>

          <label className="diary-lock-toggle">
            <input type="checkbox" checked={lockEnabled} onChange={(e) => setLockEnabled(e.target.checked)} />
            <span>{t('diary.lock')}</span>
          </label>

          <label className="diary-lock-toggle">
            <input type="checkbox" checked={timedEnabled} onChange={(e) => setTimedEnabled(e.target.checked)} />
            <span>{t('diary.openLater')}</span>
          </label>

          {(lockEnabled || timedEnabled) && (
            <div className="diary-lock-fields">
              <div className="diary-soft-note">{t('diary.softLockNote')}</div>
              {timedEnabled && (
                <>
                  <label className="quick-sheet-label" htmlFor="diary-unlock-at">{t('diary.openLater')}</label>
                  <input
                    id="diary-unlock-at"
                    className="quick-sheet-input"
                    type="datetime-local"
                    value={unlockAt}
                    onChange={(e) => { setUnlockAt(e.target.value); setError(''); }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={handleClose}>{t('sheet.cancel')}</button>
          <button type="submit" className="btn-primary">{t('sheet.save')}</button>
        </div>
      </form>
    </div>
  );
}

export function DiaryPanel() {
  const diaryEntries = useAppStore((s) => s.diaryEntries || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const messages = useAppStore((s) => s.messages);
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const addDiaryEntry = useAppStore((s) => s.addDiaryEntry);
  const deleteDiaryEntry = useAppStore((s) => s.deleteDiaryEntry);
  const showToast = useToastStore((s) => s.showToast);
  const [writeOpen, setWriteOpen] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<DiaryEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const today = todayKey();
  const sorted = useMemo(() => [...diaryEntries].sort((a, b) => b.createdAt - a.createdAt), [diaryEntries]);
  const userEntries = sorted.filter((entry) => entry.author === 'user');
  const lunaEntries = sorted.filter((entry) => entry.author === 'luna');
  const lockedEntries = sorted.filter((entry) => entry.lock?.enabled && !entry.lock.unlockAt && !isAutoOpen(entry, now));
  const sealedEntries = sorted.filter((entry) => entry.lock?.unlockAt);
  const todayUser = userEntries.find((entry) => entry.date === today);
  const todayLuna = lunaEntries.find((entry) => entry.date === today);
  const userAvatar = {
    image: profile.avatarImage,
    initial: (profile.avatarInitial || profile.displayName || 'S').charAt(0).toUpperCase(),
    color: profile.avatarColor || 'user',
  };
  const lunaAvatar = {
    image: partner.avatarImage,
    initial: (partner.avatarInitial || partner.name || 'L').charAt(0).toUpperCase(),
    color: partner.avatarColor || 'char',
  };

  const hasChatToday = messages.some((message) => message.time?.slice(0, 10) === today);
  const hasMemoryToday = memoryEntries.some((entry) => new Date(entry.createdAt).toISOString().slice(0, 10) === today);

  const handleLunaWrite = () => {
    addDiaryEntry({
      author: 'luna',
      visibility: 'normal',
      title: t('diary.lunaMockTitle'),
      content: mockLunaContent(hasChatToday, hasMemoryToday),
      mood: hasChatToday || hasMemoryToday ? 'calm' : 'blank',
      date: today,
      source: 'mock-luna',
    });
  };

  const handleCopy = async (entry: DiaryEntry, locked: boolean) => {
    try {
      await navigator.clipboard.writeText(buildCopyText(entry, locked));
      showToast(t('diary.copied'));
    } catch {
      showToast(t('shared.copyFail'));
    }
  };

  const handleUnlock = async (entry: DiaryEntry, password: string) => {
    if (!entry.lock?.passwordHash) return;
    if (await verifyPassword(password, entry.lock.passwordHash)) {
      setUnlockedIds((ids) => new Set(ids).add(entry.id));
      showToast(t('diary.unlocked'));
    } else {
      showToast(t('diary.unlockFailed'));
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteDiaryEntry(pendingDelete.id);
    setPendingDelete(null);
    showToast(t('diary.deleted'));
  };

  const renderEntries = (entries: DiaryEntry[], emptyKey: string) => (
    entries.length === 0 ? (
      <div className="diary-empty">{t(emptyKey)}</div>
    ) : (
      <div className="diary-list">
        {entries.map((entry) => (
          <DiaryCard
            key={entry.id}
            entry={entry}
            locked={isLocked(entry, unlockedIds, now)}
            now={now}
            userAvatar={userAvatar}
            lunaAvatar={lunaAvatar}
            onCopy={handleCopy}
            onDelete={setPendingDelete}
            onUnlock={handleUnlock}
          />
        ))}
      </div>
    )
  );

  return (
    <div className="diary-panel">
      <section className="diary-exchange-main">
        <div className="diary-exchange-head">
          <div>
            <div className="diary-section-title">{t('diary.exchangeDiary')}</div>
            <div className="diary-section-sub">{t('diary.todayExchange')}</div>
          </div>
          <span className="badge">{formatDate(today)}</span>
        </div>
        <div className="diary-exchange-grid">
          <div className="diary-exchange-card user">
            <span className="diary-exchange-label">{t('diary.myTodayStatus')}</span>
            <strong>{todayUser?.title || t('diary.userTodayEmpty')}</strong>
          </div>
          <div className="diary-exchange-card luna">
            <span className="diary-exchange-label">{t('diary.lunaTodayStatus')}</span>
            <strong>{todayLuna?.title || t('diary.lunaTodayEmpty')}</strong>
          </div>
        </div>
        <div className="diary-exchange-actions">
          <button type="button" className="btn-primary" onClick={() => setWriteOpen(true)}>{t('diary.writeDiary')}</button>
          <button type="button" className="btn-secondary" onClick={handleLunaWrite}>{t('diary.letLunaWrite')}</button>
        </div>
      </section>

      <section className="diary-section diary-section-compact">
        <div className="diary-section-head">
          <div className="diary-section-title">{t('diary.myDiary')}</div>
          <span className="badge">{userEntries.length}</span>
        </div>
        {renderEntries(userEntries, 'diary.emptyUser')}
      </section>

      <section className="diary-section diary-section-compact">
        <div className="diary-section-head">
          <div className="diary-section-title">{t('diary.lunaDiary')}</div>
          <span className="badge">{lunaEntries.length}</span>
        </div>
        {renderEntries(lunaEntries, 'diary.emptyLuna')}
      </section>

      <section className="diary-section diary-section-compact">
        <div className="diary-section-head">
          <div className="diary-section-title">{t('diary.lockedDiary')}</div>
          <span className="badge">{lockedEntries.length}</span>
        </div>
        {renderEntries(lockedEntries, 'diary.emptyLocked')}
      </section>

      <section className="diary-section diary-section-compact">
        <div className="diary-section-head">
          <div className="diary-section-title">{t('diary.openLater')}</div>
          <span className="badge">{sealedEntries.length}</span>
        </div>
        {renderEntries(sealedEntries, 'diary.emptySealed')}
      </section>

      <DiaryWriteSheet isOpen={writeOpen} onClose={() => setWriteOpen(false)} />

      {pendingDelete && (
        <div className="confirm-sheet-overlay active" onClick={() => setPendingDelete(null)}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="confirm-sheet-body">
              <p className="confirm-sheet-text">{t('diary.deleteConfirm')}</p>
            </div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setPendingDelete(null)}>{t('sheet.cancel')}</button>
              <button type="button" className="btn-primary" onClick={confirmDelete} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {t('diary.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
