import { useMemo } from 'react'
import { BackButton } from '@/components/layout/BackButton'
import { LifeRhythmCenter } from '@/components/memory/LifeRhythmCenter'
import { loadPeriodRecords } from '@/utils/periodStorage'
import { t } from '@/i18n'
import '@/styles/sleep.css'

export function LifeRhythmPage() {
  const language = useMemo(() => {
    try { return document.documentElement.lang || 'zh-TW' } catch { return 'zh-TW' }
  }, [])
  const isZh = language.startsWith('zh')

  const periodSummary = useMemo(() => {
    const records = loadPeriodRecords()
    if (records.length === 0) return '尚無週期記錄'
    const latestStart = [...records]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.startDate
    if (!latestStart) return '尚無週期記錄'
    const start = new Date(`${latestStart}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    return days >= 0 ? `距上次經期 ${days} 天` : '週期日期尚未到來'
  }, [])

  return (
    <section id="sleep-view" className="view">
      <header className="memory-page-header">
        <BackButton to="/" />
        <div className="memory-page-heading">
          <h1>{isZh ? '生活節奏中心' : 'Life Rhythm Center'}</h1>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <div className="sleep-page-container">
        <LifeRhythmCenter periodSummary={periodSummary} />
      </div>
    </section>
  )
}
