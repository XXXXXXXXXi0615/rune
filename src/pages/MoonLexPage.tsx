import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  selectDueCount,
  selectFavorites,
  selectFilteredDeck,
  selectMasteryCounts,
  selectTodayVocabulary,
  useMoonLexStore,
} from '@/store/useMoonLexStore';
import type {
  MoonLexLanguageFilter,
  MoonLexLibraryFilter,
  VocabularyEntry,
  VocabularyLanguage,
  VocabularyMastery,
  VocabularyPracticeResult,
} from '@/features/moonlex/types';
import '@/styles/moonlex.css';

const MASTERY_LABEL: Record<VocabularyMastery, string> = {
  new: '新收錄', learning: '學習中', familiar: '熟悉', mastered: '已掌握',
};
const FILTERS: Array<{ id: MoonLexLibraryFilter; label: string }> = [
  { id: 'today', label: '今天' }, { id: 'all', label: '全部' }, { id: 'favorites', label: '收藏' }, { id: 'learning', label: '學習中' },
];

function ReadingLine({ entry }: { entry: VocabularyEntry }) {
  return entry.language === 'ja' && entry.reading ? <ruby>{entry.term}<rt>{entry.reading}</rt></ruby> : <>{entry.term}</>;
}

/** Fit long terms to the available reading width without changing vocabulary data. */
function StudyWord({ entry }: { entry: VocabularyEntry }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      element.style.fontSize = '';
      element.style.whiteSpace = 'nowrap';
      const nominal = parseFloat(getComputedStyle(element).fontSize);
      const available = element.clientWidth;
      const needed = element.scrollWidth;
      if (needed > available && available > 0) {
        element.style.fontSize = `${Math.max(32, Math.floor(nominal * available / needed))}px`;
      }
      element.style.whiteSpace = '';
    };
    let frame = 0;
    let lastWidth = -1;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(([size]) => {
      if (size.contentRect.width === lastWidth) return;
      lastWidth = size.contentRect.width;
      scheduleFit();
    });
    observer.observe(element.parentElement!);
    window.addEventListener('resize', scheduleFit);
    document.fonts.addEventListener('loadingdone', scheduleFit);
    fit();
    void document.fonts.ready.then(() => { if (!disposed) scheduleFit(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleFit);
      document.fonts.removeEventListener('loadingdone', scheduleFit);
    };
  }, [entry.term, entry.reading]);
  return <strong ref={ref}><ReadingLine entry={entry} /></strong>;
}

export function MoonLexPage() {
  const navigate = useNavigate();
  const entries = useMoonLexStore((state) => state.entries);
  const practiceRecords = useMoonLexStore((state) => state.practiceRecords);
  const selectedEntryId = useMoonLexStore((state) => state.selectedEntryId);
  const languageFilter = useMoonLexStore((state) => state.languageFilter);
  const practiceDifficulty = useMoonLexStore((state) => state.practiceDifficulty);
  const addEntry = useMoonLexStore((state) => state.addEntry);
  const toggleFavorite = useMoonLexStore((state) => state.toggleFavorite);
  const setSelectedEntry = useMoonLexStore((state) => state.setSelectedEntry);
  const setLanguageFilter = useMoonLexStore((state) => state.setLanguageFilter);
  const setPracticeDifficulty = useMoonLexStore((state) => state.setPracticeDifficulty);
  const recordPractice = useMoonLexStore((state) => state.recordPractice);
  const [libraryFilter, setLibraryFilter] = useState<MoonLexLibraryFilter>('today');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ language: 'en' as VocabularyLanguage, term: '', reading: '', meaning: '', difficulty: 2 as 1 | 2 | 3 | 4 | 5 });

  const commandBarRef = useRef<HTMLDivElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const toolbar = commandBarRef.current;
    const scrollport = toolbar?.closest<HTMLElement>('.app-main');
    if (!toolbar || !scrollport) return;
    const previous = scrollport.style.getPropertyValue('--moonlex-toolbar-height');
    const measure = () => scrollport.style.setProperty('--moonlex-toolbar-height', `${toolbar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    measure();
    return () => {
      observer.disconnect();
      if (previous) scrollport.style.setProperty('--moonlex-toolbar-height', previous);
      else scrollport.style.removeProperty('--moonlex-toolbar-height');
    };
  }, []);

  const dataSlice = useMemo(() => ({ entries, practiceRecords, languageFilter, practiceDifficulty }), [entries, practiceRecords, languageFilter, practiceDifficulty]);
  const languageDeck = useMemo(() => selectFilteredDeck(dataSlice), [dataSlice]);
  const todayIds = useMemo(() => new Set(selectTodayVocabulary({ entries: languageDeck, practiceRecords }).map((entry) => entry.id)), [languageDeck, practiceRecords]);
  const favoriteIds = useMemo(() => new Set(selectFavorites({ entries: languageDeck }).map((entry) => entry.id)), [languageDeck]);
  const deck = useMemo(() => languageDeck
    .filter((entry) => libraryFilter === 'all'
      || (libraryFilter === 'today' && todayIds.has(entry.id))
      || (libraryFilter === 'favorites' && favoriteIds.has(entry.id))
      || (libraryFilter === 'learning' && (entry.mastery === 'new' || entry.mastery === 'learning')))
    .filter((entry) => {
      const normalized = query.trim().toLowerCase();
      return !normalized || entry.term.toLowerCase().includes(normalized) || entry.reading?.includes(normalized) || entry.meanings.some((meaning) => meaning.toLowerCase().includes(normalized));
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.updatedAt - b.updatedAt), [favoriteIds, languageDeck, libraryFilter, query, todayIds]);
  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const selectedIndex = Math.max(0, deck.findIndex((entry) => entry.id === selected?.id));
  const masteryCounts = useMemo(() => selectMasteryCounts({ entries }), [entries]);
  const dueCount = useMemo(() => selectDueCount({ entries, practiceRecords }), [entries, practiceRecords]);
  const reviewedToday = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    return new Set(practiceRecords.filter((record) => record.reviewedAt >= start).map((record) => record.vocabularyId)).size;
  }, [practiceRecords]);

  function chooseEntry(entry: VocabularyEntry) {
    setSelectedEntry(entry.id);
  }

  /* ── Phase 2A: swipeable deck presentation (single canonical seam) ────── */
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; lastX: number; lastT: number; velocity: number; startedOnInteractive: boolean } | null>(null);
  const listenersRef = useRef<(() => void) | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const commitSwipe = useRef<(direction: -1 | 1) => void>(() => {});
  commitSwipe.current = (direction) => {
    const target = deck[selectedIndex + direction];
    if (target) chooseEntry(target);
  };

  const canDrag = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return !target.closest('button, select, a, input, textarea, [data-pet-safe-region]');
  };

  const detachDrag = () => {
    listenersRef.current?.();
    listenersRef.current = null;
  };
  const finishDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    detachDrag();
    setDragging(false);
    stageRef.current?.classList.remove('is-swipe-capturing');
    if (!drag || drag.startedOnInteractive) { setDragX(0); return; }
    const cardW = cardWidth();
    const delta = event.clientX - drag.startX;
    const threshold = Math.min(cardW * 0.22, 140);
    const fastEnough = Math.abs(drag.velocity) > 0.45;
    const direction: -1 | 1 = delta < 0 ? 1 : -1;
    if (Math.abs(delta) >= threshold || (fastEnough && Math.abs(delta) > 24)) {
      commitSwipe.current(direction);
    }
    setDragX(0);
  };
  const cancelDrag = () => {
    dragRef.current = null;
    detachDrag();
    setDragging(false);
    stageRef.current?.classList.remove('is-swipe-capturing');
    setDragX(0);
  };
  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const interactive = !canDrag(event.target);
    const stage = stageRef.current;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastT: performance.now(), velocity: 0, startedOnInteractive: interactive };
    if (interactive || !stage) return;
    setDragging(true);
    stage.classList.add('is-swipe-capturing');
    const move = (pointer: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointer.pointerId) return;
      const now = performance.now();
      const dt = Math.max(8, now - drag.lastT);
      const dx = pointer.clientX - drag.lastX;
      drag.velocity = dx / dt;
      drag.lastX = pointer.clientX;
      drag.lastT = now;
        const cardW = cardWidth();
        setDragX(Math.max(-cardW * 0.5, Math.min(cardW * 0.5, pointer.clientX - drag.startX)));
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', cancelDrag);
    listenersRef.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', cancelDrag);
    };
  };

  // Global deck keyboard navigation — never steals keys while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); commitSwipe.current(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); commitSwipe.current(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      detachDrag();
    };
  }, []);

  /* ── Phase 2B: fanned presentation. Pure derivation from the canonical
     entry + filtered deck + Phase 2A dragX. No second index, no second
     gesture runtime — the fan is a projection of the 2A state. ─────────── */
  const FAN_RADIUS = 2;
  const fanEntries = useMemo(() => {
    const window: Array<{ entry: VocabularyEntry; offset: number }> = [];
    for (let offset = -FAN_RADIUS; offset <= FAN_RADIUS; offset += 1) {
      const entry = deck[selectedIndex + offset];
      if (entry) window.push({ entry, offset });
    }
    return window;
  }, [deck, selectedIndex]);

  const cardWidth = () => {
    const stageW = stageRef.current?.getBoundingClientRect().width || (typeof window !== 'undefined' ? window.innerWidth : 1);
    return Math.min(620, Math.max(1, stageW - 40));
  };
  const clampPx = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  /** Continuous fan geometry: offset is a real number so the whole stack
      interpolates while dragging (offset 0 = centred active card).
      Width is the active-card wrapper, not the full stage, so side cards
      can peek into the stage gutters while the canonical card keeps its
      Phase 1 internal geometry. */
  const fanGeometry = (offset: number) => {
    const width = cardWidth();
    const magnitude = Math.abs(offset);
    const direction = Math.sign(offset);
    const near = Math.min(magnitude, 1);
    const far = Math.max(magnitude - 1, 0);
    const shiftX = width * (0.16 * near + 0.10 * far);
    const shiftY = (clampPx(width * 0.03, 12, 18) * near) + (clampPx(width * 0.026, 10, 14) * far);
    const rotate = direction * (6 * near + 3 * far);
    const scale = 1 - 0.06 * near - 0.04 * far;
    const opacity = Math.max(0.42, 1 - 0.30 * near - 0.18 * far);
    return { x: direction * shiftX, y: shiftY, rotate, scale, opacity };
  };
  const dragProgress = cardWidth() > 0 ? dragX / cardWidth() : 0;
  const fanTransform = (offset: number) => fanGeometry(offset + dragProgress);

  function rate(result: VocabularyPracticeResult) {
    if (!selected) return;
    recordPractice({ vocabularyId: selected.id, result, mode: 'flip' });
    const next = deck[(selectedIndex + 1) % deck.length];
    if (next) setSelectedEntry(next.id);
  }

  function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.term.trim() || !draft.meaning.trim()) return;
    const id = addEntry({
      language: draft.language,
      term: draft.term,
      reading: draft.language === 'ja' ? draft.reading : undefined,
      phonetic: draft.language === 'en' ? draft.reading : undefined,
      meanings: [draft.meaning], tags: [], difficulty: draft.difficulty,
      mastery: 'new', favorite: false, source: { type: 'manual' },
    });
    setLanguageFilter(draft.language);
    setLibraryFilter('all');
    setSelectedEntry(id);
    setDraft({ language: draft.language, term: '', reading: '', meaning: '', difficulty: 2 });
    setShowAdd(false);
  }

  return (
    <section className="moonlex-page" data-testid="moonlex-page">
      <header className="moonlex-hero">
        <button type="button" className="moonlex-back" onClick={() => navigate('/')} aria-label="返回首頁"><AppIcon name="arrowLeft" size={18} /></button>
        <div><span className="moonlex-kicker">MOONLEX</span><h1>月潮詞冊</h1><p>收藏詞彙，讓每次練習都更熟悉。</p></div>
      </header>

      <div ref={commandBarRef} className="moonlex-command-bar" data-pet-safe-region="interactive">
        <label className="moonlex-search"><span aria-hidden="true">⌕</span><input aria-label="搜尋單詞、讀音或詞義" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋單詞、讀音或詞義" /></label>
        <button type="button" className="moonlex-add-button" tabIndex={0} aria-label="新增詞彙" aria-expanded={showAdd} onClick={() => setShowAdd((value) => !value)}>＋</button>
        <div className="moonlex-language" role="group" aria-label="語言篩選">
          {(['all', 'en', 'ja'] as MoonLexLanguageFilter[]).map((language) => <button key={language} type="button" aria-pressed={languageFilter === language} className={languageFilter === language ? 'is-active' : ''} onClick={() => { setLanguageFilter(language); setSelectedEntry(null); }}>{language === 'all' ? '全部語言' : language === 'en' ? 'EN' : '日'}</button>)}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && <motion.form className="moonlex-add-form" data-pet-safe-region="interactive" onSubmit={submitEntry} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <select value={draft.language} onChange={(event) => setDraft((value) => ({ ...value, language: event.target.value as VocabularyLanguage }))}><option value="en">English</option><option value="ja">日本語</option></select>
          <input required value={draft.term} onChange={(event) => setDraft((value) => ({ ...value, term: event.target.value }))} placeholder="單詞" />
          <input value={draft.reading} onChange={(event) => setDraft((value) => ({ ...value, reading: event.target.value }))} placeholder={draft.language === 'ja' ? '讀音（不會自動偽造振假名）' : '音標'} />
          <input required value={draft.meaning} onChange={(event) => setDraft((value) => ({ ...value, meaning: event.target.value }))} placeholder="詞義" />
          <select value={draft.difficulty} onChange={(event) => setDraft((value) => ({ ...value, difficulty: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 }))}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} 星</option>)}</select>
          <button type="submit">收進詞冊</button>
        </motion.form>}
      </AnimatePresence>

      <div className="moonlex-filter-row" data-pet-safe-region="interactive">
        <div className="moonlex-tabs" role="tablist" aria-label="詞冊分類">{FILTERS.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={libraryFilter === filter.id} className={libraryFilter === filter.id ? 'is-active' : ''} onClick={() => { setLibraryFilter(filter.id); setSelectedEntry(null); }}>{filter.label}</button>)}</div>
        <label className="moonlex-difficulty"><span>難度</span><select aria-label="難度" value={practiceDifficulty} onChange={(event) => setPracticeDifficulty(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} 星</option>)}</select></label>
      </div>

      <LayoutGroup id="moonlex-card-deck">
        <AnimatePresence mode="popLayout" initial={false}>
          {!selected ? (
            <motion.div key="overview" className="moonlex-deck-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: .42, scale: .98 }}>
              <div className="moonlex-section-heading"><div><span>CARD OVERVIEW</span><h2>Interactive Card Deck</h2></div><b>{deck.length} 張</b></div>
              {deck.length ? <div className="moonlex-card-grid">{deck.map((entry, index) => (
                <button type="button" key={entry.id} className="moonlex-overview-hitbox" onClick={() => chooseEntry(entry)}>
                  <motion.span layoutId={`moonlex-card-${entry.id}`} className="moonlex-card-paper" style={{ '--card-tilt': `${[-1.4, .8, -0.5, 1.2, -.8][index % 5]}deg` } as React.CSSProperties} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}>
                    <span className="moonlex-card-meta"><i>{entry.language.toUpperCase()}</i><em>{'★'.repeat(entry.difficulty)}</em></span>
                    <strong><ReadingLine entry={entry} /></strong>{entry.phonetic && <small>{entry.phonetic}</small>}
                    <span className="moonlex-card-meaning">{entry.meanings[0]}</span>
                    <span className="moonlex-card-footer"><span className={`moonlex-mastery is-${entry.mastery}`}>{MASTERY_LABEL[entry.mastery]}</span><span aria-label={entry.favorite ? '已收藏' : '未收藏'}>{entry.favorite ? '★' : '☆'}</span></span>
                  </motion.span>
                </button>
              ))}</div> : <div className="moonlex-empty">這個分類還沒有詞卡。換個篩選，或收下一個詞。</div>}
            </motion.div>
          ) : (
            <motion.div key="active" className="moonlex-active-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="moonlex-active-backdrop" onClick={() => setSelectedEntry(null)} aria-hidden="true" />
              <div
                ref={stageRef}
                className={`moonlex-deck-stage${dragging ? ' is-dragging' : ''}`}
                data-testid="moonlex-deck-stage"
                onPointerDown={onStagePointerDown}
                aria-label="詞卡牌組，可左右滑動或使用方向鍵"
              >
                {fanEntries.map(({ entry, offset }) => {
                  if (offset === 0) return null;
                  const geometry = fanTransform(offset);
                  const isNeighbour = Math.abs(offset) === 1;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`moonlex-deck-fan-card is-offset-${offset}${dragging ? ' is-dragging' : ''}`}
                      data-testid={`moonlex-deck-fan-${offset}`}
                      data-fan-offset={offset}
                      aria-label={`切換到 ${entry.term}`}
                      onClick={() => chooseEntry(entry)}
                      style={{
                        zIndex: 10 - Math.abs(offset),
                        transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0) rotate(${reducedMotion ? 0 : geometry.rotate}deg) scale(${geometry.scale})`,
                        opacity: geometry.opacity,
                        transition: dragging ? 'none' : `transform ${reducedMotion ? 120 : 300}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${reducedMotion ? 120 : 300}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                      }}
                    >
                      <small>{entry.language.toUpperCase()}{isNeighbour ? '' : ' ·'}</small>
                      <strong>{entry.term}</strong>
                      <span>{entry.meanings[0]}</span>
                    </button>
                  );
                })}
                <div className="moonlex-active-card-wrapper" ref={cardWrapperRef}>
                  <motion.article
                    layoutId={`moonlex-card-${selected.id}`}
                    className="moonlex-active-card"
                    data-fan-offset="0"
                    initial={false}
                    style={{ zIndex: 20, x: dragging ? dragX : reducedMotion ? 0 : dragX, rotate: reducedMotion ? 0 : dragX / 90, scale: dragging ? 0.985 : 1 }}
                    transition={dragging ? { duration: 0 } : { duration: reducedMotion ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                  <header data-pet-safe-region="interactive"><span aria-label={`第 ${selectedIndex + 1} 张，共 ${Math.max(deck.length, 1)} 张`}>{selectedIndex + 1} / {Math.max(deck.length, 1)}</span><button type="button" onClick={() => toggleFavorite(selected.id)} aria-label={selected.favorite ? '取消收藏' : '收藏'}>{selected.favorite ? '★ 已收藏' : '☆ 收藏'}</button></header>
                  <div className="moonlex-active-term"><StudyWord entry={selected} />{selected.phonetic && <small>{selected.phonetic}</small>}{selected.language === 'ja' && selected.reading && <small>{selected.reading}</small>}</div>
                  <div className="moonlex-active-meaning">{selected.meanings.join(' · ')}</div>
                  {selected.example && <q>{selected.example}</q>}{selected.exampleTranslation && <p>{selected.exampleTranslation}</p>}

                  <nav className="moonlex-card-navigation" aria-label="翻閱詞卡" data-pet-safe-region="interactive">
                    <button type="button" disabled={selectedIndex <= 0} onClick={() => chooseEntry(deck[selectedIndex - 1])}>上一個</button>
                    <button type="button" disabled={selectedIndex >= deck.length - 1} onClick={() => chooseEntry(deck[selectedIndex + 1])}>下一個</button>
                  </nav>
                  </motion.article>
                </div>
              </div>
              <div className="moonlex-practice-actions" data-pet-safe-region="interactive"><button type="button" onClick={() => rate('again')}>再看</button><button type="button" onClick={() => rate('hard')}>模糊</button><button type="button" onClick={() => rate('good')}>記得</button></div>
              <div className="moonlex-card-rail" aria-label="牌組選擇">{deck.slice(0, 8).map((entry) => <button key={entry.id} type="button" className={entry.id === selected.id ? 'is-selected' : ''} onClick={() => chooseEntry(entry)}><span>{entry.term}</span><small>{entry.meanings[0]}</small></button>)}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>

      <footer className="moonlex-stats"><div><strong>{Math.min(5, entries.length)}</strong><span>今日</span></div><div><strong>{dueCount}</strong><span>待複習</span></div><div><strong>{masteryCounts.mastered}</strong><span>已掌握</span></div><div><strong>{reviewedToday}</strong><span>今日完成</span></div></footer>
    </section>
  );
}
