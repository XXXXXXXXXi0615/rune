import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { BackButton } from '@/components/layout/BackButton'
import { Card } from '@/components/ui/Card'
import { QuickJournalForm } from '@/components/memory/QuickJournalForm'
import { MemoryDetail } from '@/components/memory/MemoryDetail'
import { DiaryPanel } from '@/components/memory/DiaryPanel'
import { HealthImportSheet, SleepLineIcon } from '@/components/memory/HealthImportSheet'
import { MoodIcon, type MemoryMoodIconName } from '@/components/memory/MoodIcon'
import { LocationIcon } from '@/components/icons/LocationIcon'
import { useAppStore } from '@/store/useAppStore'
import { LunaMessage } from '@/components/layout/LunaMessage'
import { t } from '@/i18n'
import type { MemoryEntry } from '@/types'
import { computeMemoryStats, formatStatsSummary } from '@/ai/memorySummary'
import { formatSleepDuration } from '@/utils/healthImport'
import { loadPreviews, addPreview, updatePreview, deletePreview, type HtmlPreview } from '@/config/htmlPreviews'

type View = 'menu' | 'form' | 'detail'
type MemoryTab = 'memory' | 'diary' | 'moonwindow'
type EmotionFilter = 'all' | 'joy' | 'anger' | 'sad' | 'tired' | 'music' | 'health'
type MapMood = 'joy' | 'sad' | 'anger' | 'tired' | 'music'

/* ── Emotion filter chips ── */
const EMOTIONS: { key: EmotionFilter; icon: MemoryMoodIconName; labelKey: string }[] = [
  { key: 'all', icon: 'all', labelKey: 'memory.filter.all' },
  { key: 'joy', icon: 'joy', labelKey: 'memory.filter.joy' },
  { key: 'anger', icon: 'anger', labelKey: 'memory.filter.anger' },
  { key: 'sad', icon: 'sadness', labelKey: 'memory.filter.sadness' },
  { key: 'tired', icon: 'fatigue', labelKey: 'memory.filter.fatigue' },
  { key: 'music', icon: 'music', labelKey: 'memory.filter.music' },
  { key: 'health', icon: 'all', labelKey: '健康' },
]

const MAP_MOOD_META: Record<MapMood, { icon: MemoryMoodIconName; label: string }> = {
  joy: { icon: 'joy', label: 'memory.mapMood.joy' },
  sad: { icon: 'sadness', label: 'memory.mapMood.sad' },
  anger: { icon: 'anger', label: 'memory.mapMood.anger' },
  tired: { icon: 'fatigue', label: 'memory.mapMood.tired' },
  music: { icon: 'music', label: 'memory.mapMood.music' },
}

function memoryMapMood(entry: MemoryEntry): MapMood {
  const text = `${entry.scene} ${entry.triggerText} ${entry.bodyThoughts}`.toLowerCase()
  if (/音樂|歌曲|歌單|耳機|旋律|music|song/.test(text)) return 'music'
  if (entry.anxietyLevel >= 7) return 'sad'
  if (entry.anxietyLevel >= 5) return 'anger'
  if (entry.anxietyLevel >= 3) return 'joy'
  return 'tired'
}

/** Build a content summary — prefers AI-generated summary field */
function memorySummary(m: { bodyThoughts: string; scene: string; triggerText: string; summary?: string }): string {
  // Prefer the AI-generated summary field
  if (m.summary && m.summary.trim()) return m.summary.trim();
  const raw = (m.bodyThoughts || m.scene || m.triggerText || '').replace(/\s+/g, ' ').trim()
  if (!raw) return '未命名記憶'
  return raw.length > 40 ? raw.slice(0, 40) + '…' : raw
}

/** Extract simple tags from memory text */
function memoryTags(m: { triggerText: string; bodyThoughts: string }): string[] {
  const combined = (m.triggerText + ' ' + m.bodyThoughts).toLowerCase()
  const tags: string[] = []
  const patterns: [RegExp, string][] = [
    [/工作|上班|加班|開會|老闆|同事/, '工作'],
    [/學校|上課|考試|老師|同學|作業/, '學校'],
    [/咖啡|茶|飲料|早餐|午餐|晚餐|吃/, '飲食'],
    [/夢|睡|醒|床|失眠|睏/, '睡眠'],
    [/哭|難過|傷心|憂鬱|焦慮|壓力/, '情緒'],
    [/開心|快樂|高興|幸福|喜歡|愛/, '快樂'],
    [/音樂|歌|曲|聽|耳機/, '音樂'],
    [/走路|散步|運動|跑步|健身/, '移動'],
    [/車|站|捷運|公車|火車/, '通勤'],
    [/雨|天氣|冷|熱|風/, '天氣'],
  ]
  for (const [re, tag] of patterns) {
    if (re.test(combined)) tags.push(tag)
  }
  return tags.slice(0, 3)
}

export function MemoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialView: View = searchParams.get('action') === 'new' ? 'form' : 'menu'
  const initialTabParam = searchParams.get('tab')
  const initialTab: MemoryTab = initialTabParam === 'diary' || initialTabParam === 'moonwindow' ? initialTabParam : 'memory'
  const [view, setView] = useState<View>(initialView)
  const [activeTab, setActiveTab] = useState<MemoryTab>(initialTab)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [emotionFilter, setEmotionFilter] = useState<EmotionFilter>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [healthImportOpen, setHealthImportOpen] = useState(false)
  const memoryEntries = useAppStore(s => s.memoryEntries)
  const healthRecords = useAppStore(s => s.healthRecords)
  const locations = useAppStore(s => s.locations)
  const deleteMemoryEntry = useAppStore(s => s.deleteMemoryEntry)

  const selectedEntry = useMemo(
    () => memoryEntries.find(e => e.id === selectedId) ?? null,
    [memoryEntries, selectedId],
  )

  const locationStats = useMemo(() => locations.map((location) => {
    const entries = memoryEntries.filter((entry) => (
      entry.location?.id === location.id
      || (!entry.location?.id && entry.location?.name === location.name)
    ))
    const moodCounts = entries.reduce<Record<MapMood, number>>((counts, entry) => {
      const mood = memoryMapMood(entry)
      counts[mood] += 1
      return counts
    }, { joy: 0, sad: 0, anger: 0, tired: 0, music: 0 })
    const primaryMood = (Object.entries(moodCounts) as [MapMood, number][])
      .sort((left, right) => right[1] - left[1])[0]?.[0] || 'tired'
    return { location, entries, count: entries.length, moodCounts, primaryMood }
  }), [locations, memoryEntries])

  const selectedLocationStats = useMemo(
    () => locationStats.find((item) => item.location.id === selectedLocationId) || null,
    [locationStats, selectedLocationId],
  )

  /* ── Filtered memories ── */
  const filteredMemories = useMemo(() => {
    let entries = memoryEntries
    if (emotionFilter === 'health') entries = entries.filter(e => e.cardType === 'health');
    else if (emotionFilter !== 'all') entries = entries.filter(e => memoryMapMood(e) === emotionFilter)
    if (selectedLocationId) entries = entries.filter((entry) => (
      entry.location?.id === selectedLocationId
      || (!entry.location?.id && entry.location?.name === selectedLocationStats?.location.name)
    ))
    return entries
  }, [memoryEntries, emotionFilter, selectedLocationId, selectedLocationStats])

  const handleOpenDetail = (id: string) => { setSelectedId(id); setView('detail') }
  const handleBackFromDetail = () => { setSelectedId(null); setView('menu') }
  const handleFormDone = () => {
    setSelectedLocationId(null)
    setSearchParams({}, { replace: true })
    setView('menu')
  }

  /* ═══════════════ MOON WINDOW TAB ═══════════════ */  const renderMoonWindow = () => {    const [previews, setPreviews] = useState<HtmlPreview[]>(() => loadPreviews());    const [adding, setAdding] = useState(false);    const [editingId, setEditingId] = useState<string | null>(null);    const [title, setTitle] = useState('');    const [htmlCode, setHtmlCode] = useState('');    const [previewId, setPreviewId] = useState<string | null>(null);    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);    const fileRef = useRef<HTMLInputElement>(null);    const handleAdd = () => {      if (!title.trim() || !htmlCode.trim()) return;      const now = Date.now();      const item: HtmlPreview = { id: crypto.randomUUID(), title: title.trim(), html: htmlCode, createdAt: now, updatedAt: now };      const updated = addPreview(item);      setPreviews(updated);      setTitle(''); setHtmlCode(''); setAdding(false);    };    const handleEdit = () => {      if (!editingId || !title.trim() || !htmlCode.trim()) return;      const updated = updatePreview(editingId, { title: title.trim(), html: htmlCode });      setPreviews(updated);      setEditingId(null); setTitle(''); setHtmlCode('');    };    const handleDelete = (id: string) => {      const updated = deletePreview(id);      setPreviews(updated);      setDeleteConfirm(null);      if (previewId === id) setPreviewId(null);    };    const startEdit = (p: HtmlPreview) => {      setEditingId(p.id); setTitle(p.title); setHtmlCode(p.html); setAdding(false); setPreviewId(null);    };    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {      const file = e.target.files?.[0];      if (!file) return;      const reader = new FileReader();      reader.onload = () => {        if (typeof reader.result === 'string') {          setTitle(file.name.replace(/\.html?$/, ''));          setHtmlCode(reader.result);          setAdding(true);        }        if (fileRef.current) fileRef.current.value = '';      };      reader.readAsText(file);    };    const isEditing = adding || editingId !== null;    return (      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>        {/* Header */}        <Card>          <div style={{ padding: '12px 0' }}>            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>月映窗</h3>            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>保存與預覽 HTML 小作品</p>          </div>        </Card>        {/* Add / Edit form */}        {isEditing ? (          <Card>            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>              <input                className="quick-sheet-input"                value={title}                onChange={e => setTitle(e.target.value)}                placeholder="標題"                style={{ fontSize: 14 }}              />              <textarea                className="quick-sheet-textarea"                value={htmlCode}                onChange={e => setHtmlCode(e.target.value)}                placeholder="貼上 HTML 程式碼…"                rows={6}                style={{ fontSize: 12, fontFamily: 'monospace' }}              />              <div style={{ display: 'flex', gap: 8 }}>                <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setEditingId(null); setTitle(''); setHtmlCode(''); }}>                  取消                </button>                <button type="button" className="btn-primary" onClick={editingId ? handleEdit : handleAdd}>                  {editingId ? '儲存' : '新增'}                </button>              </div>            </div>          </Card>        ) : (          <div style={{ display: 'flex', gap: 8 }}>            <button type="button" className="btn-primary" onClick={() => { setAdding(true); setTitle(''); setHtmlCode(''); }} style={{ flex: 1, fontSize: 13 }}>              + 新增 HTML            </button>            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 13 }}>              上傳 .html            </button>            <input ref={fileRef} type="file" accept=".html,.htm" style={{ display: 'none' }} onChange={handleFileImport} />          </div>        )}        {/* Preview modal */}        {previewId && (() => {          const p = previews.find(x => x.id === previewId);          if (!p) return null;          return (            <Card>              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</span>                <button type="button" onClick={() => setPreviewId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>              </div>              <iframe                srcDoc={p.html}                sandbox="allow-scripts"                style={{ width: '100%', height: 300, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}                title={p.title}              />            </Card>          );        })()}        {/* List */}        {previews.length === 0 && !isEditing ? (          <Card>            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 13 }}>              <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 1.5, margin: '0 auto 12px', opacity: 0.4 }}>                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />              </svg>              <p>還沒有收進月映窗的頁面。</p>            </div>          </Card>        ) : (          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>            {previews.map(p => (              <div key={p.id} style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>                <div style={{ flex: 1, minWidth: 0 }}>                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(p.createdAt).toLocaleDateString('zh-TW')}</div>                </div>                <button type="button" onClick={() => setPreviewId(p.id)}                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '3px 10px', fontSize: 11 }}>                  預覽                </button>                <button type="button" onClick={() => startEdit(p)}                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '3px 10px', fontSize: 11 }}>                  編輯                </button>                {deleteConfirm === p.id ? (                  <>                    <button type="button" onClick={() => handleDelete(p.id)}                      style={{ background: 'var(--danger)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '3px 8px', fontSize: 10 }}>確認</button>                    <button type="button" onClick={() => setDeleteConfirm(null)}                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '3px 8px', fontSize: 10 }}>取消</button>                  </>                ) : (                  <button type="button" onClick={() => setDeleteConfirm(p.id)}                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '3px 6px', fontSize: 11 }}>刪除</button>                )}              </div>            ))}          </div>        )}      </div>    );  };

  /* ═══════════════ CARD WALL ═══════════════ */
  const renderCardWall = () => (
    <Card>
      <div className="emotion-filter">
        {EMOTIONS.map(em => (
          <button
            key={em.key} type="button"
            className={`emotion-chip ${emotionFilter === em.key ? 'active' : ''}`}
            onClick={() => setEmotionFilter(em.key)}
          >
            <MoodIcon mood={em.icon} size={15} />
            <span>{t(em.labelKey)}</span>
          </button>
        ))}
        {selectedLocationStats && (
          <button type="button" className="emotion-chip active" onClick={() => setSelectedLocationId(null)} style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>{selectedLocationStats.location.name}</span>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {filteredMemories.length === 0 ? (
        <div className="memory-empty">
          <div className="memory-empty-icon">
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 40, height: 40, stroke: 'var(--text-3)', opacity: 0.25 }}>
              <path d="M21 10.5c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="memory-empty-text" style={{ fontWeight: 500, marginBottom: 4 }}>
            {selectedLocationStats ? `${selectedLocationStats.location.name} 還沒有記憶` : '還沒有記憶'}
          </div>
          <div className="memory-empty-sub">
            {selectedLocationStats ? '去這個地方記錄一些什麼吧' : '點擊右上角 + 新增第一段記憶'}
          </div>
        </div>
      ) : (
        <div className="memory-card-wall">
          {filteredMemories.map(m => {
            const date = new Date(m.createdAt)
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
            const loc = m.location?.name?.trim() || ''
            const locOrig = m.location?.rawName?.trim() || ''
            const tags = memoryTags(m)
            const healthRecord = m.healthRecordId
              ? healthRecords.find((record) => record.id === m.healthRecordId)
              : undefined
            return (
              <div key={m.id} className="memory-wall-card" onClick={() => handleOpenDetail(m.id)}>
                <button
                  type="button"
                  className="memory-wall-delete"
                  onClick={e => { e.stopPropagation(); setDeleteConfirmId(m.id) }}
                  aria-label="刪除記憶"
                  title="刪除"
                >×</button>
                <div className={`memory-wall-emoji ${m.cardType === 'health' ? 'health' : ''}`}>
                  {m.cardType === 'health'
                    ? <SleepLineIcon size={30} />
                    : <MoodIcon mood={MAP_MOOD_META[memoryMapMood(m)].icon} size={28} />}
                </div>
                {m.cardType === 'health' && <div className="memory-card-type-badge">{t('health.badge')}</div>}
                <div className="memory-wall-scene">{m.summary || m.scene || '未命名記憶'}</div>
                {m.summary && m.scene !== m.summary && (
                  <div className="memory-wall-summary" style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.7 }}>{m.scene}</div>
                )}
                {!m.summary && <div className="memory-wall-summary">{memorySummary(m)}</div>}
                {m.cardType === 'health' && healthRecord && (
                  <div className="sleep-card-metrics">
                    {healthRecord.sleepDurationMinutes !== undefined && (
                      <span>
                        <strong>{formatSleepDuration(healthRecord.sleepDurationMinutes)}</strong>
                        <small>{t('health.duration')}</small>
                      </span>
                    )}
                    {healthRecord.sleepStart && healthRecord.sleepEnd && (
                      <span>
                        <strong>{healthRecord.sleepStart}–{healthRecord.sleepEnd}</strong>
                        <small>{t('health.sleepWindow')}</small>
                      </span>
                    )}
                    {healthRecord.wakeCount !== undefined && (
                      <span>
                        <strong>{healthRecord.wakeCount}</strong>
                        <small>{t('health.wakeTimes')}</small>
                      </span>
                    )}
                  </div>
                )}
                {loc && (
                  <div className="memory-wall-location">
                    <span className="memory-wall-location-main">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                      {loc}
                    </span>
                    {locOrig && <span className="memory-wall-location-orig">{locOrig}</span>}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="memory-wall-tags">
                    {tags.map(t => <span key={t} className="memory-tag-pill">{t}</span>)}
                  </div>
                )}
                <div className="memory-wall-date">{dateStr}</div>
              </div>
            )
          })}
        </div>
      )}
      {/* Emotion Heatmap — monthly grid */}
      <EmotionHeatmap entries={memoryEntries} />
    </Card>
  )

  /* ═══════════════ MENU ═══════════════ */
  const renderMenu = () => (
    <>
      <div className="memory-tabs" role="tablist" aria-label={t('memory.tabsLabel')}>
        {(['memory', 'diary', 'moonwindow'] as const).map(tab => (
          <button
            key={tab} type="button" role="tab"
            aria-selected={activeTab === tab}
            className={`memory-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab)
              setSelectedLocationId(null)
              setSearchParams(tab === 'memory' ? {} : { tab }, { replace: true })
            }}
          >
            {tab === 'memory' ? t('memory.tabMemory') : tab === 'diary' ? t('memory.tabDiary') : '月映窗'}
          </button>
        ))}
        <button type="button" className="memory-tab memory-tab-add" onClick={() => setView('form')} aria-label="新增記憶">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          className="memory-tab memory-tab-health"
          onClick={() => setHealthImportOpen(true)}
          aria-label={t('health.importTitle')}
          title={t('health.importTitle')}
        >
          <SleepLineIcon size={17} />
        </button>
      </div>
      {/* Memory stats banner */}
      {activeTab === 'memory' && (() => {
        const stats = computeMemoryStats(memoryEntries);
        return (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
              padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12,
              display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontWeight: 500 }}>{formatStatsSummary(stats)}</span>
              {stats.dominantCategory && (
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 8,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                }}>
                  {stats.dominantCategory === 'dialogue' ? '對話' :
                   stats.dominantCategory === 'emotion' ? '情緒' :
                   stats.dominantCategory === 'reading' ? '閱讀' :
                   stats.dominantCategory === 'idea' ? '想法' :
                   stats.dominantCategory === 'achievement' ? '成就' : '系統'}
                </span>
              )}
            </div>
          </div>
        );
      })()}
      {activeTab === 'memory' && renderCardWall()}
      {activeTab === 'diary' && <Card><DiaryPanel /></Card>}
      {activeTab === 'moonwindow' && renderMoonWindow()}
    </>
  )

  return (
    <section id="memory-view" className="view">
      {view === 'menu' ? (
        <>
          <BackButton to="/" />
          <Header eyebrow={activeTab === 'memory' ? t('memory.headerArchive') : activeTab === 'diary' ? t('memory.headerTimeline') : t('memory.headerMap')} title={
            activeTab === 'memory' ? t('memory.tabMemory') : activeTab === 'diary' ? t('memory.tabDiary') : '月映窗'
          } />
          <LunaMessage page="memory" memoryCount={memoryEntries.length} emotion={emotionFilter} />
          {renderMenu()}
        </>
      ) : view === 'form' ? (
        <>
          <BackButton />
          <Header eyebrow="記憶存檔" title="今日心緒" />
          <Card><QuickJournalForm onDone={handleFormDone} /></Card>
        </>
      ) : view === 'detail' && selectedEntry ? (
        <>
          <BackButton />
          <Header eyebrow="記憶存檔" title="記憶詳情" />
          <Card><MemoryDetail entry={selectedEntry} onBack={handleBackFromDetail} /></Card>
        </>
      ) : null}

      {/* Delete confirmation — centered modal */}
      {deleteConfirmId && createPortal(
        <div
          className="confirm-sheet-overlay active"
          onClick={() => setDeleteConfirmId(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDeleteConfirmId(null); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-1)', borderRadius: 20,
              padding: '24px 20px 20px', maxWidth: 320, width: 'calc(100vw - 48px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>
                確定要刪除這條記憶嗎？
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                刪除後無法復原
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, fontSize: 14 }}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, fontSize: 14, background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => { deleteMemoryEntry(deleteConfirmId); setDeleteConfirmId(null); }}
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {healthImportOpen && <HealthImportSheet onClose={() => setHealthImportOpen(false)} />}
    </section>
  )
}

/* ── Emotion Heatmap ── */
function EmotionHeatmap({ entries }: { entries: { createdAt: number; anxietyLevel: number }[] }) {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  const today = now.getDate()
  const weekdays = ['日','一','二','三','四','五','六']

  // Build emotion map for this month
  const emotionMap: Record<number, { level: number; color: string }> = {}
  for (const e of entries) {
    const d = new Date(e.createdAt)
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      const day = d.getDate()
      const color = e.anxietyLevel >= 7 ? 'rgba(199,107,91,0.3)' : e.anxietyLevel >= 5 ? 'rgba(217,154,43,0.3)' : e.anxietyLevel >= 3 ? 'rgba(127,154,99,0.3)' : 'rgba(142,124,195,0.3)'
      emotionMap[day] = { level: e.anxietyLevel, color }
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 12, marginBottom: 4, letterSpacing: 1 }}>
        本月情緒熱力圖
      </div>
      <div className="emotion-heatmap">
        {weekdays.map(w => <div key={w} className="emotion-heatmap-header">{w}</div>)}
        {cells.map((d, i) => (
          <div
            key={i}
            className={`emotion-heatmap-day${d && emotionMap[d] ? ' has-memory' : ''}${d === today ? ' today' : ''}`}
            style={d && emotionMap[d] ? { background: emotionMap[d].color } : undefined}
          >
            {d || ''}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Luna Map Comment ── */
function LunaMapComment({ count, primaryMood }: { count: number; primaryMood: MapMood }) {
  let messageKey = 'memory.mapLunaQuiet'
  if (count > 0 && primaryMood === 'music') messageKey = 'memory.mapLunaMusic'
  else if (count > 0 && (primaryMood === 'sad' || primaryMood === 'anger')) messageKey = 'memory.mapLunaHeavy'
  else if (count > 0) messageKey = 'memory.mapLunaWarm'
  return (
    <div className="memory-location-luna">
      <SleepLineIcon size={18} />
      <span>{t(messageKey).replace(/^Luna[:：]\s*/, '')}</span>
    </div>
  )
}
