import { useState, useRef, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { t } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { RuntimeLogTimeline } from '@/components/agent/RuntimeLogTimeline';
import type { AgentRuntimeLog, AgentRuntimeStep, AgentToolCall } from '@/types';

// ── Types & LS helpers ──

interface Book {
  id: string;
  title: string;
  content: string;
  fileName: string;
  fileType: 'txt' | 'md';
  progress: number;
  scrollPos: number;
  createdAt: number;
}

// Per-book Luna Q&A history
interface LunaQA {
  bookId: string;
  question: string;
  answer: string;
  action: 'ask' | 'summarize' | 'analyze' | 'foreshadow';
  selectedText: string;
  createdAt: number;
}

const LS_BOOKS = 'lunartide_moonread_v1';
const LS_LUNA = 'lunartide_moonread_luna_v1';

function loadBooks(): Book[] {
  try { const r = localStorage.getItem(LS_BOOKS); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return p; } } catch {}
  return [];
}
function saveBooks(books: Book[]) { try { localStorage.setItem(LS_BOOKS, JSON.stringify(books)); } catch {} }

function loadLunaQA(): LunaQA[] {
  try { const r = localStorage.getItem(LS_LUNA); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return p; } } catch {}
  return [];
}
function saveLunaQA(qas: LunaQA[]) { try { localStorage.setItem(LS_LUNA, JSON.stringify(qas)); } catch {} }

let _id = 0;
function genId() { _id++; return `mr_${Date.now()}_${_id}`; }

// ── Mock Luna reply generator ──

function countSentences(text: string): number {
  return text.split(/[。！？.!?\n]+/).filter(Boolean).length;
}

const MOCK_LUNA_OPENINGS = [
  '我讀了這一段，月潮裡浮現了一些輪廓。',
  '這一段文字在月光下看起來是這樣的——',
  '我把這段放進月潮裡聽了一下。',
  '潮聲退去後，這段文字留下了一些回聲。',
  '我沿著這段文字的邊緣慢慢走了一圈。',
];
const MOCK_LUNA_CLOSINGS = [
  '這些都只是我的感覺。你讀到的可能完全不一樣。',
  '月潮來去，文字也會在不同的時間說不同的話。',
  '如果願意的話，我們可以再讀一遍。',
  '這些回聲會在月潮裡慢慢沉澱。',
];

function mockSummarize(text: string): string {
  const sents = text.split(/[。！？\n]+/).filter((s) => s.trim().length > 0);
  if (sents.length === 0) return '這段文字很短，它本身就是它想說的全部。';
  const first = sents[0].trim().slice(0, 60);
  const last = sents.length > 1 ? sents[sents.length - 1].trim().slice(0, 40) : '';
  const opening = MOCK_LUNA_OPENINGS[Math.floor(Math.random() * MOCK_LUNA_OPENINGS.length)];
  const closing = MOCK_LUNA_CLOSINGS[Math.floor(Math.random() * MOCK_LUNA_CLOSINGS.length)];
  return `${opening}

這段文字從「${first}…」開始，一共約 ${countSentences(text)} 句話。它在說一個關於某種狀態或關係的片段。語氣裡帶著一點沉靜，像是在月光下重新整理過的東西。

${last ? `最後停留在「…${last}」。這裡的收尾讓整段文字多了一層餘韻。` : ''}

${closing}`;
}

function mockAnalyze(text: string): string {
  const sents = text.split(/[。！？\n]+/).filter((s) => s.trim().length > 0);
  const sample = sents.slice(0, 3).map((s) => s.trim().slice(0, 30)).join('」、「');
  const opening = MOCK_LUNA_OPENINGS[Math.floor(Math.random() * MOCK_LUNA_OPENINGS.length)];
  const closing = MOCK_LUNA_CLOSINGS[Math.floor(Math.random() * MOCK_LUNA_CLOSINGS.length)];
  return `${opening}

在這段文字中出現的角色，從「${sample || '…'}」等描述來看，似乎正在經歷某種內在的轉折。他的行動或話語裡帶著一絲猶豫，也可能是察覺——察覺到某件事的輪廓正在改變。

角色的狀態像月潮一樣，在漲與退之間移動。這種移動不一定是劇烈的，但它在文字中留下了痕跡。如果把他放在月潮的時間尺度上來看，這可能是一個「準備期」——他在為某個還未完全顯形的決定做準備。

${closing}`;
}

function mockForeshadow(text: string): string {
  const sents = text.split(/[。！？\n]+/).filter((s) => s.trim().length > 0);
  const sample = sents.slice(0, 2).map((s) => s.trim().slice(0, 40)).join('」、「');
  const opening = MOCK_LUNA_OPENINGS[Math.floor(Math.random() * MOCK_LUNA_OPENINGS.length)];
  const closing = MOCK_LUNA_CLOSINGS[Math.floor(Math.random() * MOCK_LUNA_CLOSINGS.length)];
  return `${opening}

這段文字裡有幾個值得注意的線索：「${sample || '…'}」。如果把它們按照月潮的時間線重新排列，會發現它們之間存在一種尚未被完全連接的張力。

首先是語氣的變化——從平靜到略帶不安，再到某種安靜的確認。這種三拍子的節奏在故事中通常是「準備－觸發－回應」的結構。目前這段文字可能只出現了第一拍，後面的兩拍會在後續的章節中慢慢浮現。

其次是重複的元素。如果某個詞或畫面反覆出現，它很可能不是偶然的。月潮會把碎片的回聲聚攏在一起。

${closing}`;
}

function mockAsk(text: string): string {
  const opening = MOCK_LUNA_OPENINGS[Math.floor(Math.random() * MOCK_LUNA_OPENINGS.length)];
  const closing = MOCK_LUNA_CLOSINGS[Math.floor(Math.random() * MOCK_LUNA_CLOSINGS.length)];
  return `${opening}

你選的這段文字在我看來，最核心的是它傳達出來的那種「中間狀態」——既不是完全的開始，也不是明確的結束。文字本身像月潮中的一片浮木，你可以從不同的角度去看它。

如果你要我說得更具體，這段文字裡的情緒密度偏高。每一句話都不是純粹的敘述，而是帶著某種微妙的判斷或感受。這讓整段文字讀起來像某人在月光下自言自語——不是對別人解釋，而是對自己確認。

${closing}`;
}

type LunaAction = 'ask' | 'summarize' | 'analyze' | 'foreshadow';

function generateMockReply(action: LunaAction, selectedText: string): string {
  switch (action) {
    case 'summarize': return mockSummarize(selectedText);
    case 'analyze': return mockAnalyze(selectedText);
    case 'foreshadow': return mockForeshadow(selectedText);
    default: return mockAsk(selectedText);
  }
}

// ── Page ──

export function MoonReadPage() {
  const [books, setBooks] = useState<Book[]>(() => loadBooks());
  const [reading, setReading] = useState<Book | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Selection + Luna drawer state ──
  const [selText, setSelText] = useState('');
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);
  const [lunaOpen, setLunaOpen] = useState(false);
  const [lunaThinking, setLunaThinking] = useState(false);
  const [lunaReply, setLunaReply] = useState('');
  const [lunaAction, setLunaAction] = useState<LunaAction>('ask');
  const [lunaHistory, setLunaHistory] = useState<LunaQA[]>(() => loadLunaQA());
  const [showProcess, setShowProcess] = useState(false);
  const [lastLog, setLastLog] = useState<AgentRuntimeLog | null>(null);

  const addRuntimeLog = useAppStore((s) => s.addRuntimeLog);

  // ── Dismiss selection when clicking elsewhere ──
  useEffect(() => {
    if (!selText) return;
    const dismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.moonread-toolbar') || target.closest('.moonread-luna-drawer')) return;
      setSelText('');
      setSelPos(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [selText]);

  // ── Import ──
  const handleImport = useCallback(() => fileRef.current?.click(), []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result !== 'string') return;
      const ext = f.name.split('.').pop()?.toLowerCase();
      const book: Book = {
        id: genId(),
        title: f.name.replace(/\.(txt|md)$/i, ''),
        content: r.result,
        fileName: f.name,
        fileType: ext === 'md' ? 'md' : 'txt',
        progress: 0,
        scrollPos: 0,
        createdAt: Date.now(),
      };
      const next = [...loadBooks(), book];
      saveBooks(next);
      setBooks(next);
      if (fileRef.current) fileRef.current.value = '';
    };
    r.readAsText(f, 'UTF-8');
  }, []);

  // ── Open / Close reader ──
  const openBook = useCallback((book: Book) => setReading(book), []);
  const closeReader = useCallback(() => {
    setReading(null);
    setBooks(loadBooks());
    setSelText('');
    setSelPos(null);
    setLunaOpen(false);
  }, []);

  // ── Delete ──
  const delBook = useCallback((id: string) => {
    const next = loadBooks().filter((b) => b.id !== id);
    saveBooks(next);
    setBooks(next);
    if (reading?.id === id) setReading(null);
  }, [reading]);

  // ── Scroll progress ──
  useEffect(() => {
    if (!reading || !scrollRef.current) return;
    const el = scrollRef.current;
    if (reading.scrollPos > 0) el.scrollTop = reading.scrollPos;
    const onScroll = () => {
      const pct = el.scrollHeight <= el.clientHeight
        ? 100
        : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      const books = loadBooks();
      const b = books.find((x) => x.id === reading.id);
      if (b) { b.progress = Math.min(100, Math.max(0, pct)); b.scrollPos = Math.round(el.scrollTop); }
      saveBooks(books);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [reading]);

  // ── Text selection handler ──
  const handleTextSelect = useCallback(() => {
    // Small delay to let the browser settle the selection
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        // Don't clear if we're interacting with the toolbar
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // Position toolbar above the selection, centered
      setSelPos({
        x: Math.min(rect.left + rect.width / 2, window.innerWidth - 160),
        y: rect.top - 12,
      });
      setSelText(text);
    }, 50);
  }, []);

  // ── Luna actions ──
  const triggerLuna = useCallback((action: LunaAction) => {
    if (!reading || !selText) return;
    setSelPos(null);
    setLunaAction(action);
    setLunaOpen(true);
    setLunaThinking(true);
    setLunaReply('');
    setShowProcess(false);
    setLastLog(null);

    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const actionLabel = action === 'summarize' ? '總結這段' : action === 'analyze' ? '分析角色' : action === 'foreshadow' ? '整理伏筆' : '問 Luna';

    // Build initial runtime log (status: thinking)
    const thinkingSteps: AgentRuntimeStep[] = [
      { id: 's1', label: '讀取月讀室選文', status: 'done', startedAt, finishedAt: startedAt + 50, detail: selText.slice(0, 80) + (selText.length > 80 ? '…' : '') },
      { id: 's2', label: '檢索月潮記憶', status: 'active', startedAt: startedAt + 50 },
      { id: 's3', label: '生成回答', status: 'pending' },
    ];

    const thinkingLog: AgentRuntimeLog = {
      id: requestId,
      requestId,
      messageId: crypto.randomUUID(),
      presetId: 'moonread',
      providerId: 'local-mock',
      model: 'luna-mock-reply',
      startedAt,
      status: 'thinking',
      visibleReasoningSummary: `Luna 正在對「${actionLabel}」的請求整理回覆。選文來自《${reading.title}》，共約 ${selText.length} 字。`,
      steps: thinkingSteps,
      toolCalls: [],
      tokenUsage: { input: 0, output: 0, total: 0, estimated: true },
      costEstimate: 0,
      source: 'moonread',
    };
    setLastLog(thinkingLog);
    addRuntimeLog(thinkingLog);

    // Simulate Luna thinking (0.8–1.5s delay)
    const delay = 800 + Math.random() * 700;
    const timer = setTimeout(() => {
      const reply = generateMockReply(action, selText);
      setLunaReply(reply);
      setLunaThinking(false);

      const finishedAt = Date.now();
      const inputTokens = Math.ceil(selText.length / 3);
      const outputTokens = Math.ceil(reply.length / 3);

      // Build completed runtime log
      const toolCalls: AgentToolCall[] = [
        {
          id: crypto.randomUUID(),
          toolId: 'tool-moonread',
          toolName: '月讀室',
          input: `讀取《${reading.title}》選文段落`,
          output: `已讀取 ${selText.length} 字`,
          status: 'success',
          startedAt: startedAt + 100,
          finishedAt: startedAt + 200,
        },
        {
          id: crypto.randomUUID(),
          toolId: 'tool-memory',
          toolName: '記憶搜尋',
          input: '搜尋相關記憶',
          output: '未找到高度相關記憶（mock）',
          status: 'success',
          startedAt: startedAt + 200,
          finishedAt: startedAt + 350,
        },
      ];

      const completedSteps: AgentRuntimeStep[] = [
        { id: 's1', label: '讀取月讀室選文', status: 'done', startedAt, finishedAt: startedAt + 200, detail: selText.slice(0, 80) + (selText.length > 80 ? '…' : '') },
        { id: 's2', label: '檢索月潮記憶', status: 'done', startedAt: startedAt + 50, finishedAt: startedAt + 350, detail: '搜尋近期記憶與相關場景' },
        { id: 's3', label: '已調用工具', status: 'done', startedAt: startedAt + 100, finishedAt: startedAt + 350, detail: '月讀室 · 記憶搜尋' },
        { id: 's4', label: '生成回答', status: 'done', startedAt: startedAt + 350, finishedAt, detail: `已生成 ${reply.length} 字回覆` },
      ];

      const completedLog: AgentRuntimeLog = {
        ...thinkingLog,
        finishedAt,
        status: 'completed',
        visibleReasoningSummary: `Luna 已完成「${actionLabel}」。從《${reading.title}》讀取選文（${selText.length} 字），生成 ${reply.length} 字回覆。`,
        steps: completedSteps,
        toolCalls,
        tokenUsage: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens, estimated: true },
        costEstimate: inputTokens * 0.000001 + outputTokens * 0.000003,
      };
      setLastLog(completedLog);
      addRuntimeLog(completedLog);

      // Save to history
      const qa: LunaQA = {
        bookId: reading.id,
        question: action === 'ask' ? '對選取段落的提問' : { summarize: '總結這段', analyze: '分析角色', foreshadow: '整理伏筆' }[action],
        answer: reply,
        action,
        selectedText: selText.slice(0, 200),
        createdAt: Date.now(),
      };
      const next = [...loadLunaQA(), qa];
      saveLunaQA(next);
      setLunaHistory(next);
    }, delay);

    return () => clearTimeout(timer);
  }, [reading, selText, addRuntimeLog]);

  const closeLuna = useCallback(() => {
    setLunaOpen(false);
    setLunaReply('');
    setLunaThinking(false);
    setSelText('');
    setSelPos(null);
  }, []);

  // ═══════════ READER VIEW ═══════════
  if (reading) {
    const actionLabels: { key: LunaAction; label: string }[] = [
      { key: 'summarize', label: '總結這段' },
      { key: 'analyze', label: '分析角色' },
      { key: 'foreshadow', label: '整理伏筆' },
    ];

    return (
      <section className="view" style={{ position: 'relative' }}>
        {/* Reader header */}
        <header style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={closeReader} aria-label="返回書庫"
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 13 }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><polyline points="15 18 9 12 15 6" /></svg>
            書庫
          </button>
          <h1 style={{ flex: 1, fontSize: 16, fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reading.title}</h1>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{reading.progress}%</span>
        </header>

        {/* Reading pane */}
        <div
          ref={scrollRef}
          onMouseUp={handleTextSelect}
          onTouchEnd={handleTextSelect}
          style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px 80px',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 14, lineHeight: 1.8,
            color: 'var(--text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            WebkitOverflowScrolling: 'touch', userSelect: 'text',
          }}
        >
          {reading.content}
        </div>

        {/* ── Floating selection toolbar ── */}
        {selText && selPos && (
          <div
            className="moonread-toolbar"
            style={{
              position: 'fixed',
              left: `${Math.max(8, selPos.x - 140)}px`,
              top: `${Math.max(8, selPos.y - 48)}px`,
              zIndex: 100,
              display: 'flex',
              gap: 4,
              background: 'var(--surface-1)',
              borderRadius: 12,
              padding: '6px 8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              border: '1px solid var(--surface-2)',
              flexWrap: 'wrap',
              maxWidth: 'calc(100vw - 16px)',
            }}
          >
            <button
              type="button"
              className="liquid-btn liquid-btn--sm liquid-btn--accent"
              onClick={() => triggerLuna('ask')}
              style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: '#fff', fill: 'none', strokeWidth: 2, marginRight: 4 }}>
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              問 Luna
            </button>
            {actionLabels.map((a) => (
              <button
                key={a.key}
                type="button"
                className="liquid-btn liquid-btn--sm"
                onClick={() => triggerLuna(a.key)}
                style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Luna answer drawer ── */}
        {lunaOpen && (
          <div
            className="moonread-luna-drawer"
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 430,
              maxHeight: '55vh',
              zIndex: 90,
              background: 'var(--surface-1)',
              borderTop: '1px solid var(--surface-2)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'moonread-slideUp 0.25s ease-out',
            }}
          >
            {/* Drawer handle + close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a28fb8, #7b8fc2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff',
                }}>L</div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {lunaAction === 'summarize' ? '總結這段' : lunaAction === 'analyze' ? '分析角色' : lunaAction === 'foreshadow' ? '整理伏筆' : '問 Luna'}
                </span>
                {lunaThinking && <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>思考中…</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!lunaThinking && lastLog && (
                  <button
                    type="button"
                    onClick={() => setShowProcess((v) => !v)}
                    style={{
                      background: showProcess ? 'var(--accent)' : 'var(--surface-2)',
                      border: 'none', borderRadius: 14, cursor: 'pointer', padding: '4px 10px',
                      fontSize: 11, fontWeight: 500,
                      color: showProcess ? '#fff' : 'var(--text-2)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    {showProcess ? '回覆' : '過程'}
                  </button>
                )}
                <button type="button" onClick={closeLuna}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            {/* Quote of selected text */}
            {!showProcess && (
              <div style={{
                margin: '4px 16px 8px', padding: '8px 12px',
                background: 'var(--surface-2)', borderRadius: 10,
                fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic',
                maxHeight: 60, overflow: 'hidden', lineHeight: 1.5,
                borderLeft: '3px solid var(--accent)',
              }}>
                {selText.slice(0, 150)}{selText.length > 150 ? '…' : ''}
              </div>
            )}

            {/* Reply body or Process view */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '8px 16px 24px',
              fontSize: 14, lineHeight: 1.75, color: 'var(--text-1)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {showProcess && lastLog ? (
                <RuntimeLogTimeline log={lastLog} />
              ) : lunaThinking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
                  <span className="moonread-thinking-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'moonread-blink 0.8s infinite' }} />
                  <span className="moonread-thinking-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'moonread-blink 0.8s infinite 0.2s' }} />
                  <span className="moonread-thinking-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'moonread-blink 0.8s infinite 0.4s' }} />
                  <span style={{ fontSize: 13, marginLeft: 4 }}>Luna 正在整理月潮回聲…</span>
                </div>
              ) : (
                lunaReply
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  // ═══════════ LIBRARY VIEW ═══════════
  return (
    <section className="view">
      <Header eyebrow={t('home.moonReadHint')} title={t('home.moonRead')} />

      {/* Toolbar */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="liquid-btn liquid-btn--sm liquid-btn--accent" onClick={handleImport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: '#fff', fill: 'none', strokeWidth: 2 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          匯入 TXT / MD
        </button>
        {books.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{books.length} 本書</span>
        )}
        <input ref={fileRef} type="file" accept=".txt,.md,text/plain" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {books.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)' }}>
            <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 1.5, margin: '0 auto 12px', opacity: 0.4 }}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <p style={{ fontSize: 14, marginBottom: 4 }}>還沒有任何書籍</p>
            <p style={{ fontSize: 12, opacity: 0.6 }}>點擊「匯入 TXT / MD」加入檔案</p>
          </div>
        </Card>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {books.map((book) => (
            <div key={book.id} style={{
              display: 'flex', alignItems: 'center', background: 'var(--surface-1)',
              borderRadius: 14, padding: '12px 16px', gap: 12, cursor: 'pointer',
            }} onClick={() => openBook(book)}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--accent)', fill: 'none', strokeWidth: 2 }}>
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{book.fileType.toUpperCase()} · {book.content.length.toLocaleString()} 字</div>
                <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${book.progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{book.progress}%</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); delBook(book.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}
                aria-label="刪除">
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
