import { useMemo, useState, type CSSProperties } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import { createLocationPosition } from '@/utils/memoryLocations';
import { LocationIcon } from '@/components/icons/LocationIcon';

const PRESET_ICONS = ['pin', 'home', 'briefcase', 'school', 'rainyCafe', 'bufferStation', 'insomniaStreet', 'sleep', 'star', 'musicNote'] as const;
const PRESET_COLORS = ['#d48ba5', '#cc785c', '#8eb8a0', '#c295d8', '#d4a050', '#6ba3a3'];

interface QuickJournalFormProps {
  onDone: () => void;
}

export function QuickJournalForm({ onDone }: QuickJournalFormProps) {
  const addMemoryEntry = useAppStore((state) => state.addMemoryEntry);
  const addLocation = useAppStore((state) => state.addLocation);
  const locations = useAppStore((state) => state.locations);

  const [scene, setScene] = useState('');
  const [triggerText, setTriggerText] = useState('');
  const [bodyThoughts, setBodyThoughts] = useState('');
  const [anxietyLevel, setAnxietyLevel] = useState(5);
  const [nextStep, setNextStep] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [rawLocationName, setRawLocationName] = useState('');
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationIcon, setNewLocationIcon] = useState('pin');
  const [newLocationColor, setNewLocationColor] = useState(PRESET_COLORS[0]);
  const [newLocationDescription, setNewLocationDescription] = useState('');
  const [locationError, setLocationError] = useState('');

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId),
    [locations, selectedLocationId],
  );
  const canSave = Boolean(scene.trim() || bodyThoughts.trim());

  const handleSave = () => {
    if (!canSave) return;

    let locationId = selectedLocation?.id;
    let locationName = selectedLocation?.name;
    if (showNewLocation) {
      const name = newLocationName.trim();
      if (!name) {
        setLocationError(t('memory.locationNameRequired'));
        return;
      }
      const existing = locations.find((location) => location.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        locationId = existing.id;
        locationName = existing.name;
      } else {
        const position = createLocationPosition(name, locations.length);
        locationId = addLocation({
          name,
          icon: newLocationIcon,
          color: newLocationColor,
          description: newLocationDescription.trim(),
          ...position,
        });
        locationName = name;
      }
    }

    addMemoryEntry({
      scene: scene.trim(),
      triggerText: triggerText.trim(),
      bodyThoughts: bodyThoughts.trim(),
      anxietyLevel,
      nextStep: nextStep.trim(),
      location: locationId && locationName
        ? {
            id: locationId,
            name: locationName,
            rawName: rawLocationName.trim() || undefined,
          }
        : undefined,
    });
    onDone();
  };

  return (
    <div className="journal-form">
      <div className="journal-field">
        <label htmlFor="memory-scene">{t('memory.sceneLabel')}</label>
        <input
          id="memory-scene"
          type="text"
          value={scene}
          onChange={(event) => setScene(event.target.value)}
          placeholder={t('memory.scenePlaceholder')}
        />
      </div>

      <div className="journal-field">
        <label>{t('memory.chooseLocation')}</label>
        <div className="location-chip-row">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              className={`location-chip ${selectedLocationId === location.id && !showNewLocation ? 'active' : ''}`}
              style={{ '--location-color': location.color } as CSSProperties}
              onClick={() => {
                setSelectedLocationId(location.id);
                setShowNewLocation(false);
                setLocationError('');
              }}
            >
              <LocationIcon iconType={location.icon} size={16} />
              <span>{location.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="location-new-btn"
          onClick={() => {
            setShowNewLocation((current) => !current);
            setLocationError('');
          }}
        >
          {showNewLocation ? t('memory.cancelNewLocation') : t('memory.addLocation')}
        </button>
      </div>

      {showNewLocation && (
        <div className="location-creator">
          <div className="journal-field">
            <label htmlFor="memory-new-location">{t('memory.locationName')}</label>
            <input
              id="memory-new-location"
              type="text"
              value={newLocationName}
              onChange={(event) => {
                setNewLocationName(event.target.value);
                setLocationError('');
              }}
              placeholder={t('memory.locationNamePlaceholder')}
            />
            {locationError && <div className="journal-inline-error">{locationError}</div>}
          </div>

          <div className="journal-field">
            <label>{t('memory.locationIcon')}</label>
            <div className="location-option-row">
              {PRESET_ICONS.map((iconType) => (
                <button
                  key={iconType}
                  type="button"
                  className={`location-icon-option ${newLocationIcon === iconType ? 'active' : ''}`}
                  onClick={() => setNewLocationIcon(iconType)}
                  aria-label={`${t('memory.locationIcon')} ${iconType}`}
                >
                  <LocationIcon iconType={iconType} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className="journal-field">
            <label>{t('memory.locationColor')}</label>
            <div className="location-option-row">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`location-color-option ${newLocationColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setNewLocationColor(color)}
                  aria-label={`${t('memory.locationColor')} ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="journal-field">
            <label htmlFor="memory-location-description">{t('memory.locationDescription')}</label>
            <input
              id="memory-location-description"
              type="text"
              value={newLocationDescription}
              onChange={(event) => setNewLocationDescription(event.target.value)}
              placeholder={t('memory.locationDescriptionPlaceholder')}
            />
          </div>
        </div>
      )}

      {(selectedLocation || showNewLocation) && (
        <div className="journal-field">
          <label htmlFor="memory-raw-location">{t('memory.rawLocation')}</label>
          <input
            id="memory-raw-location"
            type="text"
            value={rawLocationName}
            onChange={(event) => setRawLocationName(event.target.value)}
            placeholder={t('memory.rawLocationPlaceholder')}
          />
        </div>
      )}

      <div className="journal-field">
        <label htmlFor="memory-trigger">{t('memory.triggerLabel')}</label>
        <textarea
          id="memory-trigger"
          value={triggerText}
          onChange={(event) => setTriggerText(event.target.value)}
          placeholder={t('memory.triggerPlaceholder')}
        />
      </div>

      <div className="journal-field">
        <label htmlFor="memory-thoughts">{t('memory.bodyLabel')}</label>
        <textarea
          id="memory-thoughts"
          value={bodyThoughts}
          onChange={(event) => setBodyThoughts(event.target.value)}
          placeholder={t('memory.bodyPlaceholder')}
        />
      </div>

      <div className="journal-field">
        <label htmlFor="memory-anxiety">{t('memory.anxietyLabel')}</label>
        <div className="anxiety-row">
          <span>1</span>
          <input
            id="memory-anxiety"
            type="range"
            className="anxiety-slider"
            min={1}
            max={10}
            value={anxietyLevel}
            onChange={(event) => setAnxietyLevel(Number(event.target.value))}
          />
          <span>10</span>
          <span className="anxiety-value">{anxietyLevel}</span>
        </div>
      </div>

      <div className="journal-field">
        <label htmlFor="memory-next-step">{t('memory.nextLabel')}</label>
        <textarea
          id="memory-next-step"
          value={nextStep}
          onChange={(event) => setNextStep(event.target.value)}
          placeholder={t('memory.nextPlaceholder')}
        />
      </div>

      <div className="journal-form-actions">
        <button type="button" className="btn-secondary" onClick={onDone}>{t('sheet.cancel')}</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={!canSave}>{t('sheet.save')}</button>
      </div>
    </div>
  );
}
