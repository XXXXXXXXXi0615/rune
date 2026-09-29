import { useState, useMemo, useEffect, useRef } from 'react'
import { BackButton } from '@/components/layout/BackButton'
import { loadPeriodRecords, savePeriodRecord, deletePeriodRecord, createPeriodRecord, PERIOD_MOODS, FLOW_LEVELS } from '@/utils/periodStorage'
import type { PeriodRecord, PeriodMood, PeriodUndoEntry } from '@/utils/periodStorage'
import { deleteTicketsForRecord } from '@/features/period/ticketStorage'
import { periodMoodToTodayMood, markTodayMoodTimestamp } from '@/utils/moodAvatarMap'
import { getPeriodMoodLabel, getCyclePhaseLabel, getFlowLevelLabel } from '@/features/period/periodLabels'
import { getCycleSnapshot, type CycleSnapshot, type TrendDay } from '@/features/period/getCycleSnapshot'
import { CYCLE_PHASE_COLOR } from '@/components/period/CycleTrendStrip'
import { CycleTrendStrip } from '@/components/period/CycleTrendStrip'
import { useAppStore } from '@/store/useAppStore'
import { simpleHash } from '@/utils/hash'
import { toLocalDateString } from '@/utils/date'
import { parseSymptomTags, mergeSymptomTags } from '@/features/period/symptomTagParser'
import { PeriodTicketEntry } from '@/components/period/PeriodTicketEntry'
import { PeriodTicketArchiveEntry } from '@/components/period/PeriodTicketArchiveEntry'
import { PeriodRecordSheet } from '@/components/period/PeriodRecordSheet'
import { getDailyTotal, useHydrationStore } from '@/store/useHydrationStore'
import { deriveWaterProgress } from '@/features/home/dailyRitualPresentation'
import '@/styles/period.css'
import '@/styles/period-bento.css'
import '@/styles/period-ticket-archive.css'

const CYCLE_LENGTH_DAYS = 28

function daysBetweenLocal(from: string, to: string): number {
  const s = new Date(`${from}T00:00:00`)
  const e = new Date(`${to}T00:00:00`)
  return Math.round((e.getTime() - s.getTime()) / 86400000)
}

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Find the period record that spans today (inclusive of start/end). */
function getTodayPeriodRecord(records: PeriodRecord[]): PeriodRecord | null {
  const t = todayDateString()
  return records.find(r => r.startDate <= t && r.endDate >= t) || null
}

/* ══════════════════════════════════════
   PASTEL ICON SET (18px, line, currentColor)
   ══════════════════════════════════════ */
const ICON = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function WaterIcon() {
  return <svg {...ICON}><path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z" /></svg>
}
function PenIcon() {
  return <svg {...ICON}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
}
function MoonIcon() {
  return <svg {...ICON}><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>
}
function HeartIcon() {
  return <svg {...ICON}><path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21l8.8-8.3a5 5 0 000-7.1z" /></svg>
}
function WalkIcon() {
  return <svg {...ICON}><circle cx="13" cy="4" r="1.6" /><path d="M13 8l-2 4 3 2 1 6M11 12l-3 2-2 3M14 14l3 1 2 3" /></svg>
}
function MoodIcon() {
  return <svg {...ICON}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 007 0" /><circle cx="9" cy="10" r="0.6" fill="currentColor" /><circle cx="15" cy="10" r="0.6" fill="currentColor" /></svg>
}
function SymptomIcon() {
  return <svg {...ICON}><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" opacity="0.55" /></svg>
}
function SleepIcon() {
  return <svg {...ICON}><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /><path d="M9 11h3l-2 2h3" /></svg>
}
function CheckIcon() {
  return <svg {...ICON}><polyline points="4 12 10 18 20 6" /></svg>
}
function TipIcon() {
  return <svg {...ICON}><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2v1h6v-1c0-.8.4-1.5 1-2A7 7 0 0012 2z" /></svg>
}
function SparkIcon() {
  return <svg {...ICON}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
}

/* ══════════════════════════════════════
   Mood illustration (tide-themed, pink-white palette)
   ══════════════════════════════════════ */
function MoodIllustration({ mood, size = 56 }: { mood: PeriodMood; size?: number }) {
  const info = PERIOD_MOODS.find(m => m.key === mood) ?? PERIOD_MOODS[0]
  const h = size
  return (
    <svg width={h} height={h} viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`pi-grad-${mood}`} cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor={info.color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={info.color} stopOpacity="0.06" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#pi-grad-${mood})`} stroke={info.color} strokeWidth="1.4" strokeOpacity="0.35" />
      {mood === 'calm' && (
        <>
          <path d="M10 28Q21 16 32 28T54 28" stroke={info.color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M14 38Q21 30 28 38T42 38" stroke={info.color} strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
        </>
      )}
      {mood === 'gentle' && (
        <>
          <circle cx="32" cy="32" r="13" fill={info.color} fillOpacity="0.18" />
          <circle cx="32" cy="32" r="6" fill={info.color} fillOpacity="0.4" />
          <circle cx="26" cy="22" r="2" fill={info.color} fillOpacity="0.3" />
          <circle cx="41" cy="24" r="1.5" fill={info.color} fillOpacity="0.25" />
          <circle cx="36" cy="44" r="2.5" fill={info.color} fillOpacity="0.2" />
        </>
      )}
      {mood === 'radiant' && (
        <>
          <circle cx="32" cy="32" r="12" fill={info.color} fillOpacity="0.25" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
            const rad = deg * Math.PI / 180
            return <line key={deg} x1={32 + 15 * Math.cos(rad)} y1={32 + 15 * Math.sin(rad)} x2={32 + 22 * Math.cos(rad)} y2={32 + 22 * Math.sin(rad)} stroke={info.color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.5" />
          })}
        </>
      )}
      {mood === 'turbulent' && (
        <>
          <path d="M8 22Q20 16 18 28T32 32T44 28T56 34" stroke={info.color} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M12 40Q22 36 28 42T44 40" stroke={info.color} strokeWidth="1.4" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
          <circle cx="22" cy="18" r="1.2" fill={info.color} fillOpacity="0.35" />
          <circle cx="44" cy="24" r="1" fill={info.color} fillOpacity="0.3" />
        </>
      )}
      {mood === 'stormy' && (
        <>
          <path d="M16 20Q30 12 28 24T44 22" stroke={info.color} strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M26 32L22 48" stroke={info.color} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.8" />
          <path d="M36 34L32 50" stroke={info.color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
          <circle cx="22" cy="18" r="1.5" fill={info.color} fillOpacity="0.4" />
          <circle cx="40" cy="20" r="1" fill={info.color} fillOpacity="0.3" />
        </>
      )}
    </svg>
  )
}

/* ══════════════════════════════════════
   PHASE → PASTEL TINT MAP (soft card fills)
   ══════════════════════════════════════ */
const PHASE_TINT: Record<string, string> = {
  menstruation: '#f8e1e8',
  follicular: '#e4f2ea',
  ovulation: '#fbf1d8',
  luteal: '#efe7f5',
  unknown: '#eee7df',
  'no-data': '#eee7df',
}

const PHASE_TIP: Record<string, { zh: string; en: string }> = {
  menstruation: { zh: '溫柔對待自己，多補鐵與熱飲，讓身體慢慢流過。', en: 'Be gentle. Iron-rich food and warm drinks help today.' },
  follicular: { zh: '能量回升，適合開始一件想做的小事。', en: 'Energy returns — a good day to start something small.' },
  ovulation: { zh: '排卵期，留意身體信號，外出記得防曬。', en: 'Fertile window — listen to your body and wear sunscreen.' },
  luteal: { zh: '黃體期，情緒與食慾可能波動，給自己多點空間。', en: 'Luteal phase — moods may shift. Give yourself room.' },
  unknown: { zh: '身體正在過渡，保持觀察與記錄。', en: 'Your body is in transition — keep observing.' },
  'no-data': { zh: '記錄第一次潮位，LUNARIS 會開始看見你的節律。', en: 'Log your first tide and LUNARIS will learn your rhythm.' },
}

/* ══════════════════════════════════════
   CYCLE PROGRESS RING (Hero right side)
   ══════════════════════════════════════ */
const GREEN = '#5db8a6'
const AMBER = '#e8a55a'

function CycleRing({ snap, isZh }: { snap: CycleSnapshot; isZh: boolean }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const progress = Math.min(1, Math.max(0.04, snap.progress ?? 0.06))
  const offset = circ * (1 - progress)
  const day = snap.cycleDay ?? '\u2014'
  const length = snap.cycleLength ?? '\u2014'
  const pct = Math.round(progress * 100)

  return (
    <div className="pb-cycle-ring">
      <svg viewBox="0 0 100 100" className="pb-cycle-ring-svg" aria-hidden="true">
        <defs>
          <linearGradient id="cr-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GREEN} />
            <stop offset="100%" stopColor={AMBER} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--hairline)" strokeWidth="4.5" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#cr-grad)" strokeWidth="4.5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          className="pb-cycle-ring-progress" />
      </svg>
      <div className="pb-cycle-ring-core">
        <strong className="pb-cycle-ring-day">{day}<span className="pb-cycle-ring-sep">/</span><span className="pb-cycle-ring-len">{length}</span></strong>
        <span className="pb-cycle-ring-pct">{isZh ? '天' : 'd'} · {pct}%</span>
      </div>
      {snap.predictedDaysRemaining != null && snap.status !== 'unknown' && (
        <span className="pb-cycle-ring-pred">
          {snap.confidence === 'low'
            ? (isZh ? '依目前記錄推估' : 'Based on records')
            : (isZh ? `距下次週期約 ${snap.predictedDaysRemaining} 天` : `~${snap.predictedDaysRemaining}d to next`)}
        </span>
      )}
      {snap.confidence === 'low' && (
        <span className="pb-cycle-ring-est">{isZh ? '資料較少，僅供參考' : 'Limited data, for reference only'}</span>
      )}
    </div>
  )
}

/* ═══════════════════════════════���══════
   PHASE WEEK GRID (segmented alternative view)
   ══════════════════════════════════════ */
function PhaseWeekGrid({ snapshot }: { snapshot: CycleSnapshot }) {
  const todayStr = toLocalDateString(new Date())
  if (!snapshot.trend.length) {
    return <div className="pb-week-empty">持續記錄後，這裡會出現你的週格視圖</div>
  }
  return (
    <div className="pb-week-grid" role="img" aria-label="28 天週期週格視圖">
      {snapshot.trend.map((d: TrendDay) => {
        const color = CYCLE_PHASE_COLOR[d.phase] || '#888'
        const isToday = d.date === todayStr
        return (
          <div
            key={d.date}
            className={`pb-week-cell${isToday ? ' is-today' : ''}`}
            style={{ '--cell': color } as React.CSSProperties}
            title={`${d.date} · ${getCyclePhaseLabel(d.phase)}${d.mood ? ' · ' + getPeriodMoodLabel(d.mood) : ''}`}
          >
            <span className="pb-week-day">{Number(d.date.slice(8))}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   RECENT RECORD ROW
   ══════════════════════════════════════ */
function RecentRow({ rec, onEdit, isZh }: { rec: PeriodRecord; onEdit: () => void; isZh: boolean }) {
  const phaseLabel = getCyclePhaseLabel(rec.flowLevel ? 'menstruation' : undefined)
  void phaseLabel
  return (
    <li className="pb-recent-row">
      <button type="button" className="pb-recent-main" onClick={onEdit} aria-label={isZh ? '編輯記錄' : 'Edit record'}>
        <span className="pb-recent-date">{rec.startDate}{rec.endDate !== rec.startDate ? ` − ${rec.endDate}` : ''}</span>
        <span className="pb-recent-tags">
          {rec.mood && <span className="pb-chip pb-chip--mood">{getPeriodMoodLabel(rec.mood)}</span>}
          {rec.flowLevel && <span className="pb-chip pb-chip--flow">{getFlowLevelLabel(rec.flowLevel)}</span>}
          {rec.symptoms.length > 0 && <span className="pb-chip">{rec.symptoms.length} 項症狀</span>}
          {rec.symptoms.length === 0 && !rec.mood && !rec.flowLevel && <span className="pb-chip pb-chip--empty">僅記錄</span>}
        </span>
      </button>
      <span className="pb-recent-actions">
        <button type="button" className="pb-recent-btn" onClick={onEdit} aria-label={isZh ? '編輯' : 'Edit'}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </span>
    </li>
  )
}

/* ══════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════ */
export function PeriodPage() {
  const language = useMemo(() => {
    try { return document.documentElement.lang || 'zh-TW' } catch { return 'zh-TW' }
  }, [])
  const isZh = language.startsWith('zh')

  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>(() => loadPeriodRecords())
  const [editingPeriod, setEditingPeriod] = useState<PeriodRecord | null>(null)
  const [periodFormStart, setPeriodFormStart] = useState('')
  const [periodFormEnd, setPeriodFormEnd] = useState('')
  const [periodFormSymptoms, setPeriodFormSymptoms] = useState<string[]>([])
  const [periodFormNotes, setPeriodFormNotes] = useState('')

  const [periodFormMood, setPeriodFormMood] = useState<PeriodMood | undefined>(undefined)
  const [periodFormFlow, setPeriodFormFlow] = useState('')
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [cycleView, setCycleView] = useState<'trend' | 'week'>('trend')
  const [hydrationUndo, setHydrationUndo] = useState<{ entryId: string; timer: ReturnType<typeof setTimeout> } | null>(null)

  const setTodayMood = useAppStore(s => s.setTodayMood)
  const sleepReceipts = useAppStore(s => s.sleepReceipts)
  const addMoonDewEntry = useAppStore(s => s.addMoonDewEntry)
  const hydrationEntries = useHydrationStore(s => s.entries)
  const hydrationSettings = useHydrationStore(s => s.settings)
  const addHydrationEntry = useHydrationStore(s => s.addEntry)
  const removeHydrationEntry = useHydrationStore(s => s.removeEntry)

  const TODAY = todayDateString()
  const [completedActions, setCompletedActions] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`lunartide_period_actions_${TODAY}`)
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch { return new Set<string>() }
  })
  const [dewFlash, setDewFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!deleteConfirmId) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDeleteConfirmId(null) }
    const onClick = () => setDeleteConfirmId(null)
    window.addEventListener('keydown', onEsc)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('click', onClick)
    }
  }, [deleteConfirmId])

  const handleDeletePeriod = (id: string) => {
    deleteTicketsForRecord(id)
    deletePeriodRecord(id)
    setPeriodRecords(loadPeriodRecords())
    setDeleteConfirmId(null)
    window.dispatchEvent(new CustomEvent('period-records-updated'))
  }

  const resetPeriodForm = () => {
    setEditingPeriod(null); setPeriodFormStart(''); setPeriodFormEnd('')
    setPeriodFormSymptoms([]); setPeriodFormNotes(''); setPeriodFormMood(undefined)
    setPeriodFormFlow(''); setShowPeriodModal(false)
  }

  // Phase 3A.1: bento cards open the shared PeriodRecordSheet composer only
  const openModalWithSection = (section: string, triggerEl?: HTMLElement) => {
    void section; void triggerEl
    const rec = getTodayPeriodRecord(periodRecords)
    if (rec) editPeriod(rec)
    else startNewPeriod()
  }

  const startNewPeriod = () => {
    const t = new Date()
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    setPeriodFormStart(todayStr); setPeriodFormEnd(todayStr)
    setEditingPeriod(null)
    setShowPeriodModal(true)
  }

  const editPeriod = (rec: PeriodRecord) => {
    setEditingPeriod(rec)
    setPeriodFormStart(rec.startDate); setPeriodFormEnd(rec.endDate)
    setShowPeriodModal(true)
  }

  const handleCloseModal = () => {
    resetPeriodForm()
  }

  const openTodayLog = () => {
    const rec = getTodayPeriodRecord(periodRecords)
    if (rec) editPeriod(rec)
    else startNewPeriod()
  }

  const snapshot = useMemo(() => getCycleSnapshot(), [periodRecords])
  const todayRecord = useMemo(() => getTodayPeriodRecord(periodRecords), [periodRecords])
  const latestSleep = useMemo(() => (
    sleepReceipts && sleepReceipts.length > 0
      ? [...sleepReceipts].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
      : null
  ), [sleepReceipts])

  const formatSleepDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60); const m = minutes % 60
    return isZh ? `${h} 小時 ${m} 分` : `${h}h ${m}m`
  }
  const sleepScoreLabel = (score?: number | null) => {
    if (score == null) return '—'
    if (score >= 90) return isZh ? '優質' : 'Great'
    if (score >= 75) return isZh ? '良好' : 'Good'
    if (score >= 60) return isZh ? '普通' : 'Fair'
    return isZh ? '需改善' : 'Poor'
  }

  const actions = useMemo(() => {
    const active: Array<{ id: string; label: string; sub: string; icon: React.ReactNode; dew: boolean; onAction?: () => void }> = [
      { id: 'hydrate', label: isZh ? '補水一杯' : 'Hydrate', sub: isZh ? '＋250 ml' : '+250 ml', icon: <WaterIcon />, dew: true, onAction: () => addHydrationEntry(250) },
      { id: 'log', label: isZh ? '記錄今日潮位' : 'Log today', sub: isZh ? '心情 · 症狀' : 'mood · symptoms', icon: <PenIcon />, dew: true, onAction: openTodayLog },
    ]
    if (snapshot.status === 'menstruation') {
      active.push({ id: 'rest', label: isZh ? '提早休息' : 'Early rest', sub: isZh ? '體貼身體' : 'be kind', icon: <SleepIcon />, dew: true })
      active.push({ id: 'warm', label: isZh ? '溫熱敷' : 'Warm compress', sub: isZh ? '緩解不適' : 'relief', icon: <HeartIcon />, dew: true })
    }
    active.push({ id: 'move', label: isZh ? '溫和散步' : 'Gentle walk', sub: isZh ? '10 分鐘' : '10 min', icon: <WalkIcon />, dew: true })
    return active
  }, [snapshot.status, isZh, addHydrationEntry]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAction = (id: string) => {
    addMoonDewEntry({
      idempotencyKey: `period_action_${id}_${TODAY}`,
      source: 'quest',
      amount: 1,
      reasonCode: 'period:action',
      title: isZh ? '今日行動完成' : 'Today action done',
    }) && setDewFlash(id)
    window.setTimeout(() => setDewFlash(prev => prev === id ? null : prev), 1600)
  }

  const toggleCompleted = (action: { id: string; dew?: boolean; onAction?: () => void }) => {
    const done = completedActions.has(action.id)
    setCompletedActions((current) => {
      const next = new Set(current)
      if (done) next.delete(action.id)
      else next.add(action.id)
      try { localStorage.setItem(`lunartide_period_actions_${TODAY}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
    if (!done) {
      action.onAction?.()
      if (action.dew) toggleAction(action.id)
    }
  }

  const quickAddWater = () => {
    addHydrationEntry(250)
    const entry = useHydrationStore.getState().entries.at(-1)?.id
    if (entry) {
      if (hydrationUndo) clearTimeout(hydrationUndo.timer)
      setHydrationUndo({ entryId: entry, timer: setTimeout(() => setHydrationUndo(null), 5000) })
    }
  }

  const hydrationToday = useMemo(() => getDailyTotal(hydrationEntries, TODAY), [hydrationEntries, TODAY])
  const hydrationGoal = hydrationSettings?.dailyGoalMl ?? 2000
  const pct = deriveWaterProgress(hydrationToday, hydrationGoal)
  const phaseColor = CYCLE_PHASE_COLOR[snapshot.status] ?? CYCLE_PHASE_COLOR.unknown
  const phaseTint = PHASE_TINT[snapshot.status] ?? PHASE_TINT.unknown
  const phaseTip = PHASE_TIP[snapshot.status] ?? PHASE_TIP['no-data']
  const todayLabel = new Date().toLocaleDateString(isZh ? 'zh-TW' : 'en', { month: 'long', day: 'numeric' })

  return (
    <section id="period-view" className="view">
      <header className="pb-header">
        <div className="pb-header-heading">
          <h1>{isZh ? '生理週期' : 'Period'}</h1>
          <p>{isZh ? '身體的潮汐，溫柔地記錄' : "Your body's tides, gently tracked"}</p>
        </div>
        <span className="pb-header-spacer" aria-hidden="true" />
      </header>

      <div className="period-bento" data-clawd-anchor="period-bento">
        {periodRecords.length === 0 ? (
          <article className="pb-card pb-hero pb-hero--empty" style={{ '--phase': '#c64545' } as React.CSSProperties}>
            <div className="pb-hero-glow" />
            <div className="pb-hero-main">
              <span className="pb-eyebrow">{`TODAY · ${todayLabel}`}</span>
              <div className="pb-hero-phase">{isZh ? '準備開始' : 'Getting started'}</div>
              <div className="pb-hero-day">{isZh ? '尚未有週期記錄' : 'No cycle logged yet'}</div>
            </div>
            <span className="pb-hero-tip-capsule"><TipIcon /><span>{isZh ? phaseTip.zh : phaseTip.en}</span></span>
            <button type="button" className="pb-cta" onClick={startNewPeriod}>{isZh ? '記錄第一次潮位' : 'Log your first tide'}</button>
          </article>
        ) : (
          <article className="pb-card pb-hero" style={{ '--phase': phaseColor, '--phase-tint': phaseTint } as React.CSSProperties} data-pet-safe-zone>
            <div className="pb-hero-glow" />
            <div className="pb-hero-body">
              <div className="pb-hero-main">
                <span className="pb-eyebrow">{`TODAY · ${todayLabel}`}</span>
                <div className="pb-hero-phase">{getCyclePhaseLabel(snapshot.status)}</div>
                <div className="pb-hero-day">{isZh ? `第 ${snapshot.cycleDay ?? '—'} 天` : `Day ${snapshot.cycleDay ?? '—'}`}<span className="pb-hero-sep">/</span>{snapshot.cycleLength ?? '—'} {isZh ? '天' : 'd'}</div>
                {snapshot.periodDay != null && snapshot.periodDay > 0 && (
                  <div className="pb-hero-sub">{isZh ? `經期第 ${snapshot.periodDay} 天` : `Period day ${snapshot.periodDay}`}</div>
                )}
                {snapshot.predictedDaysRemaining != null && (
                  <div className="pb-hero-sub pb-hero-sub--muted">
                    {snapshot.confidence === 'low'
                      ? (isZh ? '依目前記錄推估' : 'Based on records')
                      : (isZh ? `距下次週期約 ${snapshot.predictedDaysRemaining} 天` : `≈ ${snapshot.predictedDaysRemaining} days to next cycle`)}
                  </div>
                )}
              </div>
              <div className="pb-hero-right">
                <CycleRing snap={snapshot} isZh={isZh} />
                <button type="button" className="pb-cta pb-cta--hero" onClick={openTodayLog}><PenIcon /><span>{isZh ? '記錄今天' : 'Log today'}</span></button>
              </div>
            </div>
            <span className="pb-hero-tip-capsule"><TipIcon /><span>{isZh ? phaseTip.zh : phaseTip.en}</span></span>
          </article>
        )}

        {todayRecord && (
          <PeriodTicketEntry
            record={todayRecord}
            phaseLabel={getCyclePhaseLabel(snapshot.status)}
            cycleDay={snapshot.cycleDay ?? undefined}
            variant="hero"
          />
        )}

        <PeriodTicketArchiveEntry />

        <div className="pb-quad" data-pet-safe-zone>
          <button type="button" className="pb-mini" style={{ '--mini-tint': PHASE_TINT.unknown, '--mini-accent': (todayRecord?.mood && PERIOD_MOODS.find(m => m.key === todayRecord.mood)?.color) || '#c64545' } as React.CSSProperties}
            data-card-id="mood" onClick={(e) => openModalWithSection('mood', e.currentTarget)} aria-label={isZh ? '開啟心情記錄' : 'Open mood log'}>
            <span className="pb-mini-icon"><MoodIcon /></span>
            <span className="pb-mini-label">{isZh ? '心情' : 'Mood'}</span>
            {todayRecord?.mood
              ? <span className="pb-mini-value">{getPeriodMoodLabel(todayRecord.mood)}</span>
              : <span className="pb-mini-empty-text">{isZh ? '今天的情緒還沒有被命名' : "Your mood hasn't been named today"}</span>}
          </button>

          <button type="button" className="pb-mini" style={{ '--mini-tint': PHASE_TINT.unknown, '--mini-accent': '#a28fb8' } as React.CSSProperties}
            data-card-id="symptoms" onClick={(e) => openModalWithSection('symptoms', e.currentTarget)} aria-label={isZh ? '開啟症狀記錄' : 'Open symptoms log'}>
            <span className="pb-mini-icon"><SymptomIcon /></span>
            <span className="pb-mini-label">{isZh ? '症狀' : 'Symptoms'}</span>
            {(todayRecord?.symptomTags && todayRecord.symptomTags.length > 0) || (todayRecord && todayRecord.symptoms.length > 0) ? (
              <div className="pb-mini-symptoms">
                {((todayRecord.symptomTags && todayRecord.symptomTags.length > 0) ? todayRecord.symptomTags : todayRecord.symptoms).slice(0, 3).map((s: string) => <span key={s} className="pb-symptom-tag">{s}</span>)}
                {((todayRecord.symptomTags && todayRecord.symptomTags.length > 0) ? todayRecord.symptomTags : todayRecord.symptoms).length > 3 && <span className="pb-symptom-tag">+{((todayRecord.symptomTags && todayRecord.symptomTags.length > 0) ? todayRecord.symptomTags : todayRecord.symptoms).length - 3}</span>}
              </div>
            ) : <span className="pb-mini-empty-text">{isZh ? '今天還沒留下身體訊號' : 'No body signals logged today'}</span>}
          </button>

          <div className="pb-mini pb-mini--water" style={{ '--mini-tint': PHASE_TINT.follicular, '--mini-accent': '#5db8a6' } as React.CSSProperties}
            data-card-id="water" role="button" tabIndex={0}
            onClick={(e) => { if (!(e.target as HTMLElement).closest('.pb-water-quick-add')) openModalWithSection('water', e.currentTarget) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if ((e.target as HTMLElement).closest('.pb-water-quick-add')) return; openModalWithSection('water', e.currentTarget) } }}
            aria-label={isZh ? '開啟飲水記錄' : 'Open hydration log'}>
            <span className="pb-mini-icon"><WaterIcon /></span>
            <span className="pb-mini-label">{isZh ? '飲水' : 'Water'}</span>
            {hydrationToday > 0 ? (
              <>
                <span className="pb-mini-value">{hydrationToday}<small style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>{' / '}{hydrationGoal} ml</small></span>
                <div className="pb-water-bar-wrap"><div className="pb-water-bar-outer"><div className="pb-water-bar-inner" style={{ width: `${pct}%` }} /></div></div>
              </>
            ) : <span className="pb-mini-empty-text">{isZh ? '今天的第一口水還沒記下' : 'First sip not logged yet today'}</span>}
            <button type="button" className="pb-water-quick-add"
              onClick={(e) => { e.stopPropagation(); quickAddWater() }}
              aria-label={isZh ? '快速補水250毫升' : 'Quick add 250ml'}>
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>250 ml</span>
            </button>
          </div>

          <button type="button" className="pb-mini" style={{ '--mini-tint': PHASE_TINT.luteal, '--mini-accent': '#a28fb8' } as React.CSSProperties}
            data-card-id="sleep" onClick={(e) => openModalWithSection('sleep', e.currentTarget)} aria-label={isZh ? '開啟睡眠記錄' : 'Open sleep log'}>
            <span className="pb-mini-icon"><SleepIcon /></span>
            <span className="pb-mini-label">{isZh ? '睡眠' : 'Sleep'}</span>
            {latestSleep ? (
              <>
                <span className="pb-mini-value">{formatSleepDuration(Number(latestSleep.totalSleep ?? 0))}</span>
                <div className="pb-mini-sleep-detail">
                  <div className="pb-sleep-meta">
                    {latestSleep.sleepScore != null && <span className="pb-sleep-quality">{sleepScoreLabel(Number(latestSleep.sleepScore))} · {String(latestSleep.sleepScore)}{isZh ? ' 分' : ''}</span>}
                  </div>
                </div>
              </>
            ) : <span className="pb-mini-empty-text">{isZh ? '昨晚的睡眠還沒補上' : "Last night's sleep not logged yet"}</span>}
          </button>
        </div>

        <article className="pb-card pb-actions">
          <div className="pb-card-head">
            <div><span className="pb-eyebrow">TODAY</span><h3>{isZh ? '今日行動' : 'Today\u2019s actions'}</h3></div>
            <span className="pb-dew-balance"><SparkIcon />{useAppStore.getState().getMoonDewBalance()}</span>
          </div>
          <ul className="pb-action-list">
            {actions.map((action) => {
              const done = completedActions.has(action.id)
              const flash = dewFlash === action.id
              return (
                <li key={action.id} className={`pb-action${done ? ' is-done' : ''}${flash ? ' is-flash' : ''}`}>
                  <button type="button" className="pb-action-check" onClick={() => toggleCompleted(action)} aria-pressed={done} aria-label={action.label} style={{ '--check': phaseColor } as React.CSSProperties}>
                    {done ? <CheckIcon /> : action.icon}
                  </button>
                  <span className="pb-action-label">{action.label}</span>
                  <span className="pb-action-sub">{action.sub}</span>
                  {done && action.dew && <span className="pb-action-dew">{isZh ? '+1 月印' : '+1 Moon Seal'}</span>}
                </li>
              )
            })}
          </ul>
        </article>

        <article className="pb-card pb-cycle">
          <div className="pb-card-head">
            <div><span className="pb-eyebrow">CYCLE</span><h3>{isZh ? '週期視覺化' : 'Cycle view'}</h3></div>
            <div className="pb-seg" role="tablist" aria-label={isZh ? '視覺化切換' : 'Visualization'}>
              <button type="button" role="tab" aria-selected={cycleView === 'trend'} className={cycleView === 'trend' ? 'active' : ''} onClick={() => setCycleView('trend')}>{isZh ? '趨勢' : 'Trend'}</button>
              <button type="button" role="tab" aria-selected={cycleView === 'week'} className={cycleView === 'week' ? 'active' : ''} onClick={() => setCycleView('week')}>{isZh ? '週格' : 'Week'}</button>
            </div>
          </div>
          {cycleView === 'trend'
            ? <CycleTrendStrip snapshot={snapshot} variant="full" interactive showLegend />
            : <PhaseWeekGrid snapshot={snapshot} />}
        </article>
      </div>

      <PeriodRecordSheet
        open={showPeriodModal}
        date={periodFormStart || TODAY}
        record={editingPeriod}
        onClose={handleCloseModal}
        onChanged={setPeriodRecords}
      />

      {hydrationUndo && (
        <div className="period-undo-toast" role="alert">
          <span>{isZh ? '已補水 250 ml' : '+250 ml added'}</span>
          <button type="button" onClick={() => {
            if (hydrationUndo) {
              removeHydrationEntry(hydrationUndo.entryId)
              clearTimeout(hydrationUndo.timer)
              setHydrationUndo(null)
            }
          }}>{isZh ? '撤銷' : 'Undo'}</button>
        </div>
      )}
    </section>
  )
}
