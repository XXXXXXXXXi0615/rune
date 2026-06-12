import { useState, type FormEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MoonIcon, HollowCircleIcon, SparkleIcon, MoonWaveIcon, DroopMoonIcon, RippleAlertIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';

interface QuickMoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOODS = [
  { value: 0, icon: HollowCircleIcon, ariaKey: 'sheet.moodEmpty', color: 'var(--text-3)' },
  { value: 2, icon: SparkleIcon, ariaKey: 'sheet.moodJoyful', color: 'var(--amber)' },
  { value: 4, icon: MoonWaveIcon, ariaKey: 'sheet.moodCalm', color: 'var(--teal)' },
  { value: 6, icon: DroopMoonIcon, ariaKey: 'sheet.moodTired', color: '#a28fb8' },
  { value: 8, icon: RippleAlertIcon, ariaKey: 'sheet.moodAnxious', color: 'var(--danger)' },
];

export function QuickMoodSheet({ isOpen, onClose }: QuickMoodSheetProps) {
  const addMemoryEntry = useAppStore((s) => s.addMemoryEntry);
  const [scene, setScene] = useState('');
  const [bodyThoughts, setBodyThoughts] = useState('');
  const [locationName, setLocationName] = useState('');
  const [anxietyLevel, setAnxietyLevel] = useState(4);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = scene.trim();
    if (!trimmedTitle) { setError(t('sheet.titleError')); return; }
    addMemoryEntry({
      scene: trimmedTitle, triggerText: '', bodyThoughts: bodyThoughts.trim(),
      anxietyLevel, nextStep: '',
      ...(locationName.trim() ? { location: { name: locationName.trim() } } : {}),
    });
    setScene(''); setBodyThoughts(''); setLocationName(''); setAnxietyLevel(4); setError('');
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 600);
  };

  const handleBackdrop = () => {
    setScene(''); setBodyThoughts(''); setLocationName(''); setAnxietyLevel(4); setError(''); setSaved(false); onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`quick-sheet-overlay ${isOpen ? 'active' : ''}`} onClick={handleBackdrop}>
      <form className={`quick-sheet ${saved ? 'saved' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <div className="quick-sheet-head-icon"><MoonIcon size={20} /></div>
          <span className="quick-sheet-title">{t('sheet.newMood')}</span>
        </div>

        <div className="quick-sheet-body">
          <input className={`quick-sheet-input ${error ? 'has-error' : ''}`} type="text"
            placeholder={t('sheet.titlePlaceholder')} value={scene}
            onChange={(e) => { setScene(e.target.value); setError(''); }} autoFocus />
          {error && <span className="quick-sheet-error">{error}</span>}

          <textarea className="quick-sheet-textarea" placeholder={t('sheet.thoughtsPlaceholder')}
            value={bodyThoughts} onChange={(e) => setBodyThoughts(e.target.value)} rows={3} />

          <input className="quick-sheet-input" type="text" placeholder={t('sheet.locationPlaceholder')}
            value={locationName} onChange={(e) => setLocationName(e.target.value)} />

          <div className="quick-sheet-field">
            <span className="quick-sheet-label">{t('sheet.mood')}</span>
            <div className="mood-icons">
              {MOODS.map((m) => {
                const Icon = m.icon;
                const isActive = anxietyLevel === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    className={`mood-icon-btn ${isActive ? 'active' : ''}`}
                    style={{ '--mood-color': m.color } as React.CSSProperties}
                    onClick={() => setAnxietyLevel(m.value)}
                    aria-label={t(m.ariaKey)}
                    data-tooltip={t(m.ariaKey)}
                  >
                    <Icon size={22} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={handleBackdrop}>{t('sheet.cancel')}</button>
          <button type="submit" className="btn-primary">{saved ? t('sheet.saved') : t('sheet.save')}</button>
        </div>
      </form>
    </div>
  );
}
