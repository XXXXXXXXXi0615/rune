import { useMemo, useState } from 'react';
import { resolveRunePresentationAsset } from '@/components/branding/runeBrandAssets';
import { useCheckInStore } from '@/features/tidewatch/checkInStore';
import { formatCheckInAgeZh } from './checkInPresentation';
import { CHECKIN_ACTIVITY_LABELS, CHECKIN_QUICK_OPTIONS, deriveRecentCustomActivities, isCheckInKnown } from '@/features/tidewatch/activityOptions';
import { GUIDE_STEP_LABELS, GUIDED_QUESTIONS, guidedQuestionOption, guidedStepLabel } from '@/features/tidewatch/guidedAnswer';
import type { CheckInActivity } from '@/features/tidewatch/types';
import { CheckInLikertScale } from './CheckInLikertScale';
import { RuneCheckInReaction } from './RuneCheckInReaction';
import './CheckInFloat.css';

interface CheckInFloatProps {
  mode: 'idle' | 'editing';
  onEdit: () => void;
  onIdle: () => void;
  dragHandleProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
}
export function CheckInFloat({ mode: presentationMode, onEdit, onIdle, dragHandleProps }: CheckInFloatProps) {
  const latest = useCheckInStore((state) => state.latest);
  const checkIns = useCheckInStore((state) => state.checkIns);
  const submitCheckIn = useCheckInStore((state) => state.submitCheckIn);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'preset' | 'custom'>(latest?.activity != null && !isCheckInKnown(String(latest.activity)) ? 'custom' : 'preset');
  const [activity, setActivity] = useState<CheckInActivity>(latest?.activity ?? 'working');
  const [customValue, setCustomValue] = useState(latest?.activity != null && !isCheckInKnown(String(latest.activity)) ? String(latest.activity) : '');
  const [mood, setMood] = useState<number | null>(latest?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(latest?.energy ?? null);
  const [focus, setFocus] = useState<number | null>(latest?.focus ?? null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const recentCustom = useMemo(() => deriveRecentCustomActivities(checkIns, 3), [checkIns]);
  const asset = resolveRunePresentationAsset('tidewatch-checkin-neutral');
  const expand = () => {
    if (latest) {
      const isCustom = !isCheckInKnown(String(latest.activity));
      setMode(isCustom ? 'custom' : 'preset');
      setActivity(latest.activity);
      setCustomValue(isCustom ? String(latest.activity) : '');
      setMood(latest.mood ?? null); setEnergy(latest.energy ?? null); setFocus(latest.focus ?? null);
      setNote(latest.note ?? '');
      setNoteOpen(Boolean(latest.note));
    }
    setStep(0);
    onEdit();
  };
  const submit = async () => {
    const effectiveActivity = mode === 'custom' ? customValue.trim() : activity;
    if (!effectiveActivity) return;
    if (mood == null || energy == null || focus == null) return;
    const trimmedNote = note.trim();
    await submitCheckIn({ activity: effectiveActivity, mood, energy, focus, ...(trimmedNote ? { note: trimmedNote } : {}) });
    onIdle();
  };
  const stepValue = step === 1 ? mood : step === 2 ? energy : step === 3 ? focus : null;
  const canContinue = step === 0 ? (mode === 'preset' || customValue.trim() !== '') : stepValue != null;
  const setScaleValue = (value: number) => { if (step === 1) setMood(value); else if (step === 2) setEnergy(value); else setFocus(value); };
  const questionIndex = step - 1;
  const selectedOption = stepValue != null ? guidedQuestionOption(questionIndex, stepValue) : null;
  const selectedQuickLabel = CHECKIN_QUICK_OPTIONS.find((item) => item.value === activity)?.label ?? CHECKIN_ACTIVITY_LABELS[activity] ?? activity;
  const activityReady = mode === 'preset' || customValue.trim() !== '';
  const semanticProgress = [
    mode === 'custom' ? (customValue.trim() || '—') : selectedQuickLabel,
    mood == null ? '—' : guidedQuestionOption(0, mood)?.label ?? '—',
    energy == null ? '—' : guidedQuestionOption(1, energy)?.label ?? '—',
    focus == null ? '—' : guidedQuestionOption(2, focus)?.label ?? '—',
  ] as const;
  const progressAnswered = [activityReady, mood != null, energy != null, focus != null] as const;
  const visualHeight = 'var(--checkin-rune-visible-height)';
  const visualWidthRatio = asset.visualBounds.width / asset.visualBounds.height;
  const canvasWidthRatio = asset.canvas.width / asset.visualBounds.height;
  const canvasHeightRatio = asset.canvas.height / asset.visualBounds.height;
  const visualOffsetXRatio = asset.visualBounds.x / asset.visualBounds.height;
  const visualOffsetYRatio = asset.visualBounds.y / asset.visualBounds.height;

  const collapsed = presentationMode === 'idle';
  return <aside className={`checkin-float${collapsed ? ' is-collapsed' : ' is-expanded'}`} data-testid="tidewatch-checkin-float" data-collapsed={String(collapsed)}>
    <span className="checkin-float__art" aria-hidden="true" data-testid="tidewatch-checkin-rune" style={{ width: `calc(${visualHeight} * ${visualWidthRatio})`, height: visualHeight } as React.CSSProperties}>
      <img src={asset.src} alt="" draggable={false} style={{ width: `calc(${visualHeight} * ${canvasWidthRatio})`, height: `calc(${visualHeight} * ${canvasHeightRatio})`, left: `calc(${visualHeight} * ${-visualOffsetXRatio})`, top: `calc(${visualHeight} * ${-visualOffsetYRatio})` }} />
    </span>
    {collapsed ? <>
      <button type="button" className="checkin-float__drag-handle checkin-float__drag-handle--pill" aria-label="拖動 Check-in 浮窗" {...dragHandleProps}><span aria-hidden="true" /></button>
      <button type="button" className="checkin-float__pill" onClick={expand} aria-label={latest ? `展開 Check-in，當前：${CHECKIN_ACTIVITY_LABELS[latest.activity] ?? latest.activity}，${formatCheckInAgeZh(latest.createdAt)}` : '展開 Check-in：尚未報備'}><span className="checkin-float__pill-text"><strong>{latest ? CHECKIN_ACTIVITY_LABELS[latest.activity] ?? latest.activity : '尚未報備'}</strong>{latest && <small>{formatCheckInAgeZh(latest.createdAt)}</small>}</span><span className="checkin-float__pill-chevron" aria-hidden="true">›</span></button>
    </> : <>
      <div className="checkin-float__header"><button type="button" className="checkin-float__drag-handle" aria-label="拖動 Check-in 浮窗" {...dragHandleProps}><span aria-hidden="true" />CHECK-IN</button><button type="button" className="checkin-float__collapse" onClick={onIdle} aria-label="收起 Check-in">—</button></div>
      <div className="checkin-float__form" data-testid="tidewatch-checkin-form">
        <div className="checkin-float__topline"><strong>狀態報備</strong><span>{guidedStepLabel(step)} {step + 1} / 4</span></div>
        <nav className="checkin-float__progress" aria-label="Check-in 回答摘要">{semanticProgress.map((value, index) => {
          const reachable = index <= step || progressAnswered[index];
          return <button key={GUIDE_STEP_LABELS[index]} type="button" className={`${index === step ? 'is-current' : ''}${progressAnswered[index] ? ' is-done' : ''}`} aria-current={index === step ? 'step' : undefined} disabled={!reachable} onClick={() => setStep(index)}><span>{GUIDE_STEP_LABELS[index]}</span><strong>· {value}</strong></button>;
        })}</nav>
        {step === 0 ? <><span className="checkin-float__ask">現在在做什麼？</span><div className="checkin-float__choices" role="radiogroup" aria-label="現在在做什麼？">{CHECKIN_QUICK_OPTIONS.map((item) => { const active = mode === 'preset' && activity === item.value; return <button key={item.value} type="button" role="radio" aria-checked={active} className={active ? 'is-active' : ''} onClick={() => { setMode('preset'); setActivity(item.value); }}>{item.label}<i className="checkin-float__tick" aria-hidden="true" /></button>; })}<button type="button" role="radio" aria-checked={mode === 'custom'} className={mode === 'custom' ? 'is-active' : ''} onClick={() => setMode('custom')}>自訂<i className="checkin-float__tick" aria-hidden="true" /></button></div>{mode === 'custom' && <div className="checkin-float__custom" data-testid="checkin-custom-area"><input className="checkin-float__custom-field" type="text" value={customValue} maxLength={24} placeholder="輸入目前活動" aria-label="自訂活動" onChange={(event) => setCustomValue(event.target.value)} />{recentCustom.length > 0 && <div className="checkin-float__recent" aria-label="最近的自訂活動">{recentCustom.map((value) => <button key={value} type="button" onClick={() => setCustomValue(value)}>{value}</button>)}</div>}</div>}
          {<div className="checkin-float__receipt" role="status" aria-live="polite"><span>已選擇</span><strong>{mode === 'custom' ? (customValue.trim() || '—') : selectedQuickLabel}</strong></div>}
        </> : <><div className="checkin-float__question"><span className="checkin-float__ask">{GUIDED_QUESTIONS[questionIndex].prompt}</span><RuneCheckInReaction mood={mood} /></div><CheckInLikertScale name={`checkin-${['mood', 'energy', 'focus'][questionIndex]}`} label={GUIDED_QUESTIONS[questionIndex].prompt} options={GUIDED_QUESTIONS[questionIndex].options} value={stepValue} onChange={setScaleValue} />
          {selectedOption && <div className="checkin-float__receipt" role="status" aria-live="polite"><span>已選擇</span><strong>{selectedOption.label} · {stepValue} / 5</strong><small>{selectedOption.descriptor}</small></div>}
          {step === 3 && <div className="checkin-float__note"><button type="button" className="checkin-float__note-toggle" onClick={() => setNoteOpen((value) => !value)} aria-expanded={noteOpen}>{noteOpen ? '收起補充說明' : '＋ 補充說明'}</button>{noteOpen && <input className="checkin-float__note-field" type="text" value={note} maxLength={120} placeholder="例如：在寫代碼，不太想被打斷" aria-label="補充說明" onChange={(event) => setNote(event.target.value)} />}</div>}
        </>}
        <div className="checkin-float__actions">{step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)}>上一題</button>}{step < 3 ? <button type="button" className="is-primary" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>下一題</button> : <button type="button" className="is-primary" onClick={submit} disabled={!canContinue}>送出報備</button>}</div>
      </div>
    </>}
  </aside>;
}
