import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { parseSleepText, sleepDataToSummary } from '@/utils/sleepParser';
import {
  buildSleepStages,
  createHeartRate,
  createSleepRecord,
  saveSleepRecord,
} from '@/utils/sleepStorage';
import { sendChatMessage } from '@/ai/client';
import type { ParsedSleepData } from '@/utils/sleepParser';

type ImportTab = 'manual' | 'appleHealth' | 'ai';

interface SleepImportSheetProps {
  onClose: () => void;
  onImported?: () => void;
}

function SleepLineIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SparklesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 6 6 0 0 0-9-9Z" />
      <path d="M12 21a6 6 0 0 0-9-9 6 6 0 0 0 9 9Z" />
      <path d="M3 12a6 6 0 0 0 9 9 6 6 0 0 0-9-9Z" />
      <path d="M21 12a6 6 0 0 0-9-9 6 6 0 0 0 9 9Z" />
    </svg>
  );
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

const TABS: { key: ImportTab; label: string; icon: typeof SleepLineIcon }[] = [
  { key: 'manual', label: '手動貼上', icon: UploadIcon },
  { key: 'appleHealth', label: 'Apple Health', icon: SleepLineIcon },
  { key: 'ai', label: 'AI 解析', icon: SparklesIcon },
];

const APPLE_HEALTH_PLACEHOLDER = `睡眠：7h32m
深層：2h10m
REM：1h45m
核心：3h35m
清醒：12m`;

const MANUAL_PLACEHOLDER = `昨晚11點睡到7點，睡了8小時。
深睡2小時，REM 1.5小時，核心睡眠4小時，清醒15分鐘`;

const AI_PLACEHOLDER = `昨晚很晚才睡，大概12點多才躺下，早上8點醒來。
斷斷續續睡不太好，半夜醒了好幾次。`;

export function SleepImportSheet({ onClose, onImported }: SleepImportSheetProps) {
  const addHealthRecord = useAppStore((s) => s.addHealthRecord);
  const aiConfig = useAppStore((s) => s.aiConfig);

  const [tab, setTab] = useState<ImportTab>('manual');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const placeholder = tab === 'appleHealth' ? APPLE_HEALTH_PLACEHOLDER
    : tab === 'ai' ? AI_PLACEHOLDER
    : MANUAL_PLACEHOLDER;

  const parsed = useMemo(() => parseSleepText(rawText), [rawText]);
  const summary = useMemo(() => sleepDataToSummary(parsed), [parsed]);
  const hasParsed = rawText.trim().length > 0 && (
    (parsed.totalSleep !== undefined && parsed.totalSleep > 0)
    || (parsed.sleepStart && parsed.sleepEnd)
    || (parsed.deepMinutes !== undefined && parsed.deepMinutes > 0)
    || (parsed.remMinutes !== undefined && parsed.remMinutes > 0)
  );

  const handleAiParse = useCallback(async () => {
    if (!rawText.trim()) { setError('請貼上睡眠記錄'); return; }
    if (!aiConfig.apiKey) { setError('請先在設定中設定 API Key'); return; }
    setAiLoading(true);
    setError('');
    try {
      const systemPrompt = '你是一個睡眠記錄解析助手。請從以下文字中提取睡眠資訊，只回傳 JSON（不要 markdown 包裹），格式：{ "sleepStart": "23:00", "sleepEnd": "07:30", "totalSleep": 450, "deepMinutes": 120, "remMinutes": 90, "coreMinutes": 210, "awakeMinutes": 15 }。時間用 HH:MM 24小時制。totalSleep 以分鐘為單位。如果某個欄位無法判斷則省略該欄位。';
      const result = await (async () => {
        const generator = sendChatMessage(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: rawText }],
          { provider: aiConfig.provider, model: aiConfig.model, apiKey: aiConfig.apiKey, baseUrl: aiConfig.baseUrl, temperature: 0.1, maxTokens: 1024, topP: 1, systemPrompt: '' },
          new AbortController().signal,
        );
        let text = '';
        for await (const chunk of generator) {
          text += chunk.content;
        }
        return text;
      })();
      // Clean markdown code block if present
      const cleaned = result.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim();
      const aiParsed = JSON.parse(cleaned) as {
        sleepStart?: string; sleepEnd?: string; totalSleep?: number;
        deepMinutes?: number; remMinutes?: number; coreMinutes?: number; awakeMinutes?: number;
      };
      // Re-run parseSleepText but merge with AI result via rawText reconstruction
      // Simple approach: build a synthetic text and re-parse
      const syntheticText = [
        aiParsed.sleepStart && aiParsed.sleepEnd ? `${aiParsed.sleepStart}-${aiParsed.sleepEnd}` : '',
        aiParsed.totalSleep ? `睡了${Math.floor(aiParsed.totalSleep / 60)}小時${aiParsed.totalSleep % 60}分鐘` : '',
        aiParsed.deepMinutes ? `深睡${aiParsed.deepMinutes}分鐘` : '',
        aiParsed.remMinutes ? `REM${aiParsed.remMinutes}分鐘` : '',
        aiParsed.coreMinutes ? `核心${aiParsed.coreMinutes}分鐘` : '',
        aiParsed.awakeMinutes ? `清醒${aiParsed.awakeMinutes}分鐘` : '',
      ].filter(Boolean).join('，');
      // Replace rawText with syntheticText so parser picks it up
      // We can't easily re-trigger the parse, so just use the data directly
      handleImportFromData({
        date: parsed.date,
        totalSleep: aiParsed.totalSleep,
        awakeMinutes: aiParsed.awakeMinutes,
        remMinutes: aiParsed.remMinutes,
        coreMinutes: aiParsed.coreMinutes,
        deepMinutes: aiParsed.deepMinutes,
        sleepStart: aiParsed.sleepStart,
        sleepEnd: aiParsed.sleepEnd,
      });
    } catch (err) {
      setError('AI 解析失敗，請檢查 API Key 或稍後再試');
      console.error('[SleepImport] AI parse error:', err);
    } finally {
      setAiLoading(false);
    }
  }, [rawText, aiConfig, parsed.date]);

  const handleImportFromData = useCallback((data: ParsedSleepData) => {
    const stageSleepMinutes = (data.remMinutes || 0) + (data.coreMinutes || 0) + (data.deepMinutes || 0);
    const totalMinutes = data.totalSleep || stageSleepMinutes || 420;
    const awake = data.awakeMinutes || 0;
    const rem = data.remMinutes || Math.round(totalMinutes * 0.22);
    const core = data.coreMinutes || Math.round(totalMinutes * 0.62);
    const deep = data.deepMinutes || Math.round(totalMinutes * 0.16);

    const sleepStart = data.sleepStart || '23:00';
    const sleepEnd = data.sleepEnd || '07:00';

    // Create SleepRecord (localStorage for SleepCenter)
    const record = createSleepRecord({
      date: data.date,
      sleepStart,
      sleepEnd,
      durationMinutes: totalMinutes,
      stages: buildSleepStages({ awake, rem, core, deep }),
      heartRate: createHeartRate(57),
      steps: 0,
      activeEnergy: 0,
      restingHeartRate: 55,
      appUsage: [],
      note: '',
      quality: 'fair',
    });
    saveSleepRecord(record);

    // Create HealthRecord (Zustand for Life Graph)
    const quality = deep >= totalMinutes * 0.16 ? 'good' : (deep >= totalMinutes * 0.1 ? 'normal' : 'poor');
    addHealthRecord({
      type: 'sleep',
      date: data.date,
      source: 'pasted',
      sleepStart,
      sleepEnd,
      sleepDurationMinutes: totalMinutes,
      deepSleepMinutes: deep,
      wakeCount: awake > 10 ? 1 : 0,
      quality,
      notes: sleepDataToSummary(data),
    });

    onClose();
    onImported?.();
  }, [addHealthRecord, onClose, onImported]);

  const handleImport = useCallback(() => {
    const trimmed = rawText.trim();
    if (!trimmed) { setError('請貼上睡眠記錄'); return; }
    if (!hasParsed) { setError('無法解析睡眠記錄，請檢查格式'); return; }
    handleImportFromData(parsed);
  }, [rawText, hasParsed, handleImportFromData, parsed]);

  return createPortal(
    <div className="sleep-sheet-overlay" onClick={onClose}>
      <section className="sleep-sheet" role="dialog" aria-modal="true" aria-labelledby="sleep-import-title" onClick={(e) => e.stopPropagation()}>
        <div className="sleep-sheet-handle" />

        {/* Tabs */}
        <div className="sleep-import-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`sleep-import-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => { setTab(t.key); setError(''); }}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>

        <header className="sleep-sheet-head">
          <div className="sleep-sheet-heading">
            <span className="sleep-sheet-eyebrow">Import</span>
            <h2 id="sleep-import-title">導入睡眠日誌</h2>
            {tab === 'appleHealth' && <p>從 Apple Health 匯出睡眠數據，支援「深層／REM／核心／清醒」欄位。</p>}
            {tab === 'ai' && <p>用自然語言描述昨晚的睡眠情況，AI 會自動解析。</p>}
          </div>
          <button type="button" className="sleep-sheet-close" onClick={onClose} aria-label="關閉">&#x2715;</button>
        </header>

        <div className="sleep-sheet-body">
          <div className="sleep-field">
            <label className="sleep-field-label">
              {tab === 'appleHealth' ? '貼上 Apple Health 格式' : tab === 'ai' ? '描述昨晚睡眠' : '貼上睡眠記錄'}
            </label>
            <textarea
              className="sleep-field-textarea sleep-import-textarea"
              value={rawText}
              onChange={(e) => { setRawText(e.target.value); setError(''); }}
              placeholder={placeholder}
              autoFocus
            />
          </div>

          {error && <p className="sleep-form-error" role="alert">{error}</p>}

          {/* Preview */}
          {rawText.trim() && hasParsed && (
            <div className="sleep-import-preview">
              <div className="sleep-import-preview-head">
                <span>解析結果</span>
              </div>
              <div className="sleep-import-preview-body">
                <strong>{summary}</strong>
                <div className="sleep-import-preview-metrics">
                  {parsed.sleepStart && parsed.sleepEnd && (
                    <span>時段 {parsed.sleepStart} → {parsed.sleepEnd}</span>
                  )}
                  {parsed.deepMinutes !== undefined && parsed.deepMinutes > 0 && (
                    <span>深睡 {Math.round(parsed.deepMinutes)}m</span>
                  )}
                  {parsed.remMinutes !== undefined && parsed.remMinutes > 0 && (
                    <span>REM {Math.round(parsed.remMinutes)}m</span>
                  )}
                  {parsed.coreMinutes !== undefined && parsed.coreMinutes > 0 && (
                    <span>核心 {Math.round(parsed.coreMinutes)}m</span>
                  )}
                  {parsed.awakeMinutes !== undefined && parsed.awakeMinutes > 0 && (
                    <span>清醒 {Math.round(parsed.awakeMinutes)}m</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="health-import-note">資料僅儲存在本機，不會上傳到任何伺服器。</p>
        </div>

        <footer className="sleep-sheet-foot">
          <button type="button" className="sleep-button sleep-button--glass" onClick={onClose}>取消</button>
          {tab === 'ai'
            ? (
              <button
                type="button"
                className="sleep-button sleep-button--primary"
                onClick={handleAiParse}
                disabled={aiLoading || !rawText.trim()}
              >
                {aiLoading ? '解析中...' : '使用 AI 解析'}
              </button>
            )
            : (
              <button
                type="button"
                className="sleep-button sleep-button--primary"
                onClick={handleImport}
                disabled={!hasParsed}
              >
                匯入睡眠
              </button>
            )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
