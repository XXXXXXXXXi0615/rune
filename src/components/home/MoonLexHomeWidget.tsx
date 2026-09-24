import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeWidgetSize } from '@/features/home/types';
import type { VocabularyLanguage } from '@/features/moonlex/types';
import { useMoonLexStore } from '@/store/useMoonLexStore';
import '@/styles/moonlex-widget.css';

export function MoonLexHomeWidget({ size }: { size: HomeWidgetSize }) {
  const navigate = useNavigate();
  const entries = useMoonLexStore((state) => state.entries);
  const languageFilter = useMoonLexStore((state) => state.languageFilter);
  const practiceDifficulty = useMoonLexStore((state) => state.practiceDifficulty);
  const setLanguageFilter = useMoonLexStore((state) => state.setLanguageFilter);
  const recordPractice = useMoonLexStore((state) => state.recordPractice);
  const [active, setActive] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);

  const pool = useMemo(() => {
    const activeLanguage = languageFilter === 'all' ? 'en' : languageFilter;
    const exact = entries.filter((entry) => entry.language === activeLanguage && entry.difficulty === practiceDifficulty);
    const languagePool = entries.filter((entry) => entry.language === activeLanguage);
    return (exact.length ? exact : languagePool).slice(0, 5);
  }, [entries, languageFilter, practiceDifficulty]);
  const entry = pool[index % Math.max(pool.length, 1)];
  const isResult = pool.length > 0 && completed >= pool.length;

  function changeLanguage(language: VocabularyLanguage) {
    setLanguageFilter(language);
    setActive(false);
    setShowBack(false);
    setIndex(0);
    setCompleted(0);
  }

  function rate(rating: 'remembered' | 'again') {
    if (!entry) return;
    recordPractice({ vocabularyId: entry.id, result: rating === 'remembered' ? 'good' : 'again', mode: 'flip' });
    setCompleted((value) => value + 1);
    setIndex((value) => value + 1);
    setShowBack(false);
  }

  return (
    <section className={`moonlex-widget moonlex-widget--${size}${active ? ' is-active' : ''}`} aria-label="練習單詞">
      <header data-no-widget-drag>
        <span>✦ 今日單詞</span>
        <div className="moonlex-widget-tools">
          <div className="moonlex-widget-segment" role="group" aria-label="切換單詞語言">
            <button type="button" className={languageFilter === 'en' || languageFilter === 'all' ? 'is-active' : ''} onClick={() => changeLanguage('en')}>EN</button>
            <button type="button" className={languageFilter === 'ja' ? 'is-active' : ''} onClick={() => changeLanguage('ja')}>日</button>
          </div>
          <em>{'★'.repeat(practiceDifficulty)}</em>
        </div>
      </header>

      {!entry ? (
        <button type="button" className="moonlex-widget-empty" data-no-widget-drag onClick={() => navigate('/moonlex')}>單詞本還是空的，先去收下一個詞。</button>
      ) : isResult ? (
        <div className="moonlex-widget-result" data-no-widget-drag>
          <strong>{completed}/{pool.length}</strong>
          <span>今天也練習了單詞，做得很好。</span>
          <div><button type="button" onClick={() => { setCompleted(0); setIndex(0); }}>再練一輪</button><button type="button" onClick={() => navigate('/moonlex')}>查看單詞本</button></div>
        </div>
      ) : !active ? (
        <button type="button" className="moonlex-widget-idle" data-no-widget-drag onClick={() => setActive(true)}>
          <span className="moonlex-widget-term">{entry.term}</span>
          <small>{entry.reading ?? entry.phonetic ?? entry.meanings[0]}</small>
          <em>點擊開始練習 →</em>
        </button>
      ) : (
        <div className="moonlex-widget-practice" data-no-widget-drag>
          <button type="button" className={`moonlex-widget-flip${showBack ? ' is-flipped' : ''}`} onClick={() => setShowBack((value) => !value)}>
            <span className="moonlex-widget-face moonlex-widget-front"><strong>{entry.term}</strong><small>{entry.reading ?? entry.phonetic}</small></span>
            <span className="moonlex-widget-face moonlex-widget-back"><strong>{entry.meanings[0]}</strong><small>{entry.example}</small></span>
          </button>
          {showBack && <div className="moonlex-widget-rating"><button type="button" onClick={() => rate('again')}>再看一次</button><button type="button" onClick={() => rate('remembered')}>記住了 ✓</button></div>}
        </div>
      )}
    </section>
  );
}
