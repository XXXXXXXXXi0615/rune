/**
 * ObjectMemoryDetailPage — Layer 3.
 *
 * Full object life timeline, usage history, emotional/contextual notes,
 * and lifecycle progression visualization.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useObjectMemoryStore } from '@/store/objectMemoryStore';
import { useToastStore } from '@/store/useToastStore';
import type { ObjectLifecycleState } from '@/types';
import {
  deleteCanonicalItem,
  updateCanonicalItem,
  transitionCanonicalItemLifecycle,
  addCanonicalUsageLog,
  findCanonicalItemEntry,
  getCanonicalIdForObjectMemory,
} from '@/features/lifeLedger/canonicalItemStore';
import './ObjectMemoryPage.css';

const STATE_LABEL: Record<ObjectLifecycleState, string> = {
  active: '使用中',
  aging: '漸老',
  farewell: '告別期',
  retired: '已退役',
};

const STAGES: { key: ObjectLifecycleState; label: string }[] = [
  { key: 'active',   label: '使用中' },
  { key: 'aging',    label: '漸老' },
  { key: 'farewell', label: '告別期' },
  { key: 'retired',  label: '已退役' },
];

const MOOD_LABEL: Record<string, string> = {
  warm: '溫暖',
  neutral: '平淡',
  tired: '疲倦',
  fond: '眷戀',
  bittersweet: '苦甜',
};

const LIFECYCLE_EMOTION_LABEL: Record<string, string> = {
  neutral: '平靜',
  warm: '溫暖',
  fond: '眷戀',
  bittersweet: '苦甜',
  grateful: '感謝',
  sad: '不捨',
  ready: '準備好了',
};

type LifecycleTrackStyle = CSSProperties & { '--lifecycle-progress': string };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function ObjectMemoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const object = useObjectMemoryStore((s) => s.objects.find((o) => o.id === id));
  const deleteObject = useObjectMemoryStore((s) => s.deleteObject);
  const addUsageLog = useObjectMemoryStore((s) => s.addUsageLog);
  const updateObject = useObjectMemoryStore((s) => s.updateObject);
  const showToast = useToastStore((s) => s.showToast);

  const [logOpen, setLogOpen] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logMood, setLogMood] = useState<'warm' | 'neutral' | 'tired' | 'fond' | 'bittersweet' | ''>('');
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftLifecycle, setDraftLifecycle] = useState<ObjectLifecycleState>('active');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [lifecycleDraft, setLifecycleDraft] = useState<ObjectLifecycleState>('active');

  useEffect(() => {
    if (!object) return;
    setDraftName(object.name);
    setDraftCategory(object.category);
    setDraftLifecycle(object.lifecycleState);
    setLifecycleDraft(object.lifecycleState);
    setDraftStartDate(object.startDate);
    setDraftEndDate(object.endDate ?? '');
    setDraftNotes(object.notes);
  }, [object]);

  const timeline = useMemo(() => {
    if (!object) return [];
    return [...object.usageLogs].sort((a, b) => a.date.localeCompare(b.date));
  }, [object]);

  if (!object) {
    return (
      <section className="view olm-view olm-detail">
        <button type="button" className="olm-page-back" onClick={() => navigate('/objects')}>
          ← Dashboard
        </button>
        <div className="olm-empty">
          <strong>物品不存在</strong>
          <span>這筆物品可能已被刪除，或本機資料已被清理。</span>
          <button type="button" className="olm-empty-action" onClick={() => navigate('/objects')}>回到物品檔案</button>
        </div>
      </section>
    );
  }

  const currentIndex = STAGES.findIndex((s) => s.key === object.lifecycleState);
  const draftIndex = Math.max(0, STAGES.findIndex((s) => s.key === lifecycleDraft));
  const lifecycleChanged = lifecycleDraft !== object.lifecycleState;

  const toCanonicalLifecycle = (s: ObjectLifecycleState) => {
    const m: Record<ObjectLifecycleState, 'active' | 'idle' | 'aging' | 'farewell' | 'retired'> = {
      active: 'active', aging: 'aging', farewell: 'farewell', retired: 'retired',
    };
    return m[s] ?? 'active';
  };

  const handleAddLog = async () => {
    if (!logNote.trim()) return;
    const canonicalId = getCanonicalIdForObjectMemory(object.id);
    const entry = await findCanonicalItemEntry(canonicalId);
    if (entry) {
      const result = await addCanonicalUsageLog(canonicalId, entry.revision ?? 1, {
        date: logDate,
        note: logNote.trim(),
        mood: logMood || undefined,
      });
      if (result.status === 'conflict') {
        showToast('記錄已在其他地方變更，請重新載入後再試。');
        return;
      }
      if (result.status === 'rejected') {
        showToast('新增使用紀錄失敗，請稍後再試。');
        return;
      }
    } else {
      addUsageLog(object.id, { date: logDate, note: logNote.trim(), mood: logMood || undefined });
    }
    setLogNote('');
    setLogDate(new Date().toISOString().slice(0, 10));
    setLogMood('');
    setLogOpen(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`確定刪除「${object.name}」？物品會移出檔案，既有生命記錄仍會保留。`)) return;
    const canonicalId = getCanonicalIdForObjectMemory(object.id);
    const entry = await findCanonicalItemEntry(canonicalId);
    if (entry) {
      const result = await deleteCanonicalItem(canonicalId, entry.revision ?? 1);
      if (result.status === 'conflict' || result.status === 'rejected') {
        showToast('刪除失敗，請稍後再試。');
        return;
      }
    } else {
      deleteObject(object.id);
    }
    navigate('/objects');
  };

  const handleSaveObject = async () => {
    if (!draftName.trim()) return;
    const canonicalId = getCanonicalIdForObjectMemory(object.id);
    const entry = await findCanonicalItemEntry(canonicalId);
    if (entry) {
      const result = await updateCanonicalItem(canonicalId, entry.revision ?? 1, {
        name: draftName.trim(),
        category: draftCategory.trim() || '未分類',
        lifecycleState: toCanonicalLifecycle(draftLifecycle),
        startDate: draftStartDate,
        endDate: draftLifecycle === 'retired' ? draftEndDate || undefined : undefined,
        notes: draftNotes.trim(),
      });
      if (result.status === 'conflict') {
        showToast('這筆記錄已在其他地方變更，請重新載入後再試。');
        return;
      }
      if (result.status === 'rejected') {
        showToast('儲存失敗，請稍後再試。');
        return;
      }
    } else {
      updateObject(object.id, {
        name: draftName.trim(),
        category: draftCategory.trim() || '未分類',
        lifecycleState: draftLifecycle,
        startDate: draftStartDate,
        endDate: draftLifecycle === 'retired' ? draftEndDate || undefined : undefined,
        notes: draftNotes.trim(),
      });
    }
  };

  const handleConfirmLifecycle = async () => {
    if (!lifecycleChanged) return;
    const canonicalId = getCanonicalIdForObjectMemory(object.id);
    const entry = await findCanonicalItemEntry(canonicalId);
    if (entry) {
      const result = await transitionCanonicalItemLifecycle(
        canonicalId,
        entry.revision ?? 1,
        toCanonicalLifecycle(lifecycleDraft),
        lifecycleDraft === 'retired' ? object.endDate || new Date().toISOString().slice(0, 10) : undefined,
      );
      if (result.status === 'conflict') {
        showToast('這筆記錄已在其他地方變更，請重新載入後再試。');
        return;
      }
      if (result.status === 'rejected') {
        showToast('生命週期變更失敗，請稍後再試。');
        return;
      }
    } else {
      updateObject(object.id, {
        lifecycleState: lifecycleDraft,
        endDate: lifecycleDraft === 'retired' ? object.endDate || new Date().toISOString().slice(0, 10) : undefined,
      });
    }
  };

  const handleCancelLifecycle = () => {
    setLifecycleDraft(object.lifecycleState);
  };

  return (
    <section className="view olm-view olm-detail">
      <button type="button" className="olm-page-back" onClick={() => navigate('/objects/archive')}>
        ← Archive
      </button>

      <div className="settings-page-heading" style={{ marginBottom: 14 }}>
        <Header eyebrow={object.category} title={object.name} />
      </div>

      {/* Hero */}
      <div className="olm-detail-hero">
        <div className="olm-detail-cat-row">
          <span className="olm-archive-card-cat">{object.category}</span>
          <span className={`olm-state-badge olm-state--${object.lifecycleState}`}>{STATE_LABEL[object.lifecycleState]}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {formatDate(object.startDate)} 起 · {object.usageDays} 天
          </span>
        </div>
        {object.notes && <p className="olm-detail-notes">{object.notes}</p>}
      </div>

      <div className="olm-edit-card">
        <div className="olm-field-row">
          <label className="olm-inline-field">
            <span>名稱</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="olm-inline-field">
            <span>分類</span>
            <input value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} />
          </label>
        </div>
        <div className="olm-field-row">
          <label className="olm-inline-field">
            <span>生命狀態</span>
            <select value={draftLifecycle} onChange={(event) => setDraftLifecycle(event.target.value as ObjectLifecycleState)}>
              {STAGES.map((stage) => <option key={stage.key} value={stage.key}>{STATE_LABEL[stage.key]}</option>)}
            </select>
          </label>
          <label className="olm-inline-field">
            <span>開始日期</span>
            <input type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} />
          </label>
        </div>
        {draftLifecycle === 'retired' && (
          <label className="olm-inline-field">
            <span>退役日期</span>
            <input type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} />
          </label>
        )}
        <label className="olm-inline-field">
          <span>描述</span>
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} />
        </label>
        <div className="olm-detail-actions">
          <button type="button" onClick={handleSaveObject} disabled={!draftName.trim()}>儲存物品</button>
        </div>
      </div>

      {/* Lifecycle progression */}
      <div className="olm-progression">
        <div className="olm-progression-head">
          <div>
            <div className="olm-progression-label">生命週期進程</div>
            <div className="olm-progression-preview">
              目前：{STATE_LABEL[object.lifecycleState]} · 預覽：{STATE_LABEL[lifecycleDraft]}
            </div>
          </div>
          {lifecycleChanged && <span className="olm-progression-dirty">尚未儲存</span>}
        </div>
        <div className="olm-progression-track" style={{ '--lifecycle-progress': `${draftIndex * 25.333}%` } as LifecycleTrackStyle}>
          <input
            className="olm-progression-range"
            type="range"
            min={0}
            max={STAGES.length - 1}
            step={1}
            value={draftIndex}
            aria-label="調整生命週期"
            onChange={(event) => setLifecycleDraft(STAGES[Number(event.target.value)].key)}
          />
          {STAGES.map((stage, i) => {
            const isCurrent = i === currentIndex;
            const isDraft = i === draftIndex;
            const isPassed = i < draftIndex;
            return (
              <button
                key={stage.key}
                type="button"
                className={`olm-progression-stage olm-progression-stage--${stage.key}${isCurrent ? ' is-current' : ''}${isDraft ? ' is-draft' : ''}${isPassed ? ' is-passed' : ''}`}
                onClick={() => setLifecycleDraft(stage.key)}
              >
                <span className="olm-stage-dot" />
                {stage.label}
              </button>
            );
          })}
        </div>
        <div className="olm-lifecycle-actions">
          <button type="button" className="secondary" onClick={handleCancelLifecycle} disabled={!lifecycleChanged}>取消</button>
          <button type="button" className="primary" onClick={handleConfirmLifecycle} disabled={!lifecycleChanged}>確認變更</button>
        </div>
      </div>

      {/* Lifecycle event log */}
      {object.lifecycleEvents.length > 0 && (
        <div className="olm-timeline">
          <div className="olm-timeline-title">物品敘事</div>
          {[...object.lifecycleEvents]
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((event) => (
              <div key={event.id} className="olm-timeline-item">
                <div className="olm-timeline-date">{formatDate(new Date(event.createdAt).toISOString())}</div>
                <div className="olm-timeline-note">
                  <strong>{event.from ? `${STATE_LABEL[event.from]} → ` : ''}{STATE_LABEL[event.to]}</strong>
                  <span>{event.note || event.reason}</span>
                </div>
                <span className="olm-timeline-mood">{LIFECYCLE_EMOTION_LABEL[event.emotion] || event.emotion}</span>
                {event.context && <span className="olm-timeline-mood">{event.context}</span>}
                {event.reason && <span className="olm-timeline-mood">{event.reason}</span>}
              </div>
            ))}
        </div>
      )}

      {/* Timeline */}
      <div className="olm-timeline">
        <div className="olm-timeline-title">生命記錄</div>
        {timeline.length === 0 ? (
          <div className="olm-empty"><strong>尚未建立任何生命記錄</strong>使用「＋ 加入記錄」留下第一筆真實記錄</div>
        ) : (
          <>
            {timeline.map((log) => (
              <div key={log.id} className="olm-timeline-item">
                <div className="olm-timeline-date">{formatDate(log.date)}</div>
                <div className="olm-timeline-note">{log.note}</div>
                {log.mood && <span className="olm-timeline-mood">{MOOD_LABEL[log.mood] || log.mood}</span>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="olm-detail-actions">
        <button type="button" onClick={() => setLogOpen((v) => !v)}>＋ 加入記錄</button>
        <button type="button" className="olm-danger" onClick={handleDelete}>刪除</button>
      </div>

      {/* Inline log adder */}
      {logOpen && (
        <div className="olm-sheet-overlay" onClick={() => setLogOpen(false)}>
          <div className="olm-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 className="olm-sheet-title">加入生命記錄</h3>
            <div className="olm-field">
              <label>日期</label>
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </div>
            <div className="olm-field">
              <label>情緒</label>
              <select value={logMood} onChange={(e) => setLogMood(e.target.value as typeof logMood)}>
                <option value="">無</option>
                <option value="warm">溫暖</option>
                <option value="neutral">平淡</option>
                <option value="tired">疲倦</option>
                <option value="fond">眷戀</option>
                <option value="bittersweet">苦甜</option>
              </select>
            </div>
            <div className="olm-field">
              <label>記錄</label>
              <textarea value={logNote} onChange={(e) => setLogNote(e.target.value)} autoFocus />
            </div>
            <div className="olm-sheet-actions">
              <button type="button" className="secondary" onClick={() => setLogOpen(false)}>取消</button>
              <button type="button" className="primary" onClick={handleAddLog} disabled={!logNote.trim()}>確認加入記錄</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
