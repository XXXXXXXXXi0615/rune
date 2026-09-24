import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { selectAdaptiveDifficultyExplanation } from '@/features/tidewatch/reviewGate';
import { useTidewatchPolicyStore } from '@/features/tidewatch/reviewPolicyStore';
import type { ConsequenceLifecycle, ReviewRequestType, ReviewTone } from '@/features/tidewatch/types';
import { toLocalDateString } from '@/utils/date';
import { ConsequencePoolEditor } from './ConsequenceWheel';
import { RuneSectionRail } from '@/components/ui/rune';
import './TidewatchRulebook.css';

const REQUESTS: Array<[ReviewRequestType, string]> = [['defer','稍後處理'],['extend','延長期限'],['reduce','縮減任務'],['pause','暫停任務'],['abandon','放棄任務']];
const TONES: Array<[ReviewTone, string]> = [['restrained','克制'],['strict','嚴格'],['master','掌控']];
const DECISIONS = { approved: '通過', conditional: '有條件', rejected: '未通過' } as const;
const LIFECYCLES: Record<ConsequenceLifecycle, string> = { pending: '待抽取', revealed: '已揭曉', active: '執行中', fulfilled: '已完成' };
const OVERRIDES = { emergency: '緊急狀況', health: '健康因素', accidental_configuration: '設定錯誤', other: '其他正當理由' } as const;
const RULEBOOK_SECTIONS = [{ id: 'rules', label: '規則' }, { id: 'reviews', label: '審核紀錄' }, { id: 'ledger', label: '後果帳簿' }] as const;
type RulebookSection = typeof RULEBOOK_SECTIONS[number]['id'];
const star = (value: number) => `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
const thisWeek = (timestamp: number) => { const now = new Date(); const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return timestamp >= start.getTime(); };

export function TidewatchRuleSummary({ onOpen }: { onOpen: () => void }) {
  return <section className="tw-overview-card tw-rulebook-summary" data-testid="tidewatch-rulebook-summary" data-pet-safe-region="interactive"><header><div><small>RULEBOOK</small><h2>規則簿</h2></div><button type="button" onClick={onOpen}>查看規則簿</button></header></section>;
}

export function TidewatchRulebook({ onClose }: { onClose: () => void }) {
  const preferences = useTidewatchPolicyStore((state) => state.preferences);
  const consequencePreferences = useTidewatchPolicyStore((state) => state.consequencePreferences);
  const reviews = useTidewatchPolicyStore((state) => state.reviews);
  const consequences = useTidewatchPolicyStore((state) => state.consequences);
  const setPreferences = useTidewatchPolicyStore((state) => state.setPreferences);
  const setIntensity = useTidewatchPolicyStore((state) => state.setConsequenceIntensity);
  const useBaseToday = useTidewatchPolicyStore((state) => state.useBaseDifficultyToday);
  const [section, setSection] = useState<RulebookSection>('rules');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingPool, setEditingPool] = useState(false);
  const [filter, setFilter] = useState<'all'|'open'|'done'|'safe'>('all');
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const today = new Date();
  const overridden = Boolean(preferences.useBaseDifficultyByDate?.[toLocalDateString(today)]);
  const explanation = useMemo(() => selectAdaptiveDifficultyExplanation(preferences.baseDifficulty, preferences.difficultyMode === 'adaptive', reviews, today, overridden), [overridden, preferences.baseDifficulty, preferences.difficultyMode, reviews]);
  const ledger = consequences.filter((item) => filter === 'all' || filter === 'open' && item.lifecycle !== 'fulfilled' || filter === 'done' && item.lifecycle === 'fulfilled' && !item.safetyOverride || filter === 'safe' && Boolean(item.safetyOverride)).sort((a,b) => b.createdAt-a.createdAt);
  const stats = { reviews: reviews.filter((item) => thisWeek(item.createdAt)), failures: consequences.filter((item) => thisWeek(item.createdAt)), fulfilled: consequences.filter((item) => thisWeek(item.createdAt) && item.lifecycle === 'fulfilled') };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); previous?.focus(); };
  }, []);

  const toneLabel = TONES.find(([value]) => value === preferences.tone)?.[1] ?? '克制';
  return createPortal(<div className="tw-rulebook-layer">
    <button type="button" className="tw-rulebook-scrim" aria-label="收起規則簿" onClick={onClose}/>
    <section className="tw-rulebook" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tw-rulebook-title" data-pet-safe-region="critical">
      {editingPool ? <ConsequencePoolEditor onClose={() => setEditingPool(false)}/> : <>
        <header className="tw-rulebook-header"><div><small>TIDEWATCH</small><h2 id="tw-rulebook-title">規則簿</h2><p>既有規則，一眼看清；需要時才展開調整。</p></div><button type="button" className="tw-rulebook-close" aria-label="收起規則簿" onClick={onClose}><span aria-hidden="true">×</span></button></header>
        <nav className="tw-rulebook-tabs" aria-label="規則簿章節">{RULEBOOK_SECTIONS.map(({ id, label }) => <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
        <div className="tw-rulebook-reading-layout">
          <RuneSectionRail sections={RULEBOOK_SECTIONS} activeId={section} onSelect={(id) => {
            setSection(id as RulebookSection);
            dialogRef.current?.querySelector<HTMLElement>('.tw-rulebook-scroll')?.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          }} label="規則簿章節捷徑" />
          <div className="tw-rulebook-scroll">
          {section === 'rules' && <div className="tw-rulebook-panel" key="rules">
            <section className="tw-rulebook-overview" aria-label="規則摘要"><span><small>審核基礎難度</small><strong>{preferences.baseDifficulty} 星</strong></span><span><small>目前模式</small><strong>{preferences.difficultyMode === 'adaptive' ? 'Adaptive' : 'Fixed'}</strong></span><span><small>Rune 語氣</small><strong>{toneLabel}</strong></span><span><small>後果強度</small><strong>{consequencePreferences.intensity} 星</strong></span></section>
            <button type="button" className="tw-rulebook-disclosure" aria-expanded={settingsOpen} aria-controls="tw-rulebook-settings" onClick={() => setSettingsOpen((value) => !value)}><span><small>ADJUST</small>{settingsOpen ? '收起可調設定' : '展開可調設定'}</span><i aria-hidden="true">⌄</i></button>
            <div id="tw-rulebook-settings" className="tw-rulebook-settings" data-open={settingsOpen}><div className="tw-rulebook-settings-inner">
              <section><h3>審核基礎難度</h3><div className="tw-rulebook-requests">{REQUESTS.map(([type,label]) => <label key={type}><span>{label}</span><select aria-label={`${label}基礎難度`} value={preferences.baseDifficultyByType?.[type] ?? preferences.baseDifficulty} onChange={(event) => void setPreferences({ baseDifficultyByType: { ...preferences.baseDifficultyByType, [type]: Number(event.target.value) } })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} 星</option>)}</select></label>)}</div></section>
              <section><h3>難度模式</h3><div className="tw-rulebook-choice tw-rulebook-choice--two" role="group" aria-label="難度模式">{([['fixed','Fixed'],['adaptive','Adaptive']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={preferences.difficultyMode === value} onClick={() => void setPreferences({ difficultyMode: value })}>{label}</button>)}</div>{preferences.difficultyMode === 'adaptive' && <div className="tw-adaptive" data-testid="adaptive-explanation"><div><span>基礎 {star(explanation.baseDifficulty)}</span><span>今日 {star(explanation.todayDerivedDifficulty)}</span><b>{explanation.delta ? `暫時 +${explanation.delta}` : '無調整'}</b></div><p>{explanation.reason}</p><small>只作用於今天</small><button type="button" disabled={overridden} onClick={() => void useBaseToday()}>{overridden ? '今天已使用基礎難度' : '今天使用基礎難度'}</button></div>}</section>
              <section><h3>Rune 語氣</h3><div className="tw-rulebook-choice" role="group" aria-label="Rune 語氣">{TONES.map(([value,label]) => <button type="button" key={value} aria-pressed={preferences.tone === value} onClick={() => void setPreferences({ tone: value })}>{label}</button>)}</div></section>
              <section><h3>後果</h3><label className="tw-rulebook-intensity"><span>強度</span><output>{consequencePreferences.intensity} 星</output><input aria-label="規則簿後果強度" type="range" min="1" max="5" value={consequencePreferences.intensity} style={{ '--tw-range-progress': `${(consequencePreferences.intensity - 1) * 25}%` } as CSSProperties} onChange={(event) => void setIntensity(Number(event.target.value))}/></label><p>已啟用 {consequencePreferences.pool.filter((item) => item.enabled).length} / {consequencePreferences.pool.length} 項</p><button type="button" className="tw-rulebook-action" onClick={() => setEditingPool(true)}>編輯後果清單</button></section>
            </div></div>
            <div className="tw-rulebook-secondary"><details><summary><span>安全例外</span><small>{Object.keys(OVERRIDES).length} 類</small></summary><div><ul>{Object.values(OVERRIDES).map((label) => <li key={label}>{label}</li>)}</ul><p>例外仍透過既有 Safety Override 留下審核紀錄。</p></div></details><details><summary><span>本週摘要</span><small>{stats.reviews.length} 次審核</small></summary><div className="tw-rulebook-stats"><span>審核 <b>{stats.reviews.length}</b></span><span>有條件 <b>{stats.reviews.filter((item) => item.decision.decision === 'conditional').length}</b></span><span>未通過 <b>{stats.reviews.filter((item) => item.decision.decision === 'rejected').length}</b></span><span>失敗 <b>{stats.failures.length}</b></span><span>完成後果 <b>{stats.fulfilled.length}</b></span></div></details></div>
          </div>}
          {section === 'reviews' && <div className="tw-rulebook-panel tw-history-list" key="reviews" data-testid="tidewatch-rulebook-review-history">{reviews.length ? reviews.map((item) => <article key={item.id}><header><strong>{item.questTitleSnapshot}</strong><time>{new Date(item.createdAt).toLocaleString('zh-TW')}</time></header><p>{REQUESTS.find(([type]) => type === item.requestType)?.[1]} · {item.difficultySnapshot} 星 · {DECISIONS[item.decision.decision]}</p>{item.decision.conditions?.map((condition) => <small key={condition}>條件：{condition}</small>)}{item.overrideReason && <small>安全例外：{OVERRIDES[item.overrideReason]}</small>}</article>) : <p>尚無審核紀錄。</p>}</div>}
          {section === 'ledger' && <div className="tw-rulebook-panel" key="ledger"><div className="tw-ledger-filter" role="group" aria-label="後果帳簿篩選">{([['all','全部'],['open','待處理'],['done','已完成'],['safe','安全結束']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="tw-history-list" data-testid="tidewatch-consequence-ledger">{ledger.length ? ledger.map((item) => <article key={item.id}><header><strong>{item.questTitleSnapshot}</strong><b>{LIFECYCLES[item.lifecycle]}</b></header><p>{item.selectedItemSnapshot?.title ?? '尚未抽取'}{item.selectedItemSnapshot ? ` · ${item.selectedItemSnapshot.intensity} 星` : ''}</p><small>來源：{item.sourceEventId}</small><small>建立：{new Date(item.createdAt).toLocaleString('zh-TW')}</small>{item.selectedAt && <small>揭曉：{new Date(item.selectedAt).toLocaleString('zh-TW')}</small>}{item.executionStartedAt && <small>啟動：{new Date(item.executionStartedAt).toLocaleString('zh-TW')}</small>}{item.fulfilledAt && <small>完成：{new Date(item.fulfilledAt).toLocaleString('zh-TW')}</small>}{item.safetyOverride && <small>安全結束：{OVERRIDES[item.safetyOverride]}</small>}</article>) : <p>此篩選下沒有紀錄。</p>}</div></div>}
          </div>
        </div>
      </>}
    </section>
  </div>, document.body);
}
