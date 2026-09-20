import { useMemo, useState } from 'react';
import {
  getDailyEntries,
  getDailyTotal,
  getLatestEntryOfDay,
  useHydrationStore,
  type HydrationEntry,
} from '@/store/useHydrationStore';
import { toLocalDateString } from '@/utils/date';
import { deriveWaterProgress } from '@/features/home/dailyRitualPresentation';

const SOURCE_LABEL: Record<HydrationEntry['source'], string> = {
  quick_add: '快捷',
  custom: '自訂',
  migration: '匯入',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 今日飲水 — second tab of the daily dock.
 *
 * Phase 1 consolidation:
 *   main view     — current / goal summary, water vessel, quick refill,
 *                   today's records (+ undo), 飲水設定 entry
 *   settings view — 每日目標 (1500 / 2000 / 2500 / 自訂) and 快捷補水設定,
 *                   reusing the existing `useHydrationStore` owners only
 *
 * Exactly one subview exists at a time inside the same Daily Tide window. Goal
 * presets persist immediately; the quick-amounts editor keeps an explicit
 * draft → 儲存 / 取消 flow, so the footer reads the neutral 「設定已同步」.
 */
const GOAL_PRESETS = [1500, 2000, 2500] as const;

export function HydrationTabContent() {
  const entries = useHydrationStore((s) => s.entries);
  const settings = useHydrationStore((s) => s.settings);
  const addEntry = useHydrationStore((s) => s.addEntry);
  const removeEntry = useHydrationStore((s) => s.removeEntry);
  const undoLastEntry = useHydrationStore((s) => s.undoLastEntry);
  const setDailyGoal = useHydrationStore((s) => s.setDailyGoal);
  const setQuickAmounts = useHydrationStore((s) => s.setQuickAmounts);
  const resetSettings = useHydrationStore((s) => s.resetSettings);

  const dateKey = toLocalDateString();
  const todayEntries = useMemo(
    () => getDailyEntries(entries, dateKey).slice().reverse(),
    [entries, dateKey],
  );
  const total = useMemo(() => getDailyTotal(entries, dateKey), [entries, dateKey]);
  const goal = settings.dailyGoalMl;
  const remaining = Math.max(0, goal - total);
  const pct = deriveWaterProgress(total, goal);
  const lastEntry = useMemo(() => getLatestEntryOfDay(entries, dateKey), [entries, dateKey]);

  const [view, setView] = useState<'main' | 'settings'>('main');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [customGoalOpen, setCustomGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goal));
  const [editingQuick, setEditingQuick] = useState(false);
  const [quickInput, setQuickInput] = useState(settings.quickAmounts.join(', '));

  const submitCustom = () => {
    const value = Number(customAmount);
    if (customAmount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setCustomError('請輸入大於 0 的飲水量（ml）。');
      return;
    }
    if (value > 3000) {
      setCustomError('單筆上限 3000 ml，請調低後再紀錄。');
      return;
    }
    if (addEntry(value, 'custom')) {
      setCustomAmount('');
      setCustomError(null);
      setCustomOpen(false);
    }
  };

  const applyGoal = () => {
    if (goalInput.trim() === '') return;
    const value = Number(goalInput);
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(250, Math.min(6000, Math.round(value)));
    setDailyGoal(clamped);
    setGoalInput(String(clamped));
    setCustomGoalOpen(false);
  };

  const selectGoalPreset = (amount: number) => {
    setDailyGoal(amount);
    setGoalInput(String(amount));
    setCustomGoalOpen(false);
  };

  const applyQuick = () => {
    const amounts = quickInput
      .split(/[,，、\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 3000);
    setQuickAmounts(amounts);
    setQuickInput(amounts.join(', '));
    setEditingQuick(false);
  };

  const handleResetSettings = () => {
    resetSettings();
    setGoalInput(String(2000));
    setQuickInput([100, 250, 500].join(', '));
    setEditingQuick(false);
    setCustomGoalOpen(false);
  };

  const isPresetGoal = (GOAL_PRESETS as readonly number[]).includes(goal);

  if (view === 'settings') {
    return (
      <div className="dt-dock-content hyd-tab" data-testid="hydration-tab" data-hyd-view="settings">
        <div className="hyd-settings-view" data-testid="hyd-settings-view">
          <button
            type="button"
            className="hyd-settings-back"
            data-testid="hyd-settings-back"
            onClick={() => setView('main')}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            返回
          </button>

          <div className="hyd-section">
            <div className="hyd-section__title">每日目標</div>
            <div className="hyd-goal-options" role="radiogroup" aria-label="每日飲水目標">
              {GOAL_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  role="radio"
                  aria-checked={goal === amount}
                  className={`hyd-goal-option${goal === amount ? ' is-active' : ''}`}
                  data-testid={`hyd-goal-option-${amount}`}
                  onClick={() => selectGoalPreset(amount)}
                >
                  {amount} ml
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={!isPresetGoal}
                className={`hyd-goal-option${!isPresetGoal ? ' is-active' : ''}`}
                data-testid="hyd-goal-option-custom"
                onClick={() => { setGoalInput(String(goal)); setCustomGoalOpen(true); }}
              >
                自訂
              </button>
            </div>
            {customGoalOpen && (
              <div className="hyd-custom-row">
                <input
                  type="number"
                  min={250}
                  max={6000}
                  inputMode="numeric"
                  autoFocus
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onBlur={applyGoal}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  aria-label="每日目標（ml）"
                  data-testid="hyd-goal-input"
                />
                <button type="button" className="hyd-mini-btn hyd-mini-btn--primary" onClick={applyGoal} data-testid="hyd-goal-save">儲存</button>
              </div>
            )}
            <span className="hyd-settings__hint">已自動儲存</span>
          </div>

          <div className="hyd-section">
            <div className="hyd-section__title">快捷補水設定</div>
            <p className="hyd-settings__current" data-testid="hyd-quick-summary">
              目前 {settings.quickAmounts.map((amount) => `+${amount}`).join(' · ')} ml
            </p>
            {editingQuick ? (
              <div className="hyd-quick-edit">
                <input
                  type="text"
                  inputMode="numeric"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyQuick(); }}
                  aria-label="快捷補水金額（ml，逗號分隔）"
                  data-testid="hyd-quick-input"
                />
                <button type="button" className="hyd-mini-btn" onClick={applyQuick} data-testid="hyd-quick-save">儲存</button>
                <button type="button" className="hyd-mini-btn hyd-mini-btn--ghost" onClick={() => { setEditingQuick(false); setQuickInput(settings.quickAmounts.join(', ')); }}>取消</button>
              </div>
            ) : (
              <button type="button" className="hyd-section__link" onClick={() => { setEditingQuick(true); setQuickInput(settings.quickAmounts.join(', ')); }} data-testid="hyd-quick-edit-toggle">編輯快捷金額</button>
            )}
          </div>

          <div className="hyd-section hyd-settings-reset">
            <button type="button" className="hyd-section__link hyd-section__link--danger" onClick={handleResetSettings} data-testid="hyd-settings-reset">恢復預設</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dt-dock-content hyd-tab" data-testid="hydration-tab" data-hyd-view="main">
      <div className="dt-panel-date" data-testid="hyd-date">{dateKey} · 今日飲水</div>

      {/* 1. 今日摘要 */}
      <div className="hyd-summary" data-testid="hyd-summary">
        <div className="hyd-summary__total">
          <span data-testid="hyd-total">{total}</span>
          <small>/ {goal} ml</small>
        </div>
        <div className="hyd-summary__goal">
          <span className="hyd-summary__remaining" data-testid="hyd-remaining">
            {remaining > 0 ? `還差 ${remaining} ml` : '今日補水完成'}
          </span>
        </div>
      </div>

      {/* 2. 水位進度 */}
      <div className="hyd-vessel-stage">
      <div
        className={`hyd-progress hyd-vessel${pct >= 100 ? ' hyd-progress--done' : ''}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="今日飲水進度"
        data-testid="hyd-progress"
      >
        <div className="hyd-vessel__shine" aria-hidden="true" />
        <div className="hyd-progress__wave" style={{ height: `${pct}%` }} data-testid="hyd-progress-wave">
          <i />
          <i />
        </div>
        <b data-testid="hyd-pct">{pct}%</b>
        {pct >= 100 && <span className="hyd-vessel__complete" data-testid="hyd-complete">今日潮位已滿</span>}
      </div>
      </div>

      {/* 3. 快捷補水 */}
      <div className="hyd-section">
        <div className="hyd-section__title">快捷補水</div>
        <div className="hyd-quick-row" data-testid="hyd-quick-row">
          {settings.quickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              className="hyd-quick-btn"
              data-testid={`hyd-quick-${amount}`}
              data-amount={amount}
              onClick={() => addEntry(amount, 'quick_add')}
            >
              +{amount}<small>ml</small>
            </button>
          ))}
          <button
            type="button"
            className="hyd-quick-btn hyd-quick-btn--custom"
            data-testid="hyd-custom-toggle"
            aria-expanded={customOpen}
            onClick={() => setCustomOpen((v) => !v)}
          >
            自訂
          </button>
        </div>
        {customOpen && (
          <div className="hyd-custom-row" data-testid="hyd-custom-row">
            <input
              type="number"
              min={1}
              max={3000}
              inputMode="numeric"
              placeholder="輸入 ml（上限 3000）"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setCustomError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
              data-testid="hyd-custom-input"
            />
            <button type="button" className="hyd-mini-btn hyd-mini-btn--primary" onClick={submitCustom} disabled={!customAmount} data-testid="hyd-custom-add">紀錄</button>
          </div>
        )}
        {customError && (
          <p className="hyd-error" role="alert" data-testid="hyd-error">{customError}</p>
        )}
      </div>

      {/* 4. 今日紀錄 */}
      <div className="hyd-section">
        <div className="hyd-section__title hyd-section__title--row">
          <span>今日紀錄</span>
          {lastEntry && <button type="button" className="hyd-section__link" onClick={undoLastEntry} data-testid="hyd-undo">
            復原最後一筆
          </button>}
        </div>
        {todayEntries.length === 0 ? (
          <p className="hyd-empty" data-testid="hyd-empty">今天的第一口水還沒記下</p>
        ) : (
          <ul className="hyd-entry-list" data-testid="hyd-entry-list">
            {(showAllEntries ? todayEntries : todayEntries.slice(0, 5)).map((entry) => (
              <li key={entry.id} className="hyd-entry-row" data-testid="hyd-entry-row">
                <i />
                <span>
                  <strong>{entry.amountMl} ml</strong>
                  <small>{formatTime(entry.recordedAt)} · {SOURCE_LABEL[entry.source]}</small>
                </span>
                <button
                  type="button"
                  className="hyd-entry-remove"
                  aria-label={`刪除 ${entry.amountMl} ml`}
                  onClick={() => removeEntry(entry.id)}
                  data-testid={`hyd-entry-remove-${entry.id}`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {todayEntries.length > 5 && <button type="button" className="hyd-section__link hyd-entry-more" onClick={() => setShowAllEntries((value) => !value)}>
          {showAllEntries ? '收合紀錄' : `查看其餘 ${todayEntries.length - 5} 筆`}
        </button>}
      </div>

      {/* 5. 飲水設定入口 */}
      <div className="hyd-section hyd-settings">
        <button
          type="button"
          className="hyd-settings__toggle"
          onClick={() => setView('settings')}
          data-testid="hyd-settings-toggle"
        >
          飲水設定
          <span className="hyd-settings__chevron">›</span>
        </button>
      </div>
    </div>
  );
}
