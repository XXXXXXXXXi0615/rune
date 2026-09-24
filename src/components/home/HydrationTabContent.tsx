import { useEffect, useMemo, useState } from 'react';
import {
  getDailyEntries,
  getDailyTotal,
  getLatestEntryOfDay,
  useHydrationStore,
  HYDRATION_MAX_ENTRY_ML,
  type HydrationEntry,
} from '@/store/useHydrationStore';
import { toLocalDateString } from '@/utils/date';
import { deriveWaterProgress } from '@/features/home/dailyRitualPresentation';
import { WheelPicker } from '@/components/ui/WheelPicker';

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
/**
 * Phase 2 — quick-amount picker:
 *   the settings quick section lists the canonical `quickAmounts` as touch
 *   chips; tapping one (or ＋) opens an in-surface wheel picker whose draft is
 *   only written on 完成 (`setQuickAmounts`) — 取消 never writes. The wheel
 *   steps by 50 ml up to the owner's single-entry cap; an existing off-grid
 *   value is kept representable inside its own picker session.
 */
const GOAL_PRESETS = [1500, 2000, 2500] as const;
const QUICK_AMOUNT_STEP = 50;
/** Mirrors `useHydrationStore.setQuickAmounts`'s six-entry cap (owner validation). */
const QUICK_AMOUNT_MAX_COUNT = 6;
const QUICK_AMOUNT_ADD_FALLBACKS = [500, 250, 100, 750, 1000, 150];

function buildQuickAmountOptions(current: number): number[] {
  const options: number[] = [];
  for (let amount = QUICK_AMOUNT_STEP; amount <= HYDRATION_MAX_ENTRY_ML; amount += QUICK_AMOUNT_STEP) {
    options.push(amount);
  }
  if (current > 0 && !options.includes(current)) options.push(current);
  return options.sort((a, b) => a - b);
}

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
  const [quickPicker, setQuickPicker] = useState<{ index: number | null; value: number; removed: boolean; options: number[] } | null>(null);

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

  const openQuickPicker = (index: number | null, value: number) => {
    setQuickPicker({ index, value, removed: false, options: buildQuickAmountOptions(value) });
  };

  const pickerOpen = quickPicker !== null;
  /**
   * The wheel positions itself inside its own mount frame, before the browser
   * has laid the new subtree out, so that first assignment would be clamped to
   * the top (and the snap event would rewrite the draft). Mount it on one frame
   * with index 0, then move it to the real index on the next frame.
   */
  const [quickWheelPhase, setQuickWheelPhase] = useState<'idle' | 'mounted' | 'positioned'>('idle');
  useEffect(() => {
    if (!pickerOpen) {
      setQuickWheelPhase('idle');
      return undefined;
    }
    setQuickWheelPhase('mounted');
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setQuickWheelPhase('positioned'));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [pickerOpen]);

  const confirmQuickPicker = () => {
    if (!quickPicker) return;
    const { index, value, removed } = quickPicker;
    const next = removed && index !== null
      ? settings.quickAmounts.filter((_, i) => i !== index)
      : index === null
        ? [...settings.quickAmounts, value]
        : settings.quickAmounts.map((amount, i) => (i === index ? value : amount));
    setQuickAmounts(next.filter((amount, i) => next.indexOf(amount) === i));
    setQuickPicker(null);
  };

  const defaultAddAmount = QUICK_AMOUNT_ADD_FALLBACKS.find((amount) => !settings.quickAmounts.includes(amount)) ?? QUICK_AMOUNT_STEP;

  const handleResetSettings = () => {
    resetSettings();
    setGoalInput(String(2000));
    setQuickPicker(null);
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
            {!quickPicker ? (
              <div className="hyd-quick-chips" data-testid="hyd-quick-chips">
                {settings.quickAmounts.map((amount, index) => (
                  <button
                    key={amount}
                    type="button"
                    className="hyd-quick-chip"
                    data-testid={`hyd-quick-chip-${amount}`}
                    onClick={() => openQuickPicker(index, amount)}
                  >
                    +{amount}<small>ml</small>
                  </button>
                ))}
                {settings.quickAmounts.length < QUICK_AMOUNT_MAX_COUNT && (
                  <button
                    type="button"
                    className="hyd-quick-chip hyd-quick-chip--add"
                    data-testid="hyd-quick-add"
                    aria-label="新增快捷量"
                    onClick={() => openQuickPicker(null, defaultAddAmount)}
                  >＋</button>
                )}
              </div>
            ) : (
              <div className="hyd-quick-picker" data-testid="hyd-quick-picker" data-hyd-picker-phase={quickWheelPhase}>
                {quickPicker.removed && quickPicker.index !== null ? (
                  <p className="hyd-quick-picker__remove" data-testid="hyd-quick-picker-remove-note">
                    將移除 +{settings.quickAmounts[quickPicker.index]} ml
                  </p>
                ) : (
                  <>
                    <p className="hyd-settings__current" data-testid="hyd-quick-picker-value">{quickPicker.value} ml</p>
                    {quickWheelPhase !== 'idle' && <WheelPicker
                      height={216}
                      separators={['ml']}
                      columns={[{
                        items: quickPicker.options.map((amount) => String(amount)),
                        selectedIndex: quickWheelPhase === 'positioned'
                          ? Math.max(0, quickPicker.options.indexOf(quickPicker.value))
                          : 0,
                        onChange: (optionIndex) => setQuickPicker((current) => (
                          current ? { ...current, value: current.options[optionIndex] } : current
                        )),
                        ariaLabel: '快捷補水量（ml）',
                      }]}
                    />}
                  </>
                )}
                <div className="hyd-quick-picker__actions">
                  {quickPicker.index !== null && (
                    <button
                      type="button"
                      className={`hyd-mini-btn hyd-mini-btn--ghost${quickPicker.removed ? ' is-armed' : ''}`}
                      aria-pressed={quickPicker.removed}
                      data-testid="hyd-quick-picker-delete"
                      onClick={() => setQuickPicker((current) => (current ? { ...current, removed: !current.removed } : current))}
                    >{quickPicker.removed ? '取消移除' : '刪除'}</button>
                  )}
                  <button type="button" className="hyd-mini-btn hyd-mini-btn--ghost" data-testid="hyd-quick-picker-cancel" onClick={() => setQuickPicker(null)}>取消</button>
                  <button type="button" className="hyd-mini-btn hyd-mini-btn--primary" data-testid="hyd-quick-picker-save" onClick={confirmQuickPicker}>完成</button>
                </div>
              </div>
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
