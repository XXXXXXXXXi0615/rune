import { useMemo, useRef, useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/Card';
import { t } from '@/i18n';
import { getPetImage, savePetImage, deletePetImages } from '@/store/petImages';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { PetImageFrame, PetMood, PetMoodImages } from '@/types';
import { compressImageFile, compressedImageName } from '@/utils/imageCompression';

const MOODS: PetMood[] = ['idle', 'happy', 'thinking', 'sleepy', 'anxious', 'shy', 'annoyed', 'error'];
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
const MAX_SELECTED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 1024 * 1024;
const MAX_EXPRESSION_SET_BYTES = 8 * 1024 * 1024;
const SPEED_OPTIONS = [
  { labelKey: 'pet.speedSlow', value: 600 },
  { labelKey: 'pet.speedNormal', value: 350 },
  { labelKey: 'pet.speedFast', value: 180 },
];

function DefaultPetIcon({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="var(--surface)" opacity="0.85" />
      <circle cx="28" cy="28" r="26" stroke="var(--border)" strokeWidth="1" />
      <path d="M22 14a14 14 0 000 28 10 10 0 010-28z" fill="var(--accent)" opacity="0.6" />
      <circle cx="21" cy="26" r="2" fill="var(--text)" />
      <circle cx="29" cy="26" r="2" fill="var(--text)" />
      <path d="M22 33c1.5 2 3 2.5 5 2.5s3.5-.5 5-2.5" stroke="var(--text)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FramePreview({ frames, durationMs, className }: { frames: PetImageFrame[]; durationMs: number; className: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    setFrameIndex(0);
    setFailed(false);
    Promise.all(frames.map((frame) => getPetImage(frame.key))).then((blobs) => {
      if (cancelled) return;
      blobs.forEach((blob) => {
        if (blob) objectUrls.push(URL.createObjectURL(blob));
      });
      setUrls(objectUrls);
      if (objectUrls.length === 0 && frames.length > 0) setFailed(true);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [frames]);

  useEffect(() => {
    if (urls.length <= 1) return undefined;
    const timerId = window.setInterval(() => {
      setFrameIndex((currentIndex) => (currentIndex + 1) % urls.length);
    }, durationMs);
    return () => window.clearInterval(timerId);
  }, [durationMs, urls.length]);

  const currentUrl = urls[frameIndex] || urls[0];
  if (!currentUrl || failed) {
    return <div className={className}><DefaultPetIcon /></div>;
  }
  return (
    <div className={className}>
      <img src={currentUrl} alt={t('pet.ariaLabel')} draggable={false} onError={() => setFailed(true)} />
    </div>
  );
}

export function PetAppearancePage() {
  const navigate = useNavigate();
  const petWidget = useAppStore((state) => state.petWidget);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const showToast = useToastStore((state) => state.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMoodRef = useRef<PetMood>('idle');
  const moodImages = useMemo(() => petWidget?.moodImages || {}, [petWidget?.moodImages]);
  const currentMood = petWidget?.currentMood || 'idle';

  const updateMoodSlot = (mood: PetMood, slot: PetMoodImages | undefined) => {
    const nextMoodImages = { ...moodImages };
    if (slot && slot.frames.length > 0) nextMoodImages[mood] = slot;
    else delete nextMoodImages[mood];
    updateSettings({
      petWidget: {
        ...petWidget,
        visible: petWidget?.visible !== false,
        currentMood,
        moodImages: nextMoodImages,
      },
    });
  };

  const handleUploadClick = (mood: PetMood) => {
    uploadMoodRef.current = mood;
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    const mood = uploadMoodRef.current;
    const now = Date.now();
    const newFrames: PetImageFrame[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) continue;
      if (file.size > MAX_SELECTED_IMAGE_BYTES) {
        showToast(t('pet.imageStillTooBig'));
        continue;
      }
      let compressed: Blob;
      try {
        compressed = await compressImageFile(file, {
          maxWidth: 512, maxHeight: 512, outputType: 'image/webp', quality: 0.78,
        });
      } catch {
        showToast(t('pet.imageStillTooBig'));
        continue;
      }
      if (compressed.size > MAX_COMPRESSED_IMAGE_BYTES) {
        showToast(t('pet.imageStillTooBig'));
        continue;
      }
      const id = crypto.randomUUID();
      const key = `pet-${mood}-${id}`;
      await savePetImage(key, compressed);
      const compressedType = compressed.type || 'image/png';
      newFrames.push({
        id, storage: 'indexeddb', key,
        name: compressedImageName(file.name, compressedType),
        type: compressedType, size: compressed.size, updatedAt: now,
      });
    }

    if (newFrames.length === 0) return;
    const currentSlot = moodImages[mood];
    const totalSize = [...(currentSlot?.frames || []), ...newFrames].reduce((sum, frame) => sum + (frame.size || 0), 0);
    if (totalSize > MAX_EXPRESSION_SET_BYTES) {
      await deletePetImages(newFrames.map((frame) => frame.key)).catch(() => {});
      showToast(t('pet.expressionSetTooBig'));
      return;
    }
    updateMoodSlot(mood, {
      frames: [...(currentSlot?.frames || []), ...newFrames],
      frameDurationMs: currentSlot?.frameDurationMs || 350,
      loop: currentSlot?.loop !== false,
    });
    showToast(t('pet.saved'));
  };

  const handleRemove = async (mood: PetMood) => {
    const currentSlot = moodImages[mood];
    if (!currentSlot?.frames.length) return;
    await deletePetImages(currentSlot.frames.map((frame) => frame.key));
    updateMoodSlot(mood, undefined);
  };

  const handleSpeedChange = (mood: PetMood, frameDurationMs: number) => {
    const currentSlot = moodImages[mood];
    if (!currentSlot?.frames.length) return;
    updateMoodSlot(mood, { ...currentSlot, frameDurationMs, loop: currentSlot.loop !== false });
  };

  return (
    <section className="view" style={{ paddingBottom: 96 }}>
      <BackButton to="/settings" />
      <Header eyebrow={t('pet.appearanceHint')} title={t('pet.appearance')} />

      <div style={{ padding: '0 16px' }}>
        <Card>
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div className="pet-current-card">
              <span>{t('pet.currentMood')}</span>
              <strong>{t(`pet.mood.${currentMood}`)}</strong>
            </div>

            <div className="pet-slot-list" aria-label={t('pet.moodSlots')} style={{ marginTop: 12 }}>
              {MOODS.map((mood) => {
                const slot = moodImages[mood];
                const frames = slot?.frames || [];
                const durationMs = slot?.frameDurationMs || 350;
                return (
                  <section className="pet-slot-card" key={mood}>
                    <div className="pet-slot-top">
                      <FramePreview frames={frames} durationMs={durationMs} className="pet-slot-preview" />
                      <div className="pet-slot-meta">
                        <div className="pet-slot-title">{t(`pet.mood.${mood}`)}</div>
                        <div className="pet-slot-hint">
                          {frames.length > 0 ? t('pet.framesCount').replace('{count}', String(frames.length)) : t('pet.noImage')}
                        </div>
                      </div>
                    </div>

                    <div className="pet-slot-actions">
                      <button type="button" className="settings-btn pet-slot-btn" onClick={() => handleUploadClick(mood)}>
                        {t('pet.uploadImage')}
                      </button>
                      <button type="button" className="settings-btn pet-slot-btn" disabled={frames.length === 0} onClick={() => handleRemove(mood)}>
                        {t('pet.removeImage')}
                      </button>
                    </div>

                    <div className="pet-speed-row" aria-label={t('pet.previewAnimation')}>
                      {SPEED_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`theme-chip ${durationMs === option.value ? 'active' : ''}`}
                          disabled={frames.length <= 1}
                          onClick={() => handleSpeedChange(mood, option.value)}
                        >
                          {t(option.labelKey)}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </Card>

        <input
          ref={fileInputRef}
          className="settings-file-input"
          type="file"
          accept="image/png,image/webp,image/jpeg"
          multiple
          hidden
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: 'none' }}
          onChange={handleUploadFiles}
        />
      </div>
    </section>
  );
}
