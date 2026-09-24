import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { getLanguage } from '@/i18n';
import { MOODS, MOOD_BY_ID } from '@/components/memory/MoodSystem';
import { MoodAvatarPNG } from '@/components/MoodAvatarPNG';
import type { MemoryEntry, MemoryMood } from '@/types';
import { loadPeriodRecords, type PeriodRecord, PERIOD_MOODS } from '@/utils/periodStorage';
import { MEMORY_PREDICATES } from '@/utils/memoryCategoryPredicates';
import { useHydrationStore } from '@/store/useHydrationStore';
import './LunartideMemoryPage.css';

/* ── Persistence ── */
const PIN_KEY = 'lunartide_pinned_memory';
const FAV_KEY = 'lunartide_favorited_memory';
function loadSet(key: string): Set<string> {
  try { const raw = localStorage.getItem(key); if (!raw) return new Set(); const arr: string[] = JSON.parse(raw); return new Set(arr.filter(id => typeof id === 'string')); }
  catch { return new Set(); }
}
function saveSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* noop */ }
}

/* ── Categories ── */
interface Category { id: string; label: string; svg: (size: number, active: boolean) => React.ReactNode; predicate: (entry: MemoryEntry) => boolean; }
function catIconAll(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><rect x={3} y={3} width={7} height={7} rx={1.5} /><rect x={14} y={3} width={7} height={7} rx={1.5} /><rect x={3} y={14} width={7} height={7} rx={1.5} /><rect x={14} y={14} width={7} height={7} rx={1.5} /></svg>;
}
function catIconLuna(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><circle cx={12} cy={12} r={8} /><path d="M14 3.5A8 8 0 0020 9.5C20 6 16.5 3 14 3.5Z" /></svg>;
}
function catIconUser(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/><line x1={16} y1={17} x2={8} y2={17}/></svg>;
}
function catIconTide(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><path d="M12 2s4 6 4 10a4 4 0 01-8 0C8 8 12 2 12 2Z"/><path d="M12 22s4-6 4-10A4 4 0 008 12c0 4 4 10 4 10Z" opacity={0.35}/></svg>;
}
function catIconChat(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2Z"/></svg>;
}
function catIconWorks(size: number, active: boolean) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={active ? 1 : 0.55}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5V4.5A2.5 2.5 0 016.5 2Z"/></svg>;
}
const CATEGORIES: Category[] = [
  { id: 'all',   label: '全部',       svg: catIconAll,   predicate: MEMORY_PREDICATES.all },
  { id: 'luna',  label: 'Luna 記憶',  svg: catIconLuna,  predicate: MEMORY_PREDICATES.luna },
  { id: 'user',  label: '使用者筆記', svg: catIconUser,  predicate: MEMORY_PREDICATES.user },
  { id: 'tide',  label: '潮痕',       svg: catIconTide,  predicate: MEMORY_PREDICATES.tide },
  { id: 'chat',  label: '聊天收藏',   svg: catIconChat,  predicate: MEMORY_PREDICATES.chat },
  { id: 'works', label: '作品收錄',   svg: catIconWorks, predicate: MEMORY_PREDICATES.works },
];

/* ── Source helpers ── */
interface SourceMeta { icon: string; label: string; className: string }
function sourceMeta(entry: MemoryEntry): SourceMeta {
  if (entry.cardType === 'diet_receipt') return { icon: '◫', label: '飲食收據', className: 'src-note' };
  if (entry.cardType === 'sleep_receipt') return { icon: '😴', label: '睡眠收據', className: 'src-note' };
  if (entry.triggerText === '來自聊天')  return { icon: '💬', label: '聊天收藏', className: 'src-chat' };
  if (entry.triggerText === '來自作品庫') return { icon: '🎨', label: '作品收錄', className: 'src-works' };
  if (entry.cardType === 'forum_bookmark') return { icon: '🌊', label: '潮痕', className: 'src-tide' };
  if (entry.summary || entry.category === 'dialogue' || entry.category === 'emotion')
    return { icon: '🌙', label: 'Luna 記憶', className: 'src-luna' };
  return { icon: '📝', label: '筆記', className: 'src-note' };
}

function autoTitle(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 記錄`;
  }
  const first = trimmed.split(/[。！？!?.\n\r]+/)[0].trim();
  if (first.length <= 20) return first;
  return first.slice(0, 18) + '…';
}
function entryTitle(entry: MemoryEntry): string {
  return (entry.scene || entry.summary || entry.triggerText || '').slice(0, 120) || autoTitle(entry.bodyThoughts);
}
function entryPreview(entry: MemoryEntry, maxLines: number): string {
  return (entry.bodyThoughts || entry.summary || '').slice(0, maxLines * 60);
}
function colorMixin(color: string, alpha: number): string {
  // Simple alpha mix — convert hex to rgba-like
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/* ── Time ── */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
type TimeGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'earlier';
function timeGroupId(ts: number): TimeGroupId {
  const d = new Date(ts);
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const entryDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (entryDayStart >= todayStart) return 'today';
  if (entryDayStart >= yesterdayStart) return 'yesterday';
  const dow = new Date().getDay() || 7;
  if (entryDayStart >= todayStart - (dow - 1) * 86400000) return 'week';
  if (entryDayStart >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()) return 'month';
  return 'earlier';
}
const GROUP_ORDER: TimeGroupId[] = ['today', 'yesterday', 'week', 'month', 'earlier'];
const ZH_LABELS: Record<TimeGroupId, string> = { today: '今天', yesterday: '昨天', week: '本週', month: '本月', earlier: '更早' };
const EN_LABELS: Record<TimeGroupId, string> = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', month: 'This Month', earlier: 'Earlier' };

/* ── Insights helpers ── */
function topMood(entries: MemoryEntry[]): MemoryMood | null {
  const counts = new Map<MemoryMood, number>();
  for (const e of entries) { if (e.moodV4) counts.set(e.moodV4, (counts.get(e.moodV4) || 0) + 1); }
  if (counts.size === 0) return null;
  let best: MemoryMood | null = null; let max = 0;
  for (const [m, c] of counts) { if (c > max) { max = c; best = m; } }
  return best;
}
function tideData(entries: MemoryEntry[]): { day: string; count: number; top: MemoryMood | null }[] {
  const days: { day: string; count: number; top: MemoryMood | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const dayEntries = entries.filter(e => e.moodV4 && e.updatedAt >= dayStart && e.updatedAt < dayEnd);
    const dStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    days.push({ day: dStr, count: dayEntries.length, top: topMood(dayEntries) });
  }
  return days;
}

/* ═══════════════════════════════════════════════
   Second Brain v6 — Memory Stream + Reading Panel
   ═══════════════════════════════════════════════ */
export function LunartideMemoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const language = getLanguage();
  const isZh = language === 'zh-TW';
  const groupLabels = isZh ? ZH_LABELS : EN_LABELS;
  const showToast = useToastStore(s => s.showToast);
  const addTodo = useAppStore(s => s.addTodo);
  const addMemoryEntry = useAppStore(s => s.addMemoryEntry);
  const deleteMemoryEntry = useAppStore(s => s.deleteMemoryEntry);
  const updateMemoryEntry = useAppStore(s => s.updateMemoryEntry);
  const clearLifeGraphData = useAppStore(s => s.clearLifeGraphData);
  const memoryEntries = useAppStore(s => s.memoryEntries || []);
  const entries = useMemo(() => [...memoryEntries].sort((a, b) => b.updatedAt - a.updatedAt), [memoryEntries]);

  /* ── State ── */
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => loadSet(PIN_KEY));
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(() => loadSet(FAV_KEY));
  const [createOpen, setCreateOpen] = useState(false);
  const [createText, setCreateText] = useState('');
  const [createMood, setCreateMood] = useState<MemoryMood>('calm');

  /* Auto-open composer when navigated with ?compose=true */
  useEffect(() => {
    if (searchParams.get('compose') === 'true') {
      setCreateOpen(true);
    }
  }, [searchParams]);
  const [insightsOpen, setInsightsOpen] = useState(() => memoryEntries.length > 10);
  const [catCollapsed, setCatCollapsed] = useState(false);
  const createRef = useRef<HTMLTextAreaElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mobile
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [mobilePanelId, setMobilePanelId] = useState<string | null>(null);

  /* ── Phase 5: Management Mode ── */
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'newest' | 'updated' | 'title' | 'favs'>('updated');
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagValue, setTagValue] = useState('');

  /* ── Phase 5.5: View mode, review, stats ── */
  const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card');
  const [reviewEntry, setReviewEntry] = useState<MemoryEntry | null>(null);
  const [reviewType, setReviewType] = useState<'daily' | 'weekly' | 'random' | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  /* ── Phase 6: Life Graph ── */
  const [lifeGraphMode, setLifeGraphMode] = useState(false);
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>([]);
  useEffect(() => { setPeriodRecords(loadPeriodRecords()); }, []);

  const sortOptions: { id: 'newest' | 'updated' | 'title' | 'favs'; label: string }[] = [
    { id: 'newest', label: isZh ? '最新建立' : 'Newest' },
    { id: 'updated', label: isZh ? '最後更新' : 'Updated' },
    { id: 'title', label: isZh ? '標題 A-Z' : 'Title A-Z' },
    { id: 'favs', label: isZh ? '收藏優先' : 'Favs First' },
  ];

  /* ── Type filters ── */
  const TYPE_FILTERS = useMemo(() => [
    { id: 'all', label: isZh ? '全部' : 'All', predicate: MEMORY_PREDICATES.all },
    { id: 'tide', label: isZh ? '潮痕' : 'Tide', predicate: MEMORY_PREDICATES.tide },
    { id: 'dialogue', label: isZh ? '對話' : 'Dialogue', predicate: MEMORY_PREDICATES.dialogue },
    { id: 'inspiration', label: isZh ? '靈感' : 'Idea', predicate: MEMORY_PREDICATES.inspiration },
    { id: 'diary', label: isZh ? '日記' : 'Diary', predicate: MEMORY_PREDICATES.diary },
    { id: 'favs', label: isZh ? '⭐ 收藏' : '⭐ Favs', predicate: (e: MemoryEntry) => favoritedIds.has(e.id) },
  ], [isZh, favoritedIds]);

  /* ── Toggles ── */
  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); saveSet(PIN_KEY, n); return n; });
  }, []);
  const toggleFav = useCallback((id: string) => {
    setFavoritedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); saveSet(FAV_KEY, n); return n; });
  }, []);
  useEffect(() => { if (createOpen) createRef.current?.focus(); }, [createOpen]);

  /* ── Batch selection ── */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  /* ── Filtered + sorted ── */
  const filtered = useMemo(() => {
    const activeFilterObj = TYPE_FILTERS.find(f => f.id === activeCategory);
    let result = activeFilterObj ? entries.filter(activeFilterObj.predicate) : entries;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(e =>
        (e.scene || '').toLowerCase().includes(q) ||
        (e.triggerText || '').toLowerCase().includes(q) ||
        (e.bodyThoughts || '').toLowerCase().includes(q) ||
        (e.summary || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (e.moodV4 && MOODS.find(m => m.id === e.moodV4)?.label.includes(q))
      );
    }
    // Sort
    const sorted = [...result];
    if (sortBy === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'title') sorted.sort((a, b) => (a.scene || '').localeCompare(b.scene || '', 'zh'));
    else if (sortBy === 'favs') {
      sorted.sort((a, b) => {
        const af = favoritedIds.has(a.id) ? 0 : 1;
        const bf = favoritedIds.has(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        return b.updatedAt - a.updatedAt;
      });
    } else {
      // updated (default)
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    // Pins always first
    sorted.sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 1 : 0;
      const bp = pinnedIds.has(b.id) ? 1 : 0;
      return bp - ap;
    });
    return sorted;
  }, [entries, activeCategory, searchQuery, pinnedIds, favoritedIds, sortBy, TYPE_FILTERS]);

  /* ── Batch select-all + batch actions ── */
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)));
  }, [filtered]);
  const clearSelection = useCallback(() => { setSelectedIds(new Set()); setManageMode(false); }, []);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearGraphConfirm, setClearGraphConfirm] = useState(false);
  const batchDelete = useCallback(() => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    for (const id of selectedIds) {
      deleteMemoryEntry(id);
      // Clean ghost IDs from local Sets
      setFavoritedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      // Close panels if currently viewing a deleted entry
      if (selectedId === id) setSelectedId(null);
      if (mobilePanelId === id) setMobilePanelId(null);
    }
    setSelectedIds(new Set()); setManageMode(false); setConfirmDelete(false);
    showToast(isZh ? `已刪除 ${selectedIds.size} 項` : `${selectedIds.size} deleted`);
  }, [selectedIds, deleteMemoryEntry, confirmDelete, selectedId, mobilePanelId, isZh, showToast]);
  const batchFav = useCallback(() => {
    for (const id of selectedIds) { if (!favoritedIds.has(id)) toggleFav(id); }
    setSelectedIds(new Set());
  }, [selectedIds, favoritedIds, toggleFav]);
  const allSelectedFav = useMemo(() =>
    selectedIds.size > 0 && [...selectedIds].every(id => favoritedIds.has(id)),
    [selectedIds, favoritedIds]);
  const batchTag = useCallback(() => {
    const tags = tagValue.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) { showToast(isZh ? '請輸入標籤' : 'Enter tags'); return; }
    for (const id of selectedIds) {
      const entry = entries.find(e => e.id === id);
      const existing = entry?.tags || [];
      const merged = [...new Set([...existing, ...tags])];
      updateMemoryEntry(id, { tags: merged });
    }
    showToast(isZh ? `已為 ${selectedIds.size} 筆記錄加入標籤` : `Tagged ${selectedIds.size} entries`);
    setSelectedIds(new Set()); setShowTagInput(false); setTagValue('');
  }, [selectedIds, entries, tagValue, updateMemoryEntry, showToast, isZh]);
  const batchMove = useCallback(() => {
    showToast(isZh ? '移動資料夾功能即將推出' : 'Move to folder coming soon');
  }, [showToast, isZh]);

  const grouped = useMemo(() => {
    const m = new Map<TimeGroupId, MemoryEntry[]>();
    for (const gid of GROUP_ORDER) m.set(gid, []);
    for (const e of filtered) m.get(timeGroupId(e.updatedAt))!.push(e);
    return GROUP_ORDER.map(gid => ({ id: gid, label: groupLabels[gid], items: m.get(gid)! })).filter(g => g.items.length > 0);
  }, [filtered, groupLabels]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of TYPE_FILTERS) m.set(c.id, entries.filter(c.predicate).length);
    return m;
  }, [entries, TYPE_FILTERS]);

  const insights = useMemo(() => {
    const favs = entries.filter(e => favoritedIds.has(e.id));
    const top = topMood(entries);
    const tide = tideData(entries);
    const lastUpdate = entries.length > 0 ? entries[0].updatedAt : null;
    const tideCount = entries.filter(e => e.triggerText === '來自聊天' || e.cardType === 'forum_bookmark' || e.category === 'emotion').length;
    const dialogueCount = entries.filter(e => e.category === 'dialogue').length;
    const diaryCount = entries.filter(e => e.cardType === 'journal').length;
    return {
      total: entries.length, favCount: favs.length,
      luna: entries.filter(e => !!e.summary || e.category === 'dialogue' || e.category === 'emotion').length,
      tideCount, chat: tideCount, works: entries.filter(e => e.triggerText === '來自作品庫').length,
      dialogueCount, diaryCount,
      topMood: top, tide, lastUpdate,
    };
  }, [entries, favoritedIds]);

  const selectedEntry = useMemo(
    () => selectedId ? entries.find(e => e.id === selectedId) ?? null : null,
    [selectedId, entries]
  );
  const mobilePanelEntry = useMemo(
    () => mobilePanelId ? entries.find(e => e.id === mobilePanelId) ?? null : null,
    [mobilePanelId, entries]
  );

  /** Auto-clear panel if selected/mobile entry no longer exists in entries. */
  useEffect(() => {
    if (selectedId && !entries.some(e => e.id === selectedId)) {
      setSelectedId(null);
    }
    if (mobilePanelId && !entries.some(e => e.id === mobilePanelId)) {
      setMobilePanelId(null);
    }
  }, [entries, selectedId, mobilePanelId]);

  const relatedEntries = useMemo(() => {
    if (!selectedEntry) return [];
    const entryTags = new Set(selectedEntry.tags || []);
    const category = selectedEntry.category;
    const keywords = (selectedEntry.scene + ' ' + (selectedEntry.summary || '') + ' ' + (selectedEntry.bodyThoughts || '')).toLowerCase().split(/[\s,，。！？、/\\]+/).filter(w => w.length > 1);
    const scored = entries.filter(e => e.id !== selectedEntry.id).map(e => {
      let score = 0;
      if (category && e.category === category) score += 3;
      for (const t of (e.tags || [])) if (entryTags.has(t)) score += 2;
      const eText = (e.scene + ' ' + (e.summary || '') + ' ' + (e.bodyThoughts || '')).toLowerCase();
      for (const kw of keywords) if (eText.includes(kw)) score += 1;
      return { entry: e, score };
    });
    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt).slice(0, 6).map(s => s.entry);
  }, [selectedEntry, entries]);

  /* ── Phase 5.5: Pick review entry ── */
  const pickReview = useCallback((type: 'daily' | 'weekly' | 'random') => {
    const now = Date.now();
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    let pool: MemoryEntry[];
    if (type === 'daily') {
      pool = entries.filter(e => e.updatedAt >= todayStart);
    } else if (type === 'weekly') {
      const dow = new Date().getDay() || 7;
      pool = entries.filter(e => e.updatedAt >= todayStart - (dow - 1) * 86400000);
    } else {
      pool = entries;
    }
    if (pool.length === 0) { showToast(isZh ? '尚無記錄可供回顧' : 'No entries to review'); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setReviewEntry(pick);
    setReviewType(type);
  }, [entries, showToast, isZh]);

  /* ── Phase 5.5: AI Summary ── */
  const summaryText = useMemo(() => {
    if (entries.length === 0) return null;
    const now = Date.now();
    const weekStart = now - 7 * 86400000;
    const monthStart = now - 30 * 86400000;
    const weekEntries = entries.filter(e => e.updatedAt >= weekStart);
    const monthEntries = entries.filter(e => e.updatedAt >= monthStart);
    const weekMood = topMood(weekEntries);
    const monthMood = topMood(monthEntries);
    const allTags = new Map<string, number>();
    for (const e of entries) for (const t of (e.tags || [])) allTags.set(t, (allTags.get(t) || 0) + 1);
    const topTags = [...allTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const weekTags = new Map<string, number>();
    for (const e of weekEntries) for (const t of (e.tags || [])) weekTags.set(t, (weekTags.get(t) || 0) + 1);
    const topWeekTags = [...weekTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { weekCount: weekEntries.length, monthCount: monthEntries.length, weekMood, monthMood, topTags, topWeekTags };
  }, [entries]);

  const monthAdditions = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return entries.filter(e => e.createdAt >= monthStart).length;
  }, [entries]);

  const topMoods = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.moodV4) m.set(e.moodV4, (m.get(e.moodV4) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ id: id as MemoryMood, count }));
  }, [entries]);

  /* ── Phase 6: Life Graph data ── */
  const healthRecords = useAppStore(s => s.healthRecords || []);
  const todos = useAppStore(s => s.todos || []);
  const forumPosts = useAppStore(s => s.forumPosts || []);
  const forumReplies = useAppStore(s => s.forumReplies || []);
  const conversations = useAppStore(s => s.conversations || []);
  const hydrationEntries = useHydrationStore(s => s.entries);
  const hydrationGoalMl = useHydrationStore(s => s.settings.dailyGoalMl);
  const focusSessions = useAppStore(s => s.focusSessionLog || []);
  const journalEntries = useAppStore(s => s.journalEntries || []);
  const customEvents = useAppStore(s => s.customEvents || []);
  const sleepReceipts = useAppStore(s => s.sleepReceipts || []);

  interface LifeGraphEntry {
    type: 'memory' | 'sleep' | 'period' | 'todo' | 'forum_post' | 'forum_reply' | 'chat' | 'water' | 'focus' | 'journal' | 'event' | 'sleep_receipt';
    date: string;
    icon: string;
    label: string;
    detail: string;
    subDetail?: string;
    color: string;
    id: string;
    ts: number;
  }
  interface LifeGraphDay { date: string; label: string; entries: LifeGraphEntry[]; }

  const lifeGraphDays = useMemo((): LifeGraphDay[] => {
    const dayMap = new Map<string, LifeGraphEntry[]>();
    const add = (e: LifeGraphEntry) => {
      if (!dayMap.has(e.date)) dayMap.set(e.date, []);
      dayMap.get(e.date)!.push(e);
    };
    const dateStr = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

    // Memory entries
    for (const e of memoryEntries) {
      if (e.cardType === 'diet_receipt' || e.cardType === 'sleep_receipt') continue;
      const d = dateStr(e.createdAt);
      const mood = e.moodV4 ? MOOD_BY_ID[e.moodV4] : null;
      add({ type: 'memory', date: d, icon: '🧠', label: '記憶', detail: entryTitle(e), subDetail: mood?.label, color: mood?.color || '#6366f1', id: e.id, ts: e.createdAt });
    }

    // Sleep records
    for (const h of healthRecords) {
      if (h.type !== 'sleep') continue;
      const dur = h.sleepDurationMinutes ? `${Math.round(h.sleepDurationMinutes / 60 * 10) / 10}h` : '';
      const quality = { poor: '差', normal: '一般', good: '良好' }[h.quality] || '';
      add({ type: 'sleep', date: h.date, icon: '😴', label: '睡眠', detail: dur || quality || '已記錄', subDetail: quality, color: '#8b5cf6', id: h.id, ts: Date.parse(h.date) || h.createdAt });
    }

    // Period
    for (const p of periodRecords) {
      const moodLabel = p.mood ? PERIOD_MOODS.find(m => m.key === p.mood)?.label : '';
      add({ type: 'period', date: p.startDate, icon: '🌊', label: '生理期', detail: moodLabel || '已記錄', subDetail: p.tideLevel || (p.symptoms.length > 0 ? p.symptoms.slice(0,2).join('、') : ''), color: '#ec4899', id: p.id, ts: p.createdAt });
    }

    // Todos completed
    for (const t of todos) {
      if (!t.completed) continue;
      const d = t.date || dateStr(t.updatedAt);
      add({ type: 'todo', date: d, icon: '✅', label: '待辦完成', detail: t.title.slice(0, 30), subDetail: t.priority, color: '#10b981', id: t.id, ts: t.updatedAt });
    }

    // Forum posts
    for (const fp of forumPosts) {
      const d = dateStr(fp.createdAt);
      const author = fp.author === 'luna' ? 'Luna' : '我';
      add({ type: 'forum_post', date: d, icon: '🌊', label: author === 'Luna' ? 'Luna 發文' : '論壇發文', detail: fp.content.slice(0, 40), subDetail: fp.status === 'scheduled' ? (isZh ? '排程中' : 'Scheduled') : '', color: '#0891b2', id: fp.id, ts: fp.createdAt });
    }

    // Forum replies
    for (const fr of forumReplies) {
      const d = dateStr(fr.createdAt);
      add({ type: 'forum_reply', date: d, icon: '💬', label: '論壇回覆', detail: fr.content.slice(0, 40), subDetail: fr.author === 'luna' ? 'Luna' : '我', color: '#06b6d4', id: fr.id, ts: fr.createdAt });
    }

    // Chat messages (count per day)
    const chatByDay = new Map<string, number>();
    for (const c of conversations) {
      for (const msg of c.messages) {
        const d = dateStr(new Date(msg.time).getTime());
        chatByDay.set(d, (chatByDay.get(d) || 0) + 1);
      }
    }
    for (const [d, count] of chatByDay) {
      add({ type: 'chat', date: d, icon: '💬', label: '聊天', detail: `${count} 則訊息`, subDetail: '', color: '#7c3aed', id: `chat_${d}`, ts: Date.parse(d) || Date.now() });
    }

    // Water — canonical Hydration entries grouped by local date.
    const hydrationByDate = new Map<string, number>();
    for (const entry of hydrationEntries) hydrationByDate.set(entry.dateKey, (hydrationByDate.get(entry.dateKey) ?? 0) + entry.amountMl);
    for (const [date, ml] of hydrationByDate) {
      if (ml > 0) add({ type: 'water', date, icon: '💧', label: '飲水', detail: `${ml}ml`, subDetail: ml >= hydrationGoalMl ? (isZh ? '已達標' : 'Goal met') : '', color: '#3b82f6', id: `water_${date}`, ts: Date.parse(date) || Date.now() });
    }

    // Focus sessions
    for (const f of focusSessions) {
      add({ type: 'focus', date: f.date, icon: '🎯', label: '專注', detail: `${f.actualFocusMinutes} 分鐘`, subDetail: `${f.roundsCompleted} 回合`, color: '#f59e0b', id: f.id, ts: f.startTime });
    }

    // Journal entries
    for (const j of journalEntries) {
      add({ type: 'journal', date: j.date, icon: '📝', label: '日記', detail: j.scene || j.bodyThoughts?.slice(0, 30) || '', subDetail: `焦慮 ${j.anxietyLevel}/10`, color: '#d97706', id: j.id, ts: j.createdAt });
    }

    // Calendar events
    for (const ce of customEvents) {
      add({ type: 'event', date: ce.date, icon: '📅', label: '事件', detail: ce.title, subDetail: ce.completed ? (isZh ? '已完成' : 'Done') : '', color: '#8b5cf6', id: ce.id, ts: Date.parse(ce.date) || Date.now() });
    }

    // Sleep receipts
    for (const receipt of sleepReceipts) {
      const h = Math.floor(receipt.totalSleep / 60);
      const m = receipt.totalSleep % 60;
      add({
        type: 'sleep_receipt',
        date: receipt.date,
        icon: '😴',
        label: isZh ? '睡眠收據' : 'Sleep Receipt',
        detail: `${h}h${m > 0 ? m + 'm' : ''} · Score ${receipt.sleepScore}/100`,
        subDetail: `深睡 ${receipt.deepMinutes}m · REM ${receipt.remMinutes}m · 核心 ${receipt.coreMinutes}m`,
        color: '#8b5cf6',
        id: receipt.id,
        ts: receipt.createdAt,
      });
    }

  // Sort days descending by date
    const days = [...dayMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([date, entries]) => {
        const d = new Date(date);
        const label = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        entries.sort((a, b) => b.ts - a.ts);
        return { date, label, entries };
      });

    return days;
  }, [memoryEntries, healthRecords, periodRecords, todos, forumPosts, forumReplies, conversations, hydrationEntries, hydrationGoalMl, focusSessions, journalEntries, customEvents, sleepReceipts, isZh]);

  /* ── Phase 6: Cross-module correlations ── */
  interface CorrelationInsight {
    title: string;
    description: string;
    strength: 'weak' | 'moderate' | 'strong';
    icon: string;
  }

  const correlations = useMemo((): CorrelationInsight[] => {
    const results: CorrelationInsight[] = [];
    const dateStr = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

    // 1. Sleep → Mood correlation (last 30 days)
    const sleepRecords = healthRecords.filter(h => h.type === 'sleep');
    const sleepDates = new Set(sleepRecords.map(h => h.date));
    const lowSleepDates = sleepRecords.filter(h => h.sleepDurationMinutes && h.sleepDurationMinutes < 360).map(h => h.date);
    const memoryMoodsByDay = new Map<string, MemoryMood[]>();
    for (const e of memoryEntries) { const d = dateStr(e.updatedAt); if (!memoryMoodsByDay.has(d)) memoryMoodsByDay.set(d, []); if (e.moodV4) memoryMoodsByDay.get(d)!.push(e.moodV4); }
    const journalAnxietyByDay = new Map<string, number[]>();
    for (const j of journalEntries) { if (!journalAnxietyByDay.has(j.date)) journalAnxietyByDay.set(j.date, []); journalAnxietyByDay.get(j.date)!.push(j.anxietyLevel); }

    if (lowSleepDates.length >= 2 && sleepDates.size >= 5) {
      const lowSleepMoods = new Map<string, MemoryMood[]>();
      const normalSleepMoods = new Map<string, MemoryMood[]>();
      for (const d of sleepDates) {
        if (memoryMoodsByDay.has(d)) {
          (lowSleepDates.includes(d) ? lowSleepMoods : normalSleepMoods).set(d, memoryMoodsByDay.get(d)!);
        }
      }
      const lowAnxiousCount = [...lowSleepMoods.values()].flat().filter(m => m === 'anxious' || m === 'dark' || m === 'panic').length;
      const lowTotal = [...lowSleepMoods.values()].flat().length;
      const normAnxiousCount = [...normalSleepMoods.values()].flat().filter(m => m === 'anxious' || m === 'dark' || m === 'panic').length;
      const normTotal = [...normalSleepMoods.values()].flat().length;
      if (lowTotal > 0 && normTotal > 0) {
        const lowRate = lowAnxiousCount / lowTotal;
        const normRate = normAnxiousCount / normTotal;
        if (lowRate > normRate * 1.3) {
          results.push({
            title: isZh ? '睡眠不足與情緒' : 'Sleep & Mood',
            description: isZh ? '睡眠不足時，負面情緒的比例有增加趨勢。' : 'When sleep is insufficient, negative mood ratio tends to increase.',
            strength: lowRate > normRate * 2 ? 'strong' : 'moderate',
            icon: '😴→😟',
          });
        }
      }
    }

    // 2. Period → Mood
    const periodDays = new Set<string>();
    for (const p of periodRecords) {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        periodDays.add(dateStr(d.getTime()));
      }
    }
    if (periodDays.size >= 3) {
      const periodMoods: MemoryMood[] = [];
      const nonPeriodMoods: MemoryMood[] = [];
      for (const [d, moods] of memoryMoodsByDay) {
        (periodDays.has(d) ? periodMoods : nonPeriodMoods).push(...moods);
      }
      if (periodMoods.length > 3 && nonPeriodMoods.length > 5) {
        const pNegative = periodMoods.filter(m => m === 'anxious' || m === 'dark' || m === 'angry').length / periodMoods.length;
        const npNegative = nonPeriodMoods.filter(m => m === 'anxious' || m === 'dark' || m === 'angry').length / nonPeriodMoods.length;
        if (pNegative > npNegative * 1.3) {
          results.push({
            title: isZh ? '生理期與情緒' : 'Period & Mood',
            description: isZh ? '生理期間，負面情緒的比例較高。' : 'During period days, negative mood ratio is higher.',
            strength: 'moderate',
            icon: '🌊→😟',
          });
        }
      }
    }

    // 3. Forum activity ↔ mood (last 30d)
    const forumByDay = new Map<string, number>();
    for (const fp of forumPosts) { const d = dateStr(fp.createdAt); forumByDay.set(d, (forumByDay.get(d) || 0) + 1); }
    for (const fr of forumReplies) { const d = dateStr(fr.createdAt); forumByDay.set(d, (forumByDay.get(d) || 0) + 1); }
    const activeForumDays = [...forumByDay.entries()].filter(([_, c]) => c >= 2);
    if (activeForumDays.length >= 2) {
      const forumDayMoods: MemoryMood[] = [];
      for (const [d] of activeForumDays) { const moods = memoryMoodsByDay.get(d); if (moods) forumDayMoods.push(...moods); }
      const allMoods = [...memoryMoodsByDay.values()].flat();
      if (forumDayMoods.length > 3 && allMoods.length > 10) {
        const fNegative = forumDayMoods.filter(m => m === 'anxious' || m === 'dark' || m === 'panic').length / forumDayMoods.length;
        const aNegative = allMoods.filter(m => m === 'anxious' || m === 'dark' || m === 'panic').length / allMoods.length;
        if (fNegative > aNegative * 1.2) {
          results.push({
            title: isZh ? '論壇活躍與情緒' : 'Forum Activity & Mood',
            description: isZh ? '論壇較活躍的日子，負面情緒比例偏高。' : 'On days with more forum activity, negative mood ratio is higher.',
            strength: 'weak',
            icon: '🌊→😟',
          });
        }
      }
    }

    // 4. Focus → Memory creation
    const focusDays = new Set(focusSessions.filter(f => f.actualFocusMinutes >= 30).map(f => f.date));
    const memoryByDay = new Map<string, number>();
    for (const e of memoryEntries) { const d = dateStr(e.createdAt); memoryByDay.set(d, (memoryByDay.get(d) || 0) + 1); }
    if (focusDays.size >= 2) {
      const focusDayMemories = [...focusDays].reduce((s, d) => s + (memoryByDay.get(d) || 0), 0);
      const allDays = [...memoryByDay.keys()];
      const nonFocusDays = allDays.filter(d => !focusDays.has(d));
      if (nonFocusDays.length > 0) {
        const focusAvg = focusDayMemories / focusDays.size;
        const nonFocusAvg = nonFocusDays.reduce((s, d) => s + (memoryByDay.get(d) || 0), 0) / nonFocusDays.length;
        if (focusAvg > nonFocusAvg * 1.5) {
          results.push({
            title: isZh ? '專注與記憶' : 'Focus & Memory',
            description: isZh ? '有深度專注的日子，記錄了更多記憶。' : 'On days with focused sessions, more memories are recorded.',
            strength: focusAvg > nonFocusAvg * 2 ? 'strong' : 'moderate',
            icon: '🎯→🧠',
          });
        }
      }
    }

    // Limit to top 3
    return results.slice(0, 3);
  }, [healthRecords, forumPosts, forumReplies, focusSessions, memoryEntries, periodRecords, journalEntries, isZh]);

  // P6: snippet from latest entry
  const recentSnippet = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[0];
    const text = latest.bodyThoughts || latest.scene || latest.summary || '';
    const firstSentence = text.split(/[。！？!?\n\r]+/)[0].trim();
    if (!firstSentence) return null;
    return firstSentence.length > 80 ? firstSentence.slice(0, 78) + '…' : firstSentence;
  }, [entries]);

  // P4: 30-day trend data
  const trend30 = useMemo(() => {
    const days: { day: string; count: number; moods: MemoryMood[] }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000;
      const dayEntries = entries.filter(e => e.updatedAt >= start && e.updatedAt < end);
      days.push({
        day: `${d.getMonth() + 1}/${d.getDate()}`,
        count: dayEntries.length,
        moods: dayEntries.filter(e => e.moodV4).map(e => e.moodV4!) || [],
      });
    }
    return days;
  }, [entries]);

  // P7: LUNARIS natural language observation
  const lunarisObservation = useMemo(() => {
    if (entries.length === 0) return null;
    const top = insights.topMood;
    const favCount = insights.favCount;
    const lunaCount = insights.luna;
    const recent7 = trend30.slice(-7);
    const recentTotal = recent7.reduce((s, d) => s + d.count, 0);
    const parts: string[] = [];
    if (top) {
      const moodLabel = MOOD_BY_ID[top].label;
      if (top === 'calm') parts.push(isZh ? '最近似乎比較平靜呢。' : 'Seems quite calm lately.');
      else if (top === 'anxious') parts.push(isZh ? '最近似乎有些焦慮呢。' : 'Seems a bit anxious lately.');
      else if (top === 'happy') parts.push(isZh ? '最近心情似乎不錯呢。' : 'Seems in a good mood lately.');
      else if (top === 'dark') parts.push(isZh ? '最近情緒似乎比較低落。' : 'Mood seems a bit low lately.');
      else if (top === 'panic') parts.push(isZh ? '最近似乎有些驚慌。' : 'Seems a bit panicked lately.');
      else parts.push(`${isZh ? '最近七天最常出現' : 'Most common recently'}: ${moodLabel}`);
    }
    if (favCount === 0) parts.push(isZh ? '還沒有收藏任何記錄。' : "Haven't favorited any entries yet.");
    else parts.push(isZh ? `已收藏 ${favCount} 條記錄。` : `Favorited ${favCount} entries.`);
    if (lunaCount > 0) parts.push(isZh ? `Luna 參與了 ${lunaCount} 條記憶。` : `Luna contributed to ${lunaCount} memories.`);
    if (recentTotal >= 10) parts.push(isZh ? '這幾天留下了不少潮痕。' : 'Quite a few tide traces these days.');
    if (parts.length === 0) parts.push(isZh ? '一起記錄更多潮痕吧。' : "Let's capture more tide traces together.");
    return parts;
  }, [entries, insights, trend30, isZh]);

  const handleQuickCreate = useCallback(() => {
    const text = createText.trim();
    if (!text) return;
    addMemoryEntry({
      scene: autoTitle(text), triggerText: '', bodyThoughts: text,
      anxietyLevel: 0, nextStep: '', moodV4: createMood,
    });
    setCreateText(''); setCreateMood('calm'); setCreateOpen(false);
    setSearchParams({}, { replace: true });
  }, [createText, createMood, addMemoryEntry, setSearchParams]);

  const handleCreateTodo = useCallback((entry: MemoryEntry) => {
    addTodo({ title: entryTitle(entry).slice(0, 40), date: new Date().toISOString().slice(0, 10), priority: 'medium', category: 'life', notes: entry.bodyThoughts || '', repeat: 'none', memoryRef: { id: entry.id, title: entryTitle(entry).slice(0, 60) } });
  }, [addTodo]);

  const handleSelectCard = useCallback((id: string) => {
    const entry = entries.find((item) => item.id === id);
    if (entry?.cardType === 'diet_receipt' && entry.dietReceiptId) {
      navigate('/life-ledger?section=diet');
      return;
    }
    if (entry?.cardType === 'sleep_receipt' && entry.sleepReceiptId) {
      navigate('/life-rhythm');
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobilePanelId(prev => prev === id ? null : id);
    } else {
      setSelectedId(prev => prev === id ? null : id);
    }
  }, [entries, navigate]);

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDeleteEntry = useCallback(() => {
    if (!deleteConfirmId) return;
    deleteMemoryEntry(deleteConfirmId);
    if (selectedId === deleteConfirmId) setSelectedId(null);
    if (mobilePanelId === deleteConfirmId) setMobilePanelId(null);
    setFavoritedIds(prev => { const next = new Set(prev); next.delete(deleteConfirmId); return next; });
    setPinnedIds(prev => { const next = new Set(prev); next.delete(deleteConfirmId); return next; });
    if (memoryEntries.length <= 1) setManageMode(false);
    setDeleteConfirmId(null);
    showToast(isZh ? '已刪除' : 'Deleted');
  }, [deleteConfirmId, deleteMemoryEntry, selectedId, mobilePanelId, memoryEntries.length, isZh, showToast]);

  // (old batchDelete uses same confirmDelete pattern — keep as-is)

  return (
    <section className="lm2-view view">
      <BackButton to="/" />
      <Header eyebrow={isZh ? '知識庫' : 'Knowledge Base'} title={isZh ? '第二大腦' : 'Second Brain'} />
      {recentSnippet && (
        <p className="lm2-recent-snippet">「{recentSnippet}」</p>
      )}

      {/* ── Phase 6: Mode tabs ── */}
      <div className="lm2-mode-tabs">
        <button type="button" className={`lm2-mode-tab${!lifeGraphMode ? ' is-active' : ''}`} onClick={() => { setLifeGraphMode(false); setActiveCategory('all'); setSearchQuery(''); }}>
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5V4.5A2.5 2.5 0 016.5 2Z"/></svg>
          <span>{isZh ? '知識庫' : 'Knowledge'}</span>
        </button>
        <button type="button" className={`lm2-mode-tab${lifeGraphMode ? ' is-active' : ''}`} onClick={() => setLifeGraphMode(true)}>
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={10} /><path d="M12 6v6l4 2" /></svg>
          <span>{isZh ? '生活圖譜' : 'Life Graph'}</span>
        </button>
        {lifeGraphMode && (
          <button type="button" className="lm2-mode-tab lm2-mode-tab--danger" onClick={() => setClearGraphConfirm(true)}
            style={{ marginLeft: 'auto', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            {isZh ? '清空圖譜' : 'Clear Graph'}
          </button>
        )}
      </div>

      {lifeGraphMode ? (
        /* ════════════════════ Life Graph Timeline ════════════════════ */
        <div className="lm2-lifegraph">
          {lifeGraphDays.length === 0 ? (
            <div className="lm2-empty">
              <div className="lm2-empty-moon" aria-hidden="true">
                <svg viewBox="0 0 160 160" width={96} height={96} fill="none" stroke="currentColor" strokeWidth={0.8} opacity={0.25}>
                  <circle cx={80} cy={80} r={64} strokeDasharray="4 6" />
                  <circle cx={80} cy={80} r={48} opacity={0.5} />
                  <path d="M80 40c-22 0-40 18-40 40s18 40 40 40c-12-12-12-68 0-80z" />
                </svg>
              </div>
              <p className="lm2-empty-title">{isZh ? '生活圖譜尚未成形' : 'Life Graph is forming'}</p>
              <p className="lm2-empty-desc">{isZh ? '當你開始記錄生活，月潮會慢慢理解你' : 'As you record your life, Lunartide will begin to understand you'}</p>
            </div>
          ) : (
            <>
              {/* ── Correlation Insights ── */}
              {correlations.length > 0 && (
                <div className="lm2-lg-correlations">
                  <div className="lm2-lg-corr-head">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2l2 7h7l-6 5 2 8-7-5-7 5 2-8-6-5h7z" opacity={0.35} /><circle cx={12} cy={12} r={3} opacity={0.6} /></svg>
                    <span>{isZh ? '跨模組洞察' : 'Cross-Module Insights'}</span>
                  </div>
                  <div className="lm2-lg-corr-list">
                    {correlations.map((c, i) => (
                      <div key={i} className={`lm2-lg-corr-card lm2-lg-corr--${c.strength}`}>
                        <span className="lm2-lg-corr-icon">{c.icon}</span>
                        <div className="lm2-lg-corr-body">
                          <div className="lm2-lg-corr-title">{c.title}</div>
                          <div className="lm2-lg-corr-desc">{c.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Daily Timeline ── */}
              <div className="lm2-lg-timeline">
                {lifeGraphDays.map(day => (
                  <div key={day.date} className="lm2-lg-day">
                    <div className="lm2-lg-day-head">
                      <div className="lm2-lg-day-dot" />
                      <span className="lm2-lg-day-label">{day.label}</span>
                      <span className="lm2-lg-day-count">{day.entries.length}</span>
                    </div>
                    <div className="lm2-lg-day-items">
                      {day.entries.map(e => (
                        <div
                          key={e.id}
                          className="lm2-lg-entry"
                          style={{ '--lg-color': e.color } as React.CSSProperties}
                          role={e.type === 'memory' ? 'button' : undefined}
                          tabIndex={e.type === 'memory' ? 0 : undefined}
                          onClick={e.type === 'memory'
                            ? () => handleSelectCard(e.id)
                            : e.type === 'sleep_receipt'
                                  ? () => navigate('/life-rhythm')
                                  : undefined}
                          onKeyDown={e.type === 'memory' || e.type === 'sleep_receipt' ? ev => {
                            if (ev.key !== 'Enter') return;
                            if (e.type === 'memory') handleSelectCard(e.id);
                            else if (e.type === 'sleep_receipt') navigate('/life-rhythm');
                          } : undefined}
                        >
                          <div className="lm2-lg-entry-line" />
                          <div className="lm2-lg-entry-dot" style={{ background: e.color, borderColor: e.color }} />
                          <div className="lm2-lg-entry-content">
                            <div className="lm2-lg-entry-top">
                              <span className="lm2-lg-entry-icon">{e.icon}</span>
                              <span className="lm2-lg-entry-label">{e.label}</span>
                            </div>
                            <div className="lm2-lg-entry-detail">{e.detail}</div>
                            {e.subDetail && <div className="lm2-lg-entry-sub">{e.subDetail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (<>
      {/* Top toolbar: Search + Manage + Sort */}
      <div className="lm2-toolbar">
        <div className="lm2-search-wrap">
          <svg className="lm2-search-icon" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8} /><line x1={21} y1={21} x2={16.65} y2={16.65} /></svg>
          <input type="search" className="lm2-search-input" placeholder={isZh ? '搜尋標題、內容、標籤...' : 'Search title, content, tags...'} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSelectedIds(new Set()); }} />
          {searchQuery && <button type="button" className="lm2-search-clear" onClick={() => { setSearchQuery(''); setSelectedIds(new Set()); }}>✕</button>}
        </div>
        {entries.length > 0 && (
          <div className="lm2-toolbar-actions">
            <button
              type="button"
              className={`lm2-view-toggle`}
              onClick={() => setViewMode(v => v === 'card' ? 'timeline' : 'card')}
              title={viewMode === 'card' ? (isZh ? '時間軸模式' : 'Timeline view') : (isZh ? '卡片模式' : 'Card view')}
            >
              {viewMode === 'card' ? (
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={3} y1={4} x2={21} y2={4} /><line x1={3} y1={12} x2={21} y2={12} /><line x1={3} y1={20} x2={21} y2={20} /><circle cx={7} cy={4} r={1} fill="currentColor" /><circle cx={7} cy={12} r={1} fill="currentColor" /><circle cx={7} cy={20} r={1} fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={3} width={7} height={7} rx={1} /><rect x={14} y={3} width={7} height={7} rx={1} /><rect x={3} y={14} width={7} height={7} rx={1} /><rect x={14} y={14} width={7} height={7} rx={1} /></svg>
              )}
            </button>
            <button
              type="button"
              className="lm2-review-btn"
              onClick={() => pickReview('random')}
              title={isZh ? '回顧' : 'Review'}
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>
            </button>
            <button
              type="button"
              className={`lm2-manage-btn${manageMode ? ' is-active' : ''}`}
              onClick={() => { setManageMode(v => !v); setSelectedIds(new Set()); setConfirmDelete(false); setShowTagInput(false); }}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><line x1={8} y1={6} x2={21} y2={6} /><line x1={8} y1={12} x2={21} y2={12} /><line x1={8} y1={18} x2={21} y2={18} /><circle cx={4} cy={6} r={1} fill="currentColor" /><circle cx={4} cy={12} r={1} fill="currentColor" /><circle cx={4} cy={18} r={1} fill="currentColor" /></svg>
              <span>{isZh ? '管理' : 'Manage'}</span>
            </button>
            <div className="lm2-sort-select-wrap">
              <svg className="lm2-sort-icon" viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={4} y1={6} x2={16} y2={6} /><line x1={4} y1={12} x2={12} y2={12} /><line x1={4} y1={18} x2={8} y2={18} /></svg>
              <select className="lm2-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                {sortOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Type filter chips */}
      <div className="scroll-tabs lm2-filter-row">
        {TYPE_FILTERS.map(f => {
          const isActive = activeCategory === f.id;
          const count = catCounts.get(f.id) ?? 0;
          return (
            <button
              key={f.id}
              type="button"
              className={`scroll-tab lm2-filter-chip${isActive ? ' active' : ''}`}
              onClick={() => { setActiveCategory(f.id); setSelectedIds(new Set()); }}
            >
              <span>{f.label}</span>
              {count > 0 && <span className="scroll-tab-count lm2-filter-chip-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Management header: select all */}
      {manageMode && filtered.length > 0 && (
        <div className="lm2-manage-header">
          <button type="button" className="lm2-select-toggle" onClick={toggleSelectAll}>
            <span className={`lm2-checkbox${selectedIds.size === filtered.length ? ' checked' : ''}`}>
              {selectedIds.size === filtered.length && (
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </span>
            <span>{isZh ? '全選' : 'Select all'}</span>
            <span className="lm2-manage-count">{selectedIds.size}/{filtered.length}</span>
          </button>
        </div>
      )}

      {/* Three-column layout */}
      <div className={`lm2-layout${catCollapsed ? ' cat-collapsed' : ''}${selectedId ? ' has-panel' : ''}`}>
        {/* ── Left: Categories ── */}
        <nav className={`lm2-categories${catCollapsed ? ' is-collapsed' : ''}`}>
          <button type="button" className="lm2-cat-collapse-btn" onClick={() => setCatCollapsed(v => !v)} title={catCollapsed ? (isZh ? '展開分類' : 'Expand') : (isZh ? '收合分類' : 'Collapse')}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: catCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button key={cat.id} type="button" className={`lm2-cat-btn${isActive ? ' active' : ''}`} onClick={() => { setActiveCategory(cat.id); setSelectedIds(new Set()); }} title={catCollapsed ? cat.label : ''}>
                <span className="lm2-cat-icon">{cat.svg(17, isActive)}</span>
                {!catCollapsed && (
                  <>
                    <span className="lm2-cat-label">{cat.label}</span>
                    <span className="lm2-cat-count">{catCounts.get(cat.id) ?? 0}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Center: Stream ── */}
        <div className="lm2-stream">
          {entries.length === 0 ? (
            /* Empty state — moon-tide breathing */
            <div className="lm2-empty">
              <div className="lm2-empty-moon" aria-hidden="true">
                <svg viewBox="0 0 160 160" width={96} height={96} fill="none" stroke="currentColor" strokeWidth={0.8} opacity={0.25}>
                  <circle cx={80} cy={80} r={64} strokeDasharray="4 6" />
                  <circle cx={80} cy={80} r={48} opacity={0.5} />
                  <path d="M80 40c-22 0-40 18-40 40s18 40 40 40c-12-12-12-68 0-80z" />
                  <ellipse cx={80} cy={120} rx={48} ry={8} opacity={0.2} />
                  <path d="M56 72l8-4m32 4l-8-4M72 64l4-8m8 8l4 8" strokeWidth={0.5} opacity={0.4} />
                </svg>
              </div>
              <p className="lm2-empty-title">{isZh ? '月潮尚未留下痕跡' : 'The tide has not yet left its mark'}</p>
              <p className="lm2-empty-desc">{isZh ? '每一筆記錄都是月光的碎片，靜靜等待被拾起' : 'Each record is a shard of moonlight, waiting to be gathered'}</p>
              <div className="lm2-empty-actions">
                {!createOpen ? (
                  <>
                    <button type="button" className="lm2-empty-btn lm2-empty-btn--primary" onClick={() => setCreateOpen(true)}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} /></svg>
                      {isZh ? '記錄此刻' : 'Capture Now'}
                    </button>
                    <button type="button" className="lm2-empty-btn" onClick={() => navigate('/chat')}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                      {isZh ? '前往聊天' : 'Chat'}
                    </button>
                  </>
                ) : (
                  <div className="lm2-create-panel" style={{ width: '100%', maxWidth: 420 }}>
                    <textarea ref={createRef} className="lm2-create-input" placeholder={isZh ? '寫下此刻的想法…' : "What's on your mind…"} value={createText} onChange={e => setCreateText(e.target.value)} rows={3} />
                    <div className="lm2-create-footer">
                      <div className="lm2-mood-picker">
                        {MOODS.map(m => (
                          <button key={m.id} type="button" className={`lm2-mood-chip${createMood === m.id ? ' active' : ''}`} style={{ '--mood-color': m.color } as React.CSSProperties} onClick={() => setCreateMood(m.id)} title={m.label}>
                            <MoodAvatarPNG mood={m.id} size={16} /><span className="lm2-mood-label">{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="lm2-create-actions">
                        <button type="button" className="lm2-create-cancel" onClick={() => { setCreateOpen(false); setCreateText(''); setCreateMood('calm'); }}>{isZh ? '取消' : 'Cancel'}</button>
                        <button type="button" className="lm2-create-save" onClick={handleQuickCreate} disabled={!createText.trim()}>{isZh ? '儲存' : 'Save'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ── Journal Composer Card ── */
              !manageMode && (
                !createOpen ? (
                  <button type="button" className="lm2-journal-composer" onClick={() => setCreateOpen(true)}>
                    <div className="lm2-journal-composer-inner">
                      <svg className="lm2-journal-composer-art" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                        <line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} />
                      </svg>
                      <div className="lm2-journal-composer-text">
                        <span className="lm2-journal-composer-prompt">{isZh ? '今天想留下什麼？' : 'What do you want to capture today?'}</span>
                        <span className="lm2-journal-composer-hint">{isZh ? '點擊開始書寫' : 'Click to write'}</span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="lm2-create-panel">
                    <textarea ref={createRef} className="lm2-create-input" placeholder={isZh ? '寫下此刻的想法…' : "What's on your mind…"} value={createText} onChange={e => setCreateText(e.target.value)} rows={3} />
                    <div className="lm2-create-footer">
                      <div className="lm2-mood-picker">
                        {MOODS.map(m => (
                          <button key={m.id} type="button" className={`lm2-mood-chip${createMood === m.id ? ' active' : ''}`} style={{ '--mood-color': m.color } as React.CSSProperties} onClick={() => setCreateMood(m.id)} title={m.label}>
                            <MoodAvatarPNG mood={m.id} size={16} /><span className="lm2-mood-label">{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="lm2-create-actions">
                        <button type="button" className="lm2-create-cancel" onClick={() => { setCreateOpen(false); setCreateText(''); setCreateMood('calm'); }}>{isZh ? '取消' : 'Cancel'}</button>
                        <button type="button" className="lm2-create-save" onClick={handleQuickCreate} disabled={!createText.trim()}>{isZh ? '儲存' : 'Save'}</button>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* ── Stream ── */}
              {filtered.length === 0 ? (
                <div className="lm2-empty-sm">
                  <p>{searchQuery.trim() || activeCategory !== 'all' ? (isZh ? '沒有找到相關的潮痕' : 'No matching tide traces') : (isZh ? '此分類尚無記錄' : 'No entries in this category')}</p>
                </div>
              ) : viewMode === 'card' ? (
                <div className="lm2-stream-scroll">
                  {grouped.map(group => (
                    <div key={group.id} className="lm2-group">
                      <div className="lm2-group-head">
                        <span className="lm2-group-label">{group.label}</span>
                        <span className="lm2-group-count">{group.items.length}</span>
                      </div>
                      <div className="lm2-group-cards">
                        {group.items.map(entry => {
                          const meta = sourceMeta(entry);
                          const moodCfg = entry.moodV4 ? MOOD_BY_ID[entry.moodV4] : null;
                          const isPinned = pinnedIds.has(entry.id);
                          const isActive = entry.id === selectedId;
                          const isSelected = selectedIds.has(entry.id);
                          const title = entryTitle(entry);
                          const preview = entryPreview(entry, 4);
                          return (
                            <div key={entry.id} className={`lm2-card-wrap${isSelected ? ' is-selected' : ''}`}>
                              {manageMode && (
                                <button
                                  type="button"
                                  className={`lm2-card-check${isSelected ? ' checked' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(entry.id); }}
                                  aria-label={isZh ? '選取' : 'Select'}
                                >
                                  {isSelected && (
                                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                className={`lm2-card${isPinned ? ' pinned' : ''}${isActive ? ' active' : ''}${manageMode ? ' manage-mode' : ''}`}
                                onClick={() => manageMode ? toggleSelect(entry.id) : handleSelectCard(entry.id)}
                              >
                                <div className="lm2-card-inner">
                                  <div className="lm2-card-top">
                                    <span className={`lm2-card-source ${meta.className}`}>{meta.icon} {meta.label}</span>
                                    <span className="lm2-card-time">{formatTime(entry.updatedAt)}</span>
                                  </div>
                                  {moodCfg && <span className="lm2-card-mood-strip" style={{ background: moodCfg.color }} />}
                                  <div className="lm2-card-body">
                                    <div className="lm2-card-title">{title}</div>
                                    {preview && <div className="lm2-card-preview">{preview}</div>}
                                  </div>
                                  <div className="lm2-card-footer">
                                    {moodCfg && <span className="lm2-card-mood-badge" style={{ background: colorMixin(moodCfg.color, 0.08), color: moodCfg.color }}><MoodAvatarPNG mood={entry.moodV4!} size={10} /> {MOOD_BY_ID[entry.moodV4!].label}</span>}
                                    {isPinned && <span className="lm2-card-badge pin-badge">📌</span>}
                                    {favoritedIds.has(entry.id) && <span className="lm2-card-badge fav-badge">★</span>}
                                    {entry.tags && entry.tags.length > 0 && entry.tags.slice(0, 2).map(t => (
                                      <span key={t} className="lm2-card-tag">{t}</span>
                                    ))}
                                    {entry.category && <span className="lm2-card-tag">{entry.category}</span>}
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lm2-timeline">
                  {grouped.map(group => (
                    <div key={group.id} className="lm2-timeline-group">
                      <div className="lm2-timeline-group-head">
                        <div className="lm2-timeline-group-dot" />
                        <span className="lm2-timeline-group-label">{group.label}</span>
                        <span className="lm2-timeline-group-count">{group.items.length}</span>
                      </div>
                      <div className="lm2-timeline-items">
                        {group.items.map((entry, i) => {
                          const moodCfg = entry.moodV4 ? MOOD_BY_ID[entry.moodV4] : null;
                          const title = entryTitle(entry);
                          const preview = entryPreview(entry, 2);
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              className="lm2-timeline-item"
                              onClick={() => handleSelectCard(entry.id)}
                            >
                              <div className="lm2-timeline-dot" style={moodCfg ? { background: moodCfg.color, borderColor: moodCfg.color } : {}} />
                              <div className="lm2-timeline-line" />
                              <div className="lm2-timeline-content">
                                <div className="lm2-timeline-top">
                                  <span className={`lm2-timeline-source ${sourceMeta(entry).className}`}>{sourceMeta(entry).icon} {sourceMeta(entry).label}</span>
                                  <span className="lm2-timeline-time">{new Date(entry.updatedAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="lm2-timeline-title">{title}</div>
                                {preview && <div className="lm2-timeline-preview">{preview}</div>}
                                <div className="lm2-timeline-footer">
                                  {moodCfg && <span className="lm2-card-mood-badge" style={{ background: colorMixin(moodCfg.color, 0.08), color: moodCfg.color }}><MoodAvatarPNG mood={entry.moodV4!} size={10} /> {MOOD_BY_ID[entry.moodV4!].label}</span>}
                                  {favoritedIds.has(entry.id) && <span className="lm2-card-badge fav-badge">★</span>}
                                  {entry.tags && entry.tags.length > 0 && entry.tags.slice(0, 2).map(t => (
                                    <span key={t} className="lm2-card-tag">{t}</span>
                                  ))}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {/* ── Management Toolbar (floating bottom) ── */}
          {manageMode && selectedIds.size > 0 && (
            <div className="lm2-manage-bar">
              <span className="lm2-manage-bar-count">{isZh ? `已選 ${selectedIds.size} 項` : `${selectedIds.size} selected`}</span>
              <div className="lm2-manage-bar-actions">
                {showTagInput ? (
                  <div className="lm2-manage-tag-input-wrap">
                    <input
                      className="lm2-manage-tag-input"
                      placeholder={isZh ? '輸入標籤，逗號分隔...' : 'Tags, comma separated...'}
                      value={tagValue}
                      onChange={e => setTagValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') batchTag(); if (e.key === 'Escape') setShowTagInput(false); }}
                      autoFocus
                    />
                    <button type="button" className="lm2-manage-bar-btn lm2-manage-bar-btn--apply" onClick={batchTag}>{isZh ? '套用' : 'Apply'}</button>
                    <button type="button" className="lm2-manage-bar-btn" onClick={() => setShowTagInput(false)}>{isZh ? '取消' : 'Cancel'}</button>
                  </div>
                ) : (
                  <>
                    <button type="button" className={`lm2-manage-bar-btn${confirmDelete ? ' lm2-manage-bar-btn--danger' : ''}`} onClick={batchDelete}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      {confirmDelete ? (isZh ? '確認刪除' : 'Confirm') : (isZh ? '刪除' : 'Delete')}
                    </button>
                    {confirmDelete && (
                      <button type="button" className="lm2-manage-bar-btn" onClick={() => setConfirmDelete(false)}>{isZh ? '取消' : 'Cancel'}</button>
                    )}
                    {!confirmDelete && (
                      <>
                        <button type="button" className="lm2-manage-bar-btn" onClick={batchFav}>
                          <svg viewBox="0 0 24 24" width={13} height={13} fill={allSelectedFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          {isZh ? '收藏' : 'Fav'}
                        </button>
                        <button type="button" className="lm2-manage-bar-btn" onClick={() => setShowTagInput(true)}>
                          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1={7} y1={7} x2={7.01} y2={7} /></svg>
                          {isZh ? '標籤' : 'Tag'}
                        </button>
                        <button type="button" className="lm2-manage-bar-btn" onClick={batchMove}>
                          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 11l-3 3 3 3" /><path d="M2 14h10l3-4M19 13l3-3-3-3" /><path d="M22 10H12L9 14" /></svg>
                          {isZh ? '移動' : 'Move'}
                        </button>
                        <button type="button" className="lm2-manage-bar-btn" onClick={clearSelection}>
                          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Insights at bottom (P1 footer summary) ── */}
          {entries.length > 0 && (
            <div className={`lm2-insights${insightsOpen ? ' is-open' : ''}`} style={{ marginTop: 24 }}>
              <button type="button" className="lm2-insights-toggle" onClick={() => setInsightsOpen(v => !v)}>
                <span className="lm2-insights-toggle-label">
                  {insights.topMood && (
                    <span className="lm2-insights-mood-inline" style={{ color: MOOD_BY_ID[insights.topMood].color }}>
                      <MoodAvatarPNG mood={insights.topMood} size={14} />
                      <span>{MOOD_BY_ID[insights.topMood].label}</span>
                    </span>
                  )}
                  <span className="lm2-insights-summary">
                    {isZh ? '本月' : 'This month'} <strong>{insights.total}</strong> {isZh ? '則' : ''}
                    {insights.lastUpdate && (
                      <span className="lm2-insights-updated">{' · '}{new Date(insights.lastUpdate).getMonth() + 1}/{new Date(insights.lastUpdate).getDate()} {isZh ? '更新' : 'updated'}</span>
                    )}
                  </span>
                </span>
                <svg className="lm2-insights-chevron" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {insightsOpen && (
                <div className="lm2-insights-body">
                  {/* P4: 30-day trend mini chart */}
                  <div className="lm2-trend-section">
                    <div className="lm2-trend-label">{isZh ? '30 天潮位趨勢' : '30-Day Trend'}</div>
                    <div className="lm2-trend-bars">
                      {trend30.map((d, i) => {
                        const maxCount = Math.max(...trend30.map(t => t.count), 1);
                        const h = Math.max(2, Math.round((d.count / maxCount) * 24));
                        const topM = d.moods.length > 0 ? d.moods.sort((a, b) => d.moods.filter(m => m === b).length - d.moods.filter(m => m === a).length)[0] : null;
                        return (
                          <div key={i} className="lm2-trend-bar-wrap" title={`${d.day}: ${d.count}`}>
                            <div className="lm2-trend-bar" style={{ height: h, background: topM ? MOOD_BY_ID[topM].color : 'var(--text-3)', opacity: d.count > 0 ? 0.7 : 0.08 }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="lm2-tide-chart">
                    <div className="lm2-tide-label">
                      {insights.topMood ? MOOD_BY_ID[insights.topMood].label : (isZh ? '平淡釋然' : 'Calm')}
                    </div>
                    <div className="lm2-tide-bars">
                      {insights.tide.map((d, i) => {
                        const maxCount = Math.max(...insights.tide.map(t => t.count), 1);
                        const h = Math.max(3, Math.round((d.count / maxCount) * 28));
                        return (
                          <div key={i} className="lm2-tide-bar-wrap" title={`${d.day}: ${d.count}`}>
                            <div className="lm2-tide-bar" style={{ height: h, background: d.top ? MOOD_BY_ID[d.top].color : 'var(--text-3)', opacity: d.count > 0 ? 0.75 : 0.12 }} />
                            <span className="lm2-tide-day">{d.day}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lm2-tide-sub">{isZh ? '最近七日潮位' : '7-Day Tide'}</div>
                  </div>
                  <div className="lm2-stats-grid">
                    <div className="lm2-stats-section">
                      <div className="lm2-stats-section-title">{isZh ? '概覽' : 'Overview'}</div>
                      <div className="lm2-stats">
                        <div className="lm2-stat"><span className="lm2-stat-value">{insights.total}</span><span className="lm2-stat-label">{isZh ? '總記錄' : 'Total'}</span></div>
                        <div className="lm2-stat"><span className="lm2-stat-value">{insights.favCount}</span><span className="lm2-stat-label">{isZh ? '收藏' : 'Fav'}</span></div>
                        <div className="lm2-stat"><span className="lm2-stat-value">{monthAdditions}</span><span className="lm2-stat-label">{isZh ? '本月新增' : 'This month'}</span></div>
                      </div>
                    </div>
                    {topMoods.length > 0 && (
                      <div className="lm2-stats-section">
                        <div className="lm2-stats-section-title">{isZh ? '情緒分布' : 'Moods'}</div>
                        <div className="lm2-stats-tags">
                          {topMoods.map(m => {
                            const mood = MOOD_BY_ID[m.id];
                            return (
                              <span key={m.id} className="lm2-stats-tag" style={{ background: colorMixin(mood.color, 0.1), color: mood.color }}>
                                <MoodAvatarPNG mood={m.id} size={10} /> {mood.label} <span className="lm2-stats-tag-count">{m.count}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {summaryText && summaryText.topTags.length > 0 && (
                      <div className="lm2-stats-section">
                        <div className="lm2-stats-section-title">{isZh ? '熱門標籤' : 'Top Tags'}</div>
                        <div className="lm2-stats-tags">
                          {summaryText.topTags.map(([tag, count]) => (
                            <span key={tag} className="lm2-stats-tag"><span className="lm2-stats-tag-label">{tag}</span> <span className="lm2-stats-tag-count">{count}</span></span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Phase 5.5: AI Summary */}
                  {summaryText && (summaryText.weekCount > 0 || summaryText.topWeekTags.length > 0) && (
                    <div className="lm2-ai-summary">
                      <div className="lm2-ai-summary-head">
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2l2 7h7l-6 5 2 8-7-5-7 5 2-8-6-5h7z" opacity={0.35} /><circle cx={12} cy={12} r={3} opacity={0.6} /></svg>
                        <span>{isZh ? 'AI 洞察' : 'AI Insights'}</span>
                      </div>
                      <div className="lm2-ai-summary-body">
                        {summaryText.weekCount > 0 && (
                          <p className="lm2-ai-summary-line">
                            {isZh
                              ? `本週記錄了 ${summaryText.weekCount} 則${summaryText.weekMood ? `，最常出現的情緒是 ${MOOD_BY_ID[summaryText.weekMood].label}` : ''}。`
                              : `${summaryText.weekCount} entries this week${summaryText.weekMood ? `, mostly ${MOOD_BY_ID[summaryText.weekMood].label}` : ''}.`}
                          </p>
                        )}
                        {summaryText.monthCount > 0 && (
                          <p className="lm2-ai-summary-line">
                            {isZh
                              ? `本月共 ${summaryText.monthCount} 則記錄${summaryText.monthMood ? `，${MOOD_BY_ID[summaryText.monthMood].label} 的情緒較多` : ''}。`
                              : `${summaryText.monthCount} entries this month${summaryText.monthMood ? `, mostly ${MOOD_BY_ID[summaryText.monthMood].label}` : ''}.`}
                          </p>
                        )}
                        {summaryText.topWeekTags.length > 0 && (
                          <p className="lm2-ai-summary-line">
                            {isZh ? '本週常用標籤：' : 'This week\'s tags: '}
                            {summaryText.topWeekTags.map(([t, c]) => `${t} (${c})`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* P7: LUNARIS observation */}
                  {lunarisObservation && lunarisObservation.length > 0 && (
                    <div className="lm2-lunaris-obs">
                      <div className="lm2-lunaris-obs-head">
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx={12} cy={12} r={8} /><circle cx={12} cy={12} r={3} opacity={0.5} /></svg>
                        <span>{isZh ? 'LUNARIS 發現' : 'LUNARIS observes'}</span>
                      </div>
                      <div className="lm2-lunaris-obs-body">
                        {lunarisObservation.map((line, i) => (
                          <p key={i} className="lm2-lunaris-obs-line">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Desktop: Inline detail panel (third grid column, >=1024px) ── */}
        {selectedEntry && (
          <div className="lm2-detail-panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="lm2-detail-close" onClick={() => setSelectedId(null)} title={isZh ? '關閉' : 'Close'}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
            </button>
            <div className="lm2-detail-scroll">
              {selectedEntry.moodV4 && (
                <div className="lm2-panel-mood" style={{ borderLeftColor: MOOD_BY_ID[selectedEntry.moodV4].color, borderLeftWidth: 3, marginBottom: 12 }}>
                  <MoodAvatarPNG mood={selectedEntry.moodV4} size={18} />
                  <span style={{ fontWeight: 600 }}>{MOOD_BY_ID[selectedEntry.moodV4].label}</span>
                </div>
              )}
              <h2 className="lm2-panel-title">{entryTitle(selectedEntry)}</h2>
              <div className="lm2-panel-meta">
                <span className="lm2-panel-time">{new Date(selectedEntry.updatedAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {(selectedEntry.category || selectedEntry.moodV4) && (
                <div className="lm2-panel-tags">
                  <span className={`lm2-panel-source-badge ${sourceMeta(selectedEntry).className}`}>{sourceMeta(selectedEntry).icon} {sourceMeta(selectedEntry).label}</span>
                  {selectedEntry.moodV4 && <span className="lm2-panel-tag-chip" style={{ background: colorMixin(MOOD_BY_ID[selectedEntry.moodV4].color, 0.08), color: MOOD_BY_ID[selectedEntry.moodV4].color }}>{MOOD_BY_ID[selectedEntry.moodV4].label}</span>}
                </div>
              )}
              <div className="lm2-panel-text">{selectedEntry.bodyThoughts || selectedEntry.summary || (isZh ? '（無內容）' : '(No content)')}</div>
              {relatedEntries.length > 0 && (
                <div className="lm2-panel-related">
                  <span className="lm2-panel-section-label">{isZh ? '相關記錄' : 'Related'}</span>
                  <div className="lm2-related-list">
                    {relatedEntries.map(re => (
                      <button key={re.id} type="button" className="lm2-related-item" onClick={() => setSelectedId(re.id)}>
                        <span className="lm2-related-icon">{sourceMeta(re).icon}</span>
                        <span className="lm2-related-title">{entryTitle(re)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="lm2-detail-toolbar">
              <button type="button" className="lm2-panel-tool-btn" onClick={() => handleCreateTodo(selectedEntry)}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                <span>{isZh ? '待辦' : 'Todo'}</span>
              </button>
              <button type="button" className={`lm2-panel-tool-btn${favoritedIds.has(selectedEntry.id) ? ' active' : ''}`} onClick={() => toggleFav(selectedEntry.id)}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill={favoritedIds.has(selectedEntry.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                <span>{isZh ? '收藏' : 'Fav'}</span>
              </button>
              <button type="button" className={`lm2-panel-tool-btn${pinnedIds.has(selectedEntry.id) ? ' active' : ''}`} onClick={() => togglePin(selectedEntry.id)}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={12} y1={17} x2={12} y2={22} /><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24Z" /></svg>
                <span>{isZh ? '置頂' : 'Pin'}</span>
              </button>
              <button type="button" className="lm2-panel-tool-btn lm2-panel-tool-danger" onClick={() => handleDelete(selectedEntry.id)}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                <span>{isZh ? '刪除' : 'Delete'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Close lifeGraphMode false branch */}
      </>)}

      {/* Desktop: Reading drawer (slides in from right) */}
      {selectedEntry && (
        <div className="lm2-drawer-overlay" onClick={() => setSelectedId(null)}>
          <div className="lm2-drawer-panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="lm2-drawer-close" onClick={() => setSelectedId(null)}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="18 6 12 12 18 18" /></svg>
            </button>
            <div className="lm2-panel-content">
              {selectedEntry.moodV4 && (
                <div className="lm2-panel-mood" style={{ borderLeftColor: MOOD_BY_ID[selectedEntry.moodV4].color, borderLeftWidth: 3, marginBottom: 12 }}>
                  <MoodAvatarPNG mood={selectedEntry.moodV4} size={18} />
                  <span style={{ fontWeight: 600 }}>{MOOD_BY_ID[selectedEntry.moodV4].label}</span>
                </div>
              )}
              <h2 className="lm2-panel-title">{entryTitle(selectedEntry)}</h2>
              <div className="lm2-panel-meta">
                <span className="lm2-panel-time">{new Date(selectedEntry.updatedAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {(selectedEntry.category || selectedEntry.moodV4) && (
                <div className="lm2-panel-tags">
                  <span className={`lm2-panel-source-badge ${sourceMeta(selectedEntry).className}`}>{sourceMeta(selectedEntry).icon} {sourceMeta(selectedEntry).label}</span>
                  {selectedEntry.moodV4 && <span className="lm2-panel-tag-chip" style={{ background: colorMixin(MOOD_BY_ID[selectedEntry.moodV4].color, 0.08), color: MOOD_BY_ID[selectedEntry.moodV4].color }}>{MOOD_BY_ID[selectedEntry.moodV4].label}</span>}
                </div>
              )}
              <div className="lm2-panel-text">{selectedEntry.bodyThoughts || selectedEntry.summary || (isZh ? '（無內容）' : '(No content)')}</div>
              {relatedEntries.length > 0 && (
                <div className="lm2-panel-related">
                  <span className="lm2-panel-section-label">{isZh ? '相關記錄' : 'Related'}</span>
                  <div className="lm2-related-list">
                    {relatedEntries.map(re => (
                      <button key={re.id} type="button" className="lm2-related-item" onClick={() => setSelectedId(re.id)}>
                        <span className="lm2-related-icon">{sourceMeta(re).icon}</span>
                        <span className="lm2-related-title">{entryTitle(re)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="lm2-panel-toolbar" style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                <button type="button" className="lm2-panel-tool-btn" onClick={() => handleCreateTodo(selectedEntry)}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                  <span>{isZh ? '待辦' : 'Todo'}</span>
                </button>
                <button type="button" className={`lm2-panel-tool-btn${favoritedIds.has(selectedEntry.id) ? ' active' : ''}`} onClick={() => toggleFav(selectedEntry.id)}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill={favoritedIds.has(selectedEntry.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  <span>{isZh ? '收藏' : 'Fav'}</span>
                </button>
                <button type="button" className={`lm2-panel-tool-btn${pinnedIds.has(selectedEntry.id) ? ' active' : ''}`} onClick={() => togglePin(selectedEntry.id)}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={12} y1={17} x2={12} y2={22} /><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24Z" /></svg>
                  <span>{isZh ? '置頂' : 'Pin'}</span>
                </button>
                <button type="button" className="lm2-panel-tool-btn lm2-panel-tool-danger" onClick={() => handleDelete(selectedEntry.id)}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  <span>{isZh ? '刪除' : 'Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LUNARIS guide — contextual based on state */}
      {!selectedEntry && !searchQuery && entries.length > 0 && (
        <div className="lm2-lunaris-hint">
          <svg className="lm2-lunaris-hint-art" viewBox="0 0 48 48" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.2}>
            <circle cx={24} cy={22} r={10} /><circle cx={24} cy={22} r={5} opacity={0.5} />
            <ellipse cx={24} cy={44} rx={14} ry={4} opacity={0.2} />
            <line x1={24} y1={12} x2={24} y2={8} opacity={0.3} /><line x1={14} y1={22} x2={10} y2={22} opacity={0.3} /><line x1={34} y1={22} x2={38} y2={22} opacity={0.3} />
          </svg>
          <span className="lm2-lunaris-hint-text">
            {entries.length === 1
              ? (isZh ? '你的第二大腦目前只有一頁。' : 'Your second brain has just one page.')
              : entries.length >= 20
                ? (isZh ? '最近留下了很多潮痕呢。' : 'Many tide traces left recently.')
                : (isZh ? '點擊左側記錄閱讀內容。' : 'Click a card to read.')}
          </span>
        </div>
      )}
      {searchQuery && filtered.length > 0 && (
        <div className="lm2-lunaris-hint">
          <svg className="lm2-lunaris-hint-art" viewBox="0 0 48 48" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.2}>
            <circle cx={24} cy={22} r={10} /><circle cx={24} cy={22} r={5} opacity={0.5} />
            <ellipse cx={24} cy={44} rx={14} ry={4} opacity={0.2} />
          </svg>
          <span className="lm2-lunaris-hint-text">{isZh ? '我正在幫你翻找記憶。' : 'Looking through your memories…'}</span>
        </div>
      )}

      {/* ── Mobile: category drawer ── */}
      <button type="button" className="lm2-mobile-cat-trigger" onClick={() => setMobileCatOpen(v => !v)}>
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><line x1={4} y1={6} x2={20} y2={6} /><line x1={4} y1={12} x2={20} y2={12} /><line x1={4} y1={18} x2={20} y2={18} /></svg>
        <span>{TYPE_FILTERS.find(c => c.id === activeCategory)?.label || (isZh ? '全部' : 'All')}</span>
        <span className="lm2-mobile-cat-count">{filtered.length}</span>
      </button>
      {mobileCatOpen && (
        <div className="lm2-mobile-drawer-overlay" onClick={() => setMobileCatOpen(false)}>
          <div className="lm2-mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="lm2-mobile-drawer-handle" />
            {TYPE_FILTERS.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} type="button" className={`lm2-mobile-drawer-btn${isActive ? ' active' : ''}`} onClick={() => { setActiveCategory(cat.id); setMobileCatOpen(false); }}>
                  <span>{cat.label}</span><span className="lm2-cat-count">{catCounts.get(cat.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile bottom sheet panel — portal for z-index isolation */}
      {mobilePanelEntry && createPortal(
        <>
          <div className="lm2-mobile-panel-overlay" onClick={() => setMobilePanelId(null)} />
          <div className="lm2-mobile-panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="lm2-mobile-panel-close" onClick={() => setMobilePanelId(null)}>✕</button>
            <div className="lm2-panel-toolbar">
              <button type="button" className="lm2-panel-tool-btn" onClick={() => handleCreateTodo(mobilePanelEntry)}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg><span>待辦</span></button>
              <button type="button" className={`lm2-panel-tool-btn${favoritedIds.has(mobilePanelEntry.id) ? ' active' : ''}`} onClick={() => toggleFav(mobilePanelEntry.id)}><svg viewBox="0 0 24 24" width={13} height={13} fill={favoritedIds.has(mobilePanelEntry.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>
              <button type="button" className={`lm2-panel-tool-btn${pinnedIds.has(mobilePanelEntry.id) ? ' active' : ''}`} onClick={() => togglePin(mobilePanelEntry.id)}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><line x1={12} y1={17} x2={12} y2={22} /><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24Z" /></svg></button>
              <button type="button" className="lm2-panel-tool-btn lm2-panel-tool-danger" onClick={() => handleDelete(mobilePanelEntry.id)}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg><span>{isZh ? '刪除' : 'Delete'}</span></button>
            </div>
            {mobilePanelEntry.moodV4 && (
              <div className="lm2-panel-mood" style={{ borderLeftColor: MOOD_BY_ID[mobilePanelEntry.moodV4].color }}><MoodAvatarPNG mood={mobilePanelEntry.moodV4} size={13} /><span>{MOOD_BY_ID[mobilePanelEntry.moodV4].label}</span></div>
            )}
            <h2 className="lm2-panel-title">{entryTitle(mobilePanelEntry)}</h2>
            <div className="lm2-panel-text">{mobilePanelEntry.bodyThoughts || mobilePanelEntry.summary || (isZh ? '（無內容）' : '(No content)')}</div>
          </div>
        </>,
        document.body,
      )}

      {/* ── Review Modal ── */}
      {reviewEntry && (
        <div className="lm2-review-overlay" onClick={() => { setReviewEntry(null); setReviewType(null); }}>
          <div className="lm2-review-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="lm2-review-close" onClick={() => { setReviewEntry(null); setReviewType(null); }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
            </button>
            <div className="lm2-review-header">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>
              <span>
                {reviewType === 'daily' ? (isZh ? '每日回顧' : 'Daily Review')
                  : reviewType === 'weekly' ? (isZh ? '每週回顧' : 'Weekly Review')
                  : (isZh ? '隨機回顧' : 'Random Review')}
              </span>
            </div>
            <div className="lm2-review-content">
              {reviewEntry.moodV4 && (
                <div className="lm2-panel-mood" style={{ borderLeftColor: MOOD_BY_ID[reviewEntry.moodV4].color }}>
                  <MoodAvatarPNG mood={reviewEntry.moodV4} size={16} />
                  <span>{MOOD_BY_ID[reviewEntry.moodV4].label}</span>
                </div>
              )}
              <div className="lm2-review-date">
                {new Date(reviewEntry.updatedAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <h3 className="lm2-review-title">{entryTitle(reviewEntry)}</h3>
              <div className="lm2-review-text">{reviewEntry.bodyThoughts || reviewEntry.summary || (isZh ? '（無內容）' : '(No content)')}</div>
              {reviewEntry.tags && reviewEntry.tags.length > 0 && (
                <div className="lm2-review-tags">
                  {reviewEntry.tags.map(t => <span key={t} className="lm2-card-tag">{t}</span>)}
                </div>
              )}
            </div>
            <div className="lm2-review-actions">
              <button type="button" className="lm2-review-btn-action" onClick={() => pickReview(reviewType || 'random')}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
                <span>{isZh ? '下一則' : 'Next'}</span>
              </button>
              <button type="button" className="lm2-review-btn-action" onClick={() => { setSelectedId(reviewEntry.id); setReviewEntry(null); setReviewType(null); }}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx={12} cy={12} r={3} /></svg>
                <span>{isZh ? '詳細' : 'Detail'}</span>
              </button>
              <button type="button" className="lm2-review-btn-action" onClick={() => { setReviewEntry(null); setReviewType(null); }}>
                <span>{isZh ? '關閉' : 'Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Delete confirmation (portal, above mobile panel) ── */}
      {deleteConfirmId && createPortal(
        <div className="quick-sheet-overlay active" onClick={() => setDeleteConfirmId(null)} style={{ zIndex: 2300 }}>
          <div className="quick-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: 'auto', padding: '20px 22px 24px', gap: 12 }}>
            <div className="quick-sheet-handle" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{isZh ? '刪除這條記憶？' : 'Delete this memory?'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{isZh ? '刪除後無法復原。' : 'This action cannot be undone.'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 12 }}>{isZh ? '取消' : 'Cancel'}</button>
              <button type="button" className="btn-primary" onClick={confirmDeleteEntry} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'var(--danger)', borderColor: 'var(--danger)' }}>{isZh ? '刪除' : 'Delete'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* ── Clear Life Graph confirmation ── */}
      {clearGraphConfirm && createPortal(
        <div className="quick-sheet-overlay active" onClick={() => setClearGraphConfirm(false)} style={{ zIndex: 2300 }}>
          <div className="quick-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: 'auto', padding: '20px 22px 24px', gap: 12 }}>
            <div className="quick-sheet-handle" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{isZh ? '清空生活圖譜？' : 'Clear Life Graph?'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{isZh ? '這會移除自動生成的生活事件記錄，但不刪除手寫記憶。' : 'This removes auto-generated life events but keeps manual memories.'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-ghost" onClick={() => setClearGraphConfirm(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 12 }}>{isZh ? '取消' : 'Cancel'}</button>
              <button type="button" className="btn-primary" onClick={() => {
                clearLifeGraphData();
                setClearGraphConfirm(false);
                showToast(isZh ? '已清空生活圖譜' : 'Life Graph cleared');
              }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'var(--danger)', borderColor: 'var(--danger)' }}>{isZh ? '清空' : 'Clear'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
