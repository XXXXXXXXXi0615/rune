import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  buildSleepSummary,
  formatSleepDuration,
  parseSleepLog,
  parseScreenTime,
  buildScreenSummary,
  buildScreenTags,
} from '@/utils/healthImport';
import { t } from '@/i18n';

interface HealthImportSheetProps {
  onClose: () => void;
}

type ImportTab = 'sleep' | 'screen';

function SleepLineIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.2 5.2h4l-4 4h4M12.5 10.5h3l-3 3h3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScreenIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function HealthImportSheet({ onClose }: HealthImportSheetProps) {
  const addHealthRecord = useAppStore((s) => s.addHealthRecord);
  const addMemoryEntry = useAppStore((s) => s.addMemoryEntry);
  const locations = useAppStore((s) => s.locations);
  const [tab, setTab] = useState<ImportTab>('sleep');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');

  // Sleep parsing
  const sleepParsed = useMemo(() => parseSleepLog(rawText), [rawText]);
  const sleepSummary = useMemo(() => buildSleepSummary(sleepParsed), [sleepParsed]);

  // Screen time parsing
  const screenParsed = useMemo(() => parseScreenTime(rawText), [rawText]);
  const screenSummary = useMemo(() => buildScreenSummary(screenParsed), [screenParsed]);

  const handleImportSleep = () => {
    const trimmed = rawText.trim();
    if (!trimmed) { setError(t('health.pasteRequired')); return; }
    if (!sleepParsed.sleepDurationMinutes && !sleepParsed.sleepStart && sleepParsed.wakeCount === undefined) {
      setError(t('health.parseFailed')); return;
    }
    const healthRecordId = addHealthRecord({
      type: 'sleep', date: sleepParsed.date, source: 'pasted', rawText: trimmed,
      sleepStart: sleepParsed.sleepStart, sleepEnd: sleepParsed.sleepEnd,
      sleepDurationMinutes: sleepParsed.sleepDurationMinutes,
      deepSleepMinutes: sleepParsed.deepSleepMinutes,
      wakeCount: sleepParsed.wakeCount, quality: sleepParsed.quality,
      mood: sleepParsed.mood, notes: sleepSummary,
    });
    const insomniaStreet = locations.find((l) => l.name === '失眠街');
    addMemoryEntry({
      cardType: 'health', healthRecordId,
      scene: t('health.sleepRecord'), triggerText: trimmed,
      bodyThoughts: sleepSummary, anxietyLevel: 2,
      nextStep: t('health.sleepNextStep'),
      location: insomniaStreet ? { id: insomniaStreet.id, name: insomniaStreet.name } : { name: '失眠街' },
    });
    onClose();
  };

  const handleImportScreen = () => {
    const trimmed = rawText.trim();
    if (!trimmed) { setError(t('health.pasteRequired')); return; }
    if (screenParsed.totalMinutes === undefined && screenParsed.apps.length === 0) {
      setError('找不到螢幕使用時長或 App 記錄，請補充更多資訊'); return;
    }
    const healthRecordId = addHealthRecord({
      type: 'screenTime', date: screenParsed.date, source: 'pasted', rawText: trimmed,
      totalScreenMinutes: screenParsed.totalMinutes,
      topApps: screenParsed.apps.slice(0, 5),
      quality: screenParsed.quality, notes: screenSummary,
    });
    const tags = buildScreenTags(screenParsed);
    const triggerWithTags = [trimmed, ...tags.map((t) => `#${t}`)].join(' ');
    const screenLocation = locations.find((l) => l.name === '失眠街')
      || { name: '失眠街' };
    addMemoryEntry({
      cardType: 'health', healthRecordId,
      scene: '螢幕使用記錄', triggerText: triggerWithTags,
      bodyThoughts: screenSummary, anxietyLevel: screenParsed.quality === 'poor' ? 6 : 3,
      nextStep: '今天試著在睡前一小時放下手機。',
      location: 'id' in screenLocation ? { id: screenLocation.id, name: screenLocation.name } : screenLocation,
    });
    onClose();
  };

  const activeParsed = tab === 'sleep' ? sleepParsed : screenParsed;
  const activeSummary = tab === 'sleep' ? sleepSummary : screenSummary;
  const activeIcon = tab === 'sleep' ? <SleepLineIcon /> : <ScreenIcon />;
  const activeTitle = tab === 'sleep' ? t('health.importTitle') : '匯入螢幕使用時長';
  const activeEyebrow = tab === 'sleep' ? t('health.sleepLog') : '螢幕使用時長';
  const activePlaceholder = tab === 'sleep'
    ? t('health.pastePlaceholder')
    : '總螢幕時間：7小時32分鐘\n最常用 App：\n小紅書 2小時10分鐘\n微信 1小時20分鐘\nChrome 58分鐘';
  const handleImport = tab === 'sleep' ? handleImportSleep : handleImportScreen;

  return createPortal(
    <div className="health-import-overlay" onClick={onClose}>
      <section className="health-import-sheet" role="dialog" aria-modal="true" aria-labelledby="health-import-title" onClick={(e) => e.stopPropagation()}>
        <div className="health-import-handle" />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '0 16px' }}>
          {(['sleep', 'screen'] as ImportTab[]).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', border: 'none', background: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--text)' : 'var(--text-3)',
                fontSize: 14, fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              {t === 'sleep' ? '睡眠記錄' : '螢幕使用時長'}
            </button>
          ))}
        </div>

        <header className="health-import-header">
          <div className="health-import-title-wrap">
            <span className="health-import-icon">{activeIcon}</span>
            <div>
              <div className="health-import-eyebrow">{activeEyebrow}</div>
              <h2 id="health-import-title">{activeTitle}</h2>
            </div>
          </div>
          <button type="button" className="health-import-close" onClick={onClose} aria-label={t('sheet.cancel')}>×</button>
        </header>

        <div className="health-import-body">
          <label className="health-import-field">
            <span>{t('health.pasteLabel')}</span>
            <textarea
              value={rawText}
              onChange={(e) => { setRawText(e.target.value); setError(''); }}
              placeholder={activePlaceholder}
              autoFocus
            />
          </label>
          {error && <div className="health-import-error">{error}</div>}

          {rawText.trim() && (
            <div className="health-import-preview">
              <div className="health-import-preview-head">
                <span>{t('health.preview')}</span>
                <span className={`health-quality-badge ${(activeParsed as { quality?: string }).quality || 'normal'}`}>
                  {t(`health.quality.${(activeParsed as { quality?: string }).quality || 'normal'}`)}
                </span>
              </div>
              <strong>{activeSummary}</strong>
              {tab === 'sleep' && (
                <div className="health-import-metrics">
                  <span>{sleepParsed.sleepStart && sleepParsed.sleepEnd ? `${sleepParsed.sleepStart}–${sleepParsed.sleepEnd}` : t('health.timeUnknown')}</span>
                  <span>{sleepParsed.deepSleepMinutes !== undefined ? `${t('health.deepSleep')} ${formatSleepDuration(sleepParsed.deepSleepMinutes)}` : t('health.deepSleepUnknown')}</span>
                  <span>{sleepParsed.wakeCount !== undefined ? `${t('health.wakeCount')} ${sleepParsed.wakeCount}` : t('health.wakeUnknown')}</span>
                </div>
              )}
              {tab === 'screen' && screenParsed.apps.length > 0 && (
                <div className="health-import-metrics" style={{ flexDirection: 'column', gap: 3 }}>
                  {screenParsed.apps.slice(0, 5).map((app) => (
                    <span key={app.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{app.name}</span>
                      <span>{formatSleepDuration(app.durationMinutes)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="health-import-note">{t('health.localNote')}</p>
        </div>

        <footer className="health-import-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
          <button type="button" className="btn-primary" onClick={handleImport}>{t('health.importAction')}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export { SleepLineIcon };
