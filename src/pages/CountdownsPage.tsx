// ================================================================
// CountdownsPage — full TIDECOUNT list with filter + create/edit
// ================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCountdownStore } from '@/features/countdown/useCountdownStore';
import { type CountdownEvent } from '@/features/countdown/countdownEngine';
import { CountdownEditorSheet } from '@/components/countdown/CountdownEditorSheet';
import { CountdownSection, COUNTDOWN_FILTERS, type CountdownFilter } from '@/components/countdown/CountdownSection';
import { BackButton } from '@/components/layout/BackButton';
import { toLocalDateString } from '@/utils/date';

export function CountdownsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CountdownFilter>('all');
  const [editing, setEditing] = useState<CountdownEvent | null | 'new'>(null);

  const handleCreate = () => setEditing('new');
  const handleEdit = (event: CountdownEvent) => setEditing(event);
  const handleClose = () => setEditing(null);

  return (
    <section id="countdowns-view" className="view countdown-view" data-clawd-anchor="countdowns">
      <header className="countdown-view-header">
        <BackButton to="/calendar?tab=timekeeper" />
        <div className="countdown-view-title-block">
          <p className="countdown-view-eyebrow">TIDECOUNT</p>
          <h1>倒數日</h1>
          <p>把日子、紀念日、重要時刻釘在月潮上。</p>
        </div>
        <button type="button" className="countdown-view-add-btn" onClick={handleCreate}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>新建</span>
        </button>
      </header>

      <div className="countdown-view-chips" role="tablist" aria-label="倒數過濾">
        {COUNTDOWN_FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            role="tab"
            aria-selected={filter === chip.value}
            className={`countdown-view-chip${filter === chip.value ? ' active' : ''}`}
            onClick={() => setFilter(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <CountdownSection
        filter={filter}
        onCreate={handleCreate}
        onEdit={handleEdit}
        emptyHint="把生日、紀念日、續訂或重要日子放進這裡。"
      />

      {editing !== null && (
        <CountdownEditorSheet
          event={editing === 'new' ? null : editing}
          defaultDate={toLocalDateString()}
          onClose={handleClose}
        />
      )}
    </section>
  );
}
