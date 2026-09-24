import type { CallMotionPreset } from '@/types';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';

interface CallParticipantTileProps {
  name: string;
  variant: 'main' | 'pip' | 'strip';
  speaking?: boolean;
  cameraOn?: boolean;
  isSelf?: boolean;
  portraitAssetId?: string;
  cameraOffAssetId?: string;
  crop?: { x: number; y: number; zoom: number };
  motionPreset?: CallMotionPreset;
}

/**
 * A participant tile for simulated calls. Speaking animation is restrained:
 * breathe / scale / glow / slight tilt only — no fake lip-sync in Phase 1.
 */
export function CallParticipantTile({
  name,
  variant,
  speaking,
  cameraOn = true,
  isSelf,
  portraitAssetId,
  cameraOffAssetId,
  crop,
  motionPreset = 'breathe',
}: CallParticipantTileProps) {
  const portraitUrl = useAssetBlobUrl(portraitAssetId);
  const cameraOffUrl = useAssetBlobUrl(cameraOffAssetId);
  const initial = (name || '?').charAt(0).toUpperCase();
  const showPortrait = cameraOn ? portraitUrl : cameraOffUrl;
  const motionClass = speaking && cameraOn ? ` motion-${motionPreset}` : '';
  const zoom = crop?.zoom && crop.zoom > 0 ? crop.zoom : 1;

  return (
    <figure
      className={`call-tile call-tile--${variant}${speaking ? ' is-speaking' : ''}${cameraOn ? '' : ' is-camera-off'}${isSelf ? ' is-self' : ''}`}
      aria-label={`${name}${isSelf ? '（你）' : ''}${speaking ? '，正在說話' : ''}${cameraOn ? '' : '，鏡頭已關閉'}`}
    >
      <div className={`call-tile__media${motionClass}`}>
        {showPortrait ? (
          <img
            src={showPortrait}
            alt=""
            style={{
              transform: `translate(${crop?.x || 0}%, ${crop?.y || 0}%) scale(${zoom})`,
            }}
          />
        ) : (
          <span className="call-tile__initial" aria-hidden="true">{initial}</span>
        )}
        {isSelf && cameraOn && !showPortrait && (
          <span className="call-tile__sim-note">模擬鏡頭</span>
        )}
      </div>
      <figcaption className="call-tile__name">
        {name}{isSelf ? '（你）' : ''}
        {!cameraOn && (
          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M15 9.3V8a2 2 0 0 0-2-2H7.6M4.3 6.5A2 2 0 0 0 3 8.4V16a2 2 0 0 0 2 2h8a2 2 0 0 0 1.7-.9M15 12.5 21 9v6l-2.4-1.4"/></svg>
        )}
      </figcaption>
    </figure>
  );
}
