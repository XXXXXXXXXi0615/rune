import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { BackButton } from '@/components/layout/BackButton';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import { getLanguage } from '@/i18n';
import type { TodoItem } from '@/types';
import { TicketPrinter } from '@/components/todo/TicketPrinter';
import type { PrinterTodoData } from '@/components/todo/TicketPrinter';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { playComplete, playPunch } from '@/utils/sounds';
import '@/styles/todo-page.css';

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(now = new Date()): { start: Date; end: Date } {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getDeadline(todo: Pick<TodoItem, 'date' | 'time'>): Date | null {
  if (!todo.date) return null;
  const deadline = new Date(`${todo.date}T${todo.time || '23:59'}:00`);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function isOverdue(todo: Pick<TodoItem, 'date' | 'time' | 'completed'>, now = new Date()): boolean {
  const deadline = getDeadline(todo);
  return !todo.completed && deadline !== null && deadline.getTime() < now.getTime();
}

function isToday(date: string): boolean {
  return date === todayDateString();
}

function isTomorrow(date: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return date === tomorrow;
}

function isThisWeek(date: string): boolean {
  const value = new Date(`${date}T12:00:00`);
  const range = getWeekRange();
  return value >= range.start && value <= range.end;
}

function isCreatedToday(createdAt: number, now = new Date()): boolean {
  const created = new Date(createdAt);
  return created.getFullYear() === now.getFullYear()
    && created.getMonth() === now.getMonth()
    && created.getDate() === now.getDate();
}

function isCreatedThisWeek(createdAt: number, now = new Date()): boolean {
  const created = new Date(createdAt);
  const range = getWeekRange(now);
  return created >= range.start && created <= range.end;
}

function formatDisplay(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${parseInt(y, 10)}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function remainingLabel(date: string, time?: string): string {
  if (!date) return '未設定截止時間';
  const now = new Date();
  const target = new Date(date + (time ? `T${time}:00` : 'T23:59:59'));
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.ceil(diffMs / 60000);

  if (diffMinutes <= 0) {
    const overdueMinutes = Math.abs(diffMinutes);
    if (overdueMinutes < 60) return `逾期 ${Math.max(1, overdueMinutes)} 分鐘`;
    if (overdueMinutes < 1440) return `逾期 ${Math.ceil(overdueMinutes / 60)} 小時`;
    return `逾期 ${Math.max(1, Math.ceil(overdueMinutes / 1440))} 天`;
  }
  if (diffMinutes < 60) return `還有 ${diffMinutes} 分鐘`;
  if (diffMinutes < 1440) return `還有 ${Math.ceil(diffMinutes / 60)} 小時`;
  return `還有 ${Math.ceil(diffMinutes / 1440)} 天`;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLunarisTip(todos: TodoItem[], isOverdueFn: typeof isOverdue, isCreatedTodayFn: typeof isCreatedToday): string | null {
  const todayTodos = todos.filter(t => isCreatedTodayFn(t.createdAt));
  const pending = todayTodos.filter(t => !t.completed).length;
  const completedToday = todayTodos.filter(t => t.completed).length;
  const overdueCount = todos.filter(t => isOverdueFn(t)).length;
  const totalPending = todos.filter(t => !t.completed).length;

  if (overdueCount > 0) {
    if (overdueCount === 1) return '有 1 項待辦已經逾期了，要重新安排時間嗎？';
    return `有 ${overdueCount} 項待辦已經逾期了，要不要先處理最緊急的？`;
  }
  if (totalPending > 8) return `你還有 ${totalPending} 項待辦未完成，先從最重要的 3 項開始吧！`;
  if (todayTodos.length > 3 && pending > 2) return `今天已經有 ${todayTodos.length} 項任務了，要不要先完成幾項再新增？`;
  if (completedToday >= 3) return `今天已經撕下 ${completedToday} 張票根了，做得很好！`;
  return null;
}

function parseQuickInput(text: string): { title: string; date: string; time?: string; priority: 'low' | 'medium' | 'high' } {
  let title = text.trim();
  if (!title) return { title: '', date: todayDateString(), priority: 'medium' };

  let date = todayDateString();
  let time: string | undefined;
  let priority: 'low' | 'medium' | 'high' = 'medium';
  const now = new Date();

  if (/緊急|重要|urgent|!!/.test(title)) {
    priority = 'high';
    title = title.replace(/緊急[：:]?\s*|important[：:]?\s*/i, '').trim();
  }
  if (/稍後|later/i.test(title)) {
    priority = 'low';
    title = title.replace(/稍後[：:]?\s*/i, '').trim();
  }

  if (/後天/.test(title)) {
    const d = new Date(now); d.setDate(d.getDate() + 2); date = toDateString(d);
    title = title.replace(/後天/g, '').trim();
  } else if (/明天|明日/.test(title)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); date = toDateString(d);
    title = title.replace(/明天|明日/g, '').trim();
  }
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`(?:這|本|下)?[週周]${dayNames[i]}`);
    if (re.test(title)) {
      const target = i; const cur = now.getDay(); let diff = target - cur;
      if (/下/.test(title)) diff += 7;
      else if (diff <= 0 && !/這|本/.test(title)) diff += 7;
      const d = new Date(now); d.setDate(d.getDate() + diff); date = toDateString(d);
      title = title.replace(re, '').trim(); break;
    }
  }

  const hm = title.match(/(\d{1,2})[:：](\d{2})\s*$/);
  if (hm) { time = `${hm[1].padStart(2, '0')}:${hm[2]}`; title = title.replace(hm[0], '').trim(); }

  return { title: title || '未命名待辦', date, time, priority };
}

type TicketStatus = 'today' | 'tomorrow' | 'week' | 'overdue' | 'completed';

function getTicketStatus(todo: TodoItem, visuallyComplete = todo.completed): { label: string; type: TicketStatus } | null {
  if (visuallyComplete) return { label: '已完成', type: 'completed' };
  if (isOverdue(todo)) return { label: remainingLabel(todo.date, todo.time), type: 'overdue' };
  if (isToday(todo.date)) return { label: '今天', type: 'today' };
  if (isTomorrow(todo.date)) return { label: '明天', type: 'tomorrow' };
  if (isThisWeek(todo.date)) return { label: '本週', type: 'week' };
  return null;
}

/* ════════════════════════════════════════
   Time Period (P9)
   ════════════════════════════════════════ */
type TimePeriod = 'morning' | 'afternoon' | 'evening';

const PERIODS: Record<TimePeriod, { label: string; icon: string }> = {
  morning:   { label: '早晨', icon: '🌤' },
  afternoon: { label: '下午', icon: '☀️' },
  evening:   { label: '晚上', icon: '🌙' },
};

function getTimePeriod(createdAt: number): TimePeriod {
  const h = new Date(createdAt).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/* ════════════════════════════════════════
   Category / Priority config (P3/P4)
   ════════════════════════════════════════ */
type TicketCategory = TodoItem['category'];

const CAT_COLORS: Record<TicketCategory, { color: string; ink: string; label: string }> = {
  life:      { color: '#738B67', ink: '#f6faF2', label: '生活' },
  work:      { color: '#506A89', ink: '#f2f6fa', label: '工作' },
  study:     { color: '#8A6FB6', ink: '#faf6ff', label: '學習' },
  lunartide: { color: '#5B5F66', ink: '#f7f7f7', label: '開發' },
  health:    { color: '#5D9C90', ink: '#f1fbf8', label: '健康' },
  shopping:  { color: '#D58A5C', ink: '#fff8f2', label: '購物' },
  other:     { color: '#8D8D8D', ink: '#fafafa', label: '其他' },
};

const CAT_ORDER: TicketCategory[] = ['life', 'work', 'study', 'lunartide', 'health', 'shopping', 'other'];

const COUNTDOWN_TYPE_LABEL: Record<string, string> = {
  anniversary: '紀念日',
  deadline:    '截止日',
  birthday:    '生日',
  project:     '專案',
  custom:      '自訂',
};

function getTicketCategory(category: TodoItem['category']): TicketCategory {
  return category;
}

function formatCreatedAt(value: number): string {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return '時間未記錄';
  return created.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function taskCode(ticketNumber: number): string {
  return `LUNA-${String(ticketNumber).padStart(3, '0')}`;
}

function barcodeBars(ticketNumber: number) {
  const seed = String(ticketNumber);
  return Array.from({ length: 36 }, (_, index) => {
    const code = seed.charCodeAt(index % seed.length) + index * 17;
    return { width: code % 4 === 0 ? 3 : code % 3 === 0 ? 2 : 1, height: 9 + (code % 16) };
  });
}

type FilterId = 'today' | 'week' | 'overdue' | 'completed';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'week', label: '本週' },
  { id: 'overdue', label: '已逾期' },
  { id: 'completed', label: '已完成' },
];

/* ════════════════════════════════════════
   SVG Icons (P1)
   ════════════════════════════════════════ */
function IconClipboard({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.35}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}

function IconArchive({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.35}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconCheckCircle({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.35}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/* ════════════════════════════════════════
   Ticket
   ════════════════════════════════════════ */
function TodoTicket({ todo, onDelete, onComplete }: {
  todo: TodoItem;
  onDelete: (id: string) => void;
  onComplete?: () => void;
}) {
  const toggleTodo = useAppStore(s => s.toggleTodo);
  const ticketCategory = getTicketCategory(todo.category);
  const cat = CAT_COLORS[ticketCategory];
  const overdue = isOverdue(todo);
  const bars = useMemo(() => barcodeBars(todo.ticketNumber), [todo.ticketNumber]);
  const [checking, setChecking] = useState(false);
  const [punched, setPunched] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
  }, []);

  const handleToggle = () => {
    if (checking) return;
    if (todo.completed) {
      toggleTodo(todo.id);
      return;
    }

    setChecking(true);
    setPunched(true);
    hapticLight();
    playPunch();
    setTimeout(() => {
      hapticSuccess();
      playComplete();
    }, 350);
    checkTimer.current = setTimeout(() => {
      toggleTodo(todo.id);
      setChecking(false);
      onComplete?.();
    }, 750);
  };

  const visuallyComplete = todo.completed || checking;
  const status = getTicketStatus(todo, visuallyComplete);
  const deadline = todo.date
    ? `${isToday(todo.date) ? '今天' : isTomorrow(todo.date) ? '明天' : formatDisplay(todo.date)}${todo.time ? ` ${todo.time}` : ''}`
    : '未設定';

  return (
    <article
      className={`todo-ticket${todo.completed ? ' is-completed' : ''}${checking ? ' is-checking' : ''}${overdue ? ' is-overdue' : ''}`}
      style={{
        '--ticket-band': cat.color,
        '--ticket-band-ink': cat.ink,
      } as React.CSSProperties}
    >
      <div className="ticket-band" style={{ '--ticket-band': todo.countdownRef?.color || cat.color, '--ticket-band-ink': cat.ink } as React.CSSProperties}>
        <span className="ticket-category">{cat.label}</span>
        {todo.countdownRef ? (
          <span className="ticket-countdown-badge">
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {COUNTDOWN_TYPE_LABEL[todo.countdownRef.type] || todo.countdownRef.customTypeLabel || todo.countdownRef.type}
          </span>
        ) : (
          <span className="ticket-series">LUNARTIDE PASS</span>
        )}
      </div>

      <span className="ticket-hole ticket-hole-left" aria-hidden="true" />
      <span className="ticket-hole ticket-hole-right" aria-hidden="true" />
      <div className="ticket-tear-line" aria-hidden="true" />

      <div className="ticket-body">
        <div className="ticket-id-row">
          <span>{taskCode(todo.ticketNumber)}</span>
          {todo.memoryRef && (
            <span className="ticket-memory-badge" title={todo.memoryRef.title}>
              <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              {todo.memoryRef.title.length > 14 ? todo.memoryRef.title.slice(0, 14) + '…' : todo.memoryRef.title}
            </span>
          )}
          <button
            type="button"
            className="ticket-delete"
            onClick={() => onDelete(todo.id)}
            aria-label={`刪除 ${todo.title || '未命名待辦'}`}
          >
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" />
            </svg>
          </button>
        </div>
        <h2 className="ticket-title">{todo.title || '未命名待辦'}</h2>
        {status && <span className={`ticket-status ticket-status-${status.type}`}>{status.label}</span>}

        <div className="ticket-facts">
          <div><span>建立時間</span><strong>{formatCreatedAt(todo.createdAt)}</strong></div>
          <div><span>優先序</span><strong>{todo.priority === 'high' ? '優先' : todo.priority === 'low' ? '稍後' : '一般'}</strong></div>
        </div>

        <div className="ticket-total-row">
          <div>
            <span className="ticket-total-label">DEADLINE</span>
            <strong className="ticket-countdown">{deadline}</strong>
          </div>
          <button
            type="button"
            className="ticket-complete"
            onClick={handleToggle}
            disabled={checking}
            aria-label={todo.completed ? '恢復為未完成' : '完成並撕下票根'}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.3" className={`check-svg${todo.completed ? ' is-completed' : ''}${checking ? ' is-checking' : ''}`}>
              <circle className="check-arc" cx="12" cy="12" r="9.5" strokeWidth="2" strokeLinecap="round" strokeDasharray="59.69" />
              <path className="check-mark" d="M6 13l4 4 8-9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="17" />
            </svg>
          </button>
        </div>

        <div className="ticket-barcode" aria-hidden="true">
          <div className="ticket-bars">
            {bars.map((bar, index) => (
              <span key={index} style={{ width: `${bar.width}px`, height: `${bar.height}px` }} />
            ))}
          </div>
          <span className="ticket-barcode-code">{taskCode(todo.ticketNumber)}</span>
        </div>
      </div>

      {/* Punch overlay */}
      <div className={`ticket-punch${punched ? ' is-punched' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="20" cy="20" r="16" />
          <circle cx="20" cy="20" r="8" fill="currentColor" opacity="0.15" />
        </svg>
      </div>
    </article>
  );
}

/* ════════════════════════════════════════
   Todo Page — Ticket Board
   ════════════════════════════════════════ */
export function TodoPage() {
  const navigate = useNavigate();
  const todos = useAppStore(s => s.todos);
  const deleteTodo = useAppStore(s => s.deleteTodo);
  const addTodo = useAppStore(s => s.addTodo);
  const healthRecords = useAppStore(s => s.healthRecords);
  const isZh = getLanguage() === 'zh-TW';

  const [activeFilter, setActiveFilter] = useState<FilterId>('today');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [quickInput, setQuickInput] = useState('');
  const [lunarisDismissed, setLunarisDismissed] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printingRef = useRef<PrinterTodoData | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  const handleCelebrate = useCallback(() => {
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    setCelebrationKey(k => k + 1);
    celebrateTimer.current = setTimeout(() => setCelebrationKey(0), 2200);
  }, []);

  const handlePrinted = useCallback(() => {
    const data = printingRef.current;
    if (!data) return;
    addTodo({ ...data, repeat: 'none' });
    printingRef.current = null;
    setIsPrinting(false);
    handleCelebrate();
  }, [addTodo, handleCelebrate]);

  const handleQuickAdd = () => {
    const parsed = parseQuickInput(quickInput);
    if (!parsed.title || parsed.title === '未命名待辦') return;
    printingRef.current = {
      title: parsed.title,
      date: parsed.date,
      time: parsed.time,
      priority: parsed.priority,
      category: 'life',
      createdAt: Date.now(),
    };
    setIsPrinting(true);
    setQuickInput('');
  };

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'today':
        return todos.filter(t => !t.completed && isCreatedToday(t.createdAt)).sort((a, b) => b.createdAt - a.createdAt);
      case 'week':
        return todos.filter(t => !t.completed && isCreatedThisWeek(t.createdAt)).sort((a, b) => b.createdAt - a.createdAt);
      case 'overdue':
        return todos.filter(t => isOverdue(t)).sort((a, b) => {
          const aDeadline = getDeadline(a)?.getTime() || Number.MAX_SAFE_INTEGER;
          const bDeadline = getDeadline(b)?.getTime() || Number.MAX_SAFE_INTEGER;
          return aDeadline - bDeadline;
        });
      case 'completed':
        return todos.filter(t => t.completed).sort((a, b) => b.updatedAt - a.updatedAt);
      default:
        return [];
    }
  }, [todos, activeFilter]);

  const counts = useMemo(() => ({
    today: todos.filter(t => isCreatedToday(t.createdAt)).length,
    week: todos.filter(t => isCreatedThisWeek(t.createdAt)).length,
    overdue: todos.filter(t => isOverdue(t)).length,
    completed: todos.filter(t => t.completed).length,
  }), [todos]);

  const [catFilter, setCatFilter] = useState<TicketCategory | null>(null);
  const [museumView, setMuseumView] = useState(false);
  const displayTodos = useMemo(() => {
    if (!catFilter) return filtered;
    return filtered.filter(t => getTicketCategory(t.category) === catFilter);
  }, [filtered, catFilter]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of filtered) {
      const category = getTicketCategory(t.category);
      m.set(category, (m.get(category) || 0) + 1);
    }
    return m;
  }, [filtered]);

  const todayFocus = useMemo(() => {
    const todayTodos = todos.filter(t => isCreatedToday(t.createdAt));
    const total = todayTodos.length;
    const completed = todayTodos.filter(t => t.completed).length;
    return { total, completed, rate: total > 0 ? completed / total : 0 };
  }, [todos]);

  const lunarisTip = useMemo(() => {
    if (lunarisDismissed) return null;
    return getLunarisTip(todos, isOverdue, isCreatedToday);
  }, [todos, lunarisDismissed]);

  const completedStats = useMemo(() => {
    const completed = todos.filter(t => t.completed);
    const total = completed.length;
    const days: { label: string; count: number }[] = [];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = toDateString(d);
      const count = completed.filter(t => toDateString(new Date(t.updatedAt)) === dateStr).length;
      days.push({ label: weekDays[d.getDay()], count });
    }
    return { total, days, maxCount: Math.max(...days.map(d => d.count), 1) };
  }, [todos]);

  const todayStats = useMemo(() => {
    const todayTodos = todos.filter(t => isCreatedToday(t.createdAt));
    const total = todayTodos.length;
    const completed = todayTodos.filter(t => t.completed).length;
    return {
      total,
      completed,
      uncompleted: total - completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [todos]);

  const weeklyCompleted = useMemo(() => {
    const localeDays = isZh ? ['一', '二', '三', '四', '五', '六', '日'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const dow = now.getDay();
    const mondayOff = dow === 0 ? -6 : 1 - dow;
    const days: { label: string; count: number; max: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + mondayOff + i);
      const dateStr = toDateString(d);
      const count = todos.filter(t => t.completed && toDateString(new Date(t.updatedAt)) === dateStr).length;
      days.push({ label: localeDays[i], count, max: 0 });
    }
    const maxCount = Math.max(...days.map(d => d.count), 1);
    return days.map(d => ({ ...d, max: maxCount }));
  }, [todos, isZh]);

  const recentCompleted = useMemo(() => {
    return todos.filter(t => t.completed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  }, [todos]);

  const suggestion = useMemo(() => {
    const todayComp = todayStats;
    const sleepRecords = healthRecords.filter(r => r.type === 'sleep' && r.sleepDurationMinutes != null);
    const last3Sleep = sleepRecords.sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    const avgSleep = last3Sleep.length > 0
      ? last3Sleep.reduce((sum, r) => sum + (r.sleepDurationMinutes ?? 0), 0) / last3Sleep.length / 60
      : 0;
    const overdueCount = todos.filter(t => isOverdue(t)).length;

    if (avgSleep < 6 && avgSleep > 0 && todayComp.uncompleted > 0) {
      return isZh
        ? '最近睡眠不足（<6h），建議先補眠再處理任務'
        : 'Sleep deprived (<6h). Rest first, then tackle tasks.';
    }
    if (overdueCount > 2) {
      return isZh
        ? `有 ${overdueCount} 項逾期任務，建議先清除以減輕負擔`
        : `${overdueCount} overdue tasks — clear them to lighten the load.`;
    }
    if (todayComp.completed >= 5) {
      return isZh
        ? '今日效率極佳！適合推進長期或高優先級任務'
        : 'Great momentum! Push long-term or high-priority tasks.';
    }
    if (todayComp.completed >= 2 && todayComp.rate >= 60) {
      return isZh
        ? '狀態穩定，繼續保持節奏'
        : 'Steady rhythm — keep going.';
    }
    if (todayComp.uncompleted > 3 && todayComp.completed === 0) {
      return isZh
        ? '先從最簡單的小任務開始，建立動能'
        : 'Start with the easiest task to build momentum.';
    }
    return isZh
      ? '今天狀態平穩，適合推進各項任務'
      : 'Smooth sailing — work through your tasks steadily.';
  }, [todayStats, healthRecords, todos, isZh]);

  return (
    <section className="tp-view view">
      <header className="tp-header">
        <BackButton to="/" />
        <h1 className="tp-title">{t('nav.todos')}</h1>
        <button
          type="button"
          className="tp-cal-btn"
          onClick={() => navigate('/calendar')}
          title="前往日曆新增"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="14" x2="12" y2="20" /><line x1="9" y1="17" x2="15" y2="17" />
          </svg>
        </button>
      </header>

      {/* Quick input (P13) */}
      <div className="tp-quick">
        <input
          ref={quickRef}
          className="tp-quick-input"
          type="text"
          value={quickInput}
          onChange={e => setQuickInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
          placeholder="快速新增⋯ 支援「明天」、「緊急」、「下午3點」"
          aria-label="快速新增待辦"
        />
        <button
          type="button"
          className="tp-quick-btn"
          onClick={handleQuickAdd}
          disabled={!quickInput.trim()}
          aria-label="新增"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Stats Summary (Todo 2.0 — always visible) */}
      <div className="tp21-stats">
        <div className="tp21-stats-primary">
          <div className="tp21-stats-item">
            <span className="tp21-stats-num tp21-stats-done">{todayStats.completed}</span>
            <span className="tp21-stats-label">{isZh ? '已完成' : 'Done'}</span>
          </div>
          <div className="tp21-stats-divider" />
          <div className="tp21-stats-item">
            <span className="tp21-stats-num">{todayStats.uncompleted}</span>
            <span className="tp21-stats-label">{isZh ? '待處理' : 'Todo'}</span>
          </div>
          <div className="tp21-stats-divider" />
          <div className="tp21-stats-item">
            <span className="tp21-stats-num">{todayStats.rate}%</span>
            <span className="tp21-stats-label">{isZh ? '完成率' : 'Rate'}</span>
          </div>
        </div>
        <div className="tp21-heatmap">
          {weeklyCompleted.map((d, i) => (
            <div key={i} className="tp21-heatmap-bar" title={`${d.label} ${d.count}`}>
              <div className="tp21-heatmap-fill" style={{ height: `${(d.count / d.max) * 100}%` }} />
              <span className="tp21-heatmap-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <nav className="tp-filter-bar">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`tp-filter-btn${activeFilter === f.id ? ' active' : ''}`}
            onClick={() => { setActiveFilter(f.id); setCatFilter(null); }}
          >
            <span>{f.label}</span>
            <span className="tp-filter-count">{counts[f.id]}</span>
          </button>
        ))}
      </nav>

      {/* Category sub-filter (P3 - plain text) */}
      <div className="tp-cat-row">
        <button
          type="button"
          className={`tp-cat-chip${catFilter === null ? ' active' : ''}`}
          onClick={() => setCatFilter(null)}
        >
          全部
        </button>
        {CAT_ORDER.map(catId => {
          const c = CAT_COLORS[catId];
          const count = catCounts.get(catId) || 0;
          if (count === 0 && catFilter !== catId) return null;
          return (
            <button
              key={catId}
              type="button"
              className={`tp-cat-chip${catFilter === catId ? ' active' : ''}`}
              onClick={() => setCatFilter(prev => prev === catId ? null : catId)}
              style={{ '--chip-color': c.color } as React.CSSProperties}
            >
              {c.label} <span className="tp-cat-chip-n">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Today focus bar (P12) */}
      {todayFocus.total > 0 && (
        <div className="tp-focus">
          <div className="tp-focus-head">
            <span className="tp-focus-label">今日專注</span>
            <span className="tp-focus-stat">{todayFocus.completed}/{todayFocus.total} 項已完成 ({Math.round(todayFocus.rate * 100)}%)</span>
          </div>
          <div className="tp-focus-track">
            <div className="tp-focus-fill" style={{ width: `${todayFocus.rate * 100}%` }} />
          </div>
        </div>
      )}

      {/* Lunaris tip (P14) */}
      {lunarisTip && (
        <div className="tp-lunaris-tip">
          <span className="tp-lunaris-tip-icon">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          </span>
          <span className="tp-lunaris-tip-text">{lunarisTip}</span>
          <button type="button" className="tp-lunaris-tip-close" onClick={() => setLunarisDismissed(true)} aria-label="關閉提示">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Today's Suggestion (Todo 2.0) */}
      <div className="tp21-suggestion">
        <span className="tp21-suggestion-icon">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </span>
        <span className="tp21-suggestion-text">{suggestion}</span>
      </div>

      {/* Completion stats (P15) */}
      {activeFilter === 'completed' && completedStats.total > 0 && (
        <div className="tp-stats">
          <div className="tp-stats-head">
            <span className="tp-stats-label">完成歷史</span>
            <span className="tp-stats-total">共 {completedStats.total} 項 · 近 7 日趨勢</span>
          </div>
          <div className="tp-stats-chart">
            {completedStats.days.map((day, i) => (
              <div key={i} className="tp-stats-bar-group">
                <span className="tp-stats-bar-val" style={{ opacity: day.count > 0 ? 1 : 0.3 }}>{day.count}</span>
                <div className="tp-stats-bar-track">
                  <div className="tp-stats-bar-fill" style={{ height: `${(day.count / completedStats.maxCount) * 100}%` }} />
                </div>
                <span className="tp-stats-bar-label">{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeFilter === 'completed' && displayTodos.length > 0 && (
        <button
          type="button"
          className={`tp-museum-toggle${museumView ? ' active' : ''}`}
          onClick={() => setMuseumView(v => !v)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {museumView ? '列表模式' : '展覽館模式'}
        </button>
      )}

      {/* Ticket Printer Animation */}
      <AnimatePresence>
        {isPrinting && printingRef.current && (
          <TicketPrinter
            todo={printingRef.current}
            onPrinted={handlePrinted}
          />
        )}
      </AnimatePresence>

      {/* Content area */}
      {displayTodos.length === 0 ? (
        <div className="tp21-empty">
          <div className="tp21-empty-icon">
            {activeFilter === 'completed'
              ? <IconCheckCircle size={36} />
              : activeFilter === 'overdue'
                ? <IconArchive size={36} />
                : <IconClipboard size={36} />}
          </div>
          <p className="tp21-empty-text">
            {activeFilter === 'completed'
              ? '尚無已完成票根'
              : '這個票券匣目前是空的'}
          </p>
          {(activeFilter === 'today' || activeFilter === 'week') && (
            <button type="button" className="tp21-empty-cta" onClick={() => navigate('/calendar')}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              前往日曆新增
            </button>
          )}
          <div className="tp21-empty-history">
            <span className="tp21-empty-history-stat">{isZh ? '歷史累計完成' : 'All-time completed'}: <strong>{completedStats.total}</strong></span>
            <span className="tp21-empty-history-dot" />
            <span className="tp21-empty-history-stat">{isZh ? '本週完成' : 'This week'}: <strong>{weeklyCompleted.reduce((a, d) => a + d.count, 0)}</strong></span>
          </div>
        </div>
      ) : activeFilter === 'today' ? (
        <div className="tp-timeline">
          {(Object.keys(PERIODS) as TimePeriod[]).map(period => {
            const items = displayTodos.filter(t => getTimePeriod(t.createdAt) === period);
            if (items.length === 0) return null;
            const p = PERIODS[period];
            return (
              <div key={period} className="tp-period">
                <header className="tp-period-head">
                  <span className="tp-period-icon">{p.icon}</span>
                  <span className="tp-period-label">{p.label}</span>
                  <span className="tp-period-count">{items.length}</span>
                </header>
                <div className="tp-period-tickets">
                  {items.map(todo => (
                    <TodoTicket
                      key={todo.id}
                      todo={todo}
                      onDelete={(id) => setDeleteConfirm(id)}
                      onComplete={handleCelebrate}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeFilter === 'completed' && museumView ? (
        <div className="tp-museum">
          {displayTodos.map(todo => {
            const cat = CAT_COLORS[getTicketCategory(todo.category)];
            return (
              <article
                key={todo.id}
                className="tp-museum-piece"
                style={{ '--piece-color': cat.color, '--piece-ink': cat.ink } as React.CSSProperties}
              >
                <span className="tp-museum-piece-frame" />
                <div className="tp-museum-piece-body">
                  <div className="tp-museum-piece-head">
                    <span className="tp-museum-piece-cat">{cat.label}</span>
                    <span className="tp-museum-piece-code">{taskCode(todo.ticketNumber)}</span>
                  </div>
                  <h3 className="tp-museum-piece-title">{todo.title}</h3>
                  <div className="tp-museum-piece-meta">
                    <span>{formatCreatedAt(todo.createdAt)}</span>
                    <span>·</span>
                    <span className={`tp-museum-piece-priority tp-museum-piece-${todo.priority}`}>
                      {todo.priority === 'high' ? '優先' : todo.priority === 'low' ? '稍後' : '一般'}
                    </span>
                  </div>
                  <div className="tp-museum-piece-stamp">
                    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25">
                      <circle cx="20" cy="20" r="18" strokeDasharray="4 3" />
                      <path d="M14 20l4 4 8-8" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={`tp-ticket-board tp-ticket-count-${Math.min(displayTodos.length, 4)}`}>
          {displayTodos.map(todo => (
            <TodoTicket
              key={todo.id}
              todo={todo}
              onDelete={(id) => setDeleteConfirm(id)}
              onComplete={handleCelebrate}
            />
          ))}
        </div>
      )}

      {/* Recent Completed (Todo 2.0) */}
      {activeFilter !== 'completed' && recentCompleted.length > 0 && (
        <div className="tp21-recent">
          <div className="tp21-recent-head">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
            </svg>
            <span>{isZh ? '近期完成' : 'Recent Completed'}</span>
          </div>
          <div className="tp21-recent-list">
            {recentCompleted.map(todo => (
              <div key={todo.id} className={`tp21-recent-item tp21-recent-${todo.priority}`}>
                <span className="tp21-recent-check">
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="tp21-recent-title">{todo.title}</span>
                <span className="tp21-recent-time">{formatCreatedAt(todo.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <>
          <div className="tp-modal-backdrop" onClick={() => setDeleteConfirm(null)} />
          <div className="tp-modal">
            <p className="tp-modal-title">確定要刪除這條待辦嗎？</p>
            <p className="tp-modal-hint">刪除後無法復原</p>
            <div className="tp-modal-actions">
              <button type="button" className="tp-modal-btn-ghost" onClick={() => setDeleteConfirm(null)}>取消</button>
              <button type="button" className="tp-modal-btn-danger" onClick={() => { deleteTodo(deleteConfirm); setDeleteConfirm(null); }}>
                確認刪除
              </button>
            </div>
          </div>
        </>
      )}

      {/* Celebration toast */}
      {celebrationKey > 0 && (
        <div className="tp-toast" key={celebrationKey}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
          票根已回收
        </div>
      )}
    </section>
  );
}
