import { useAppStore } from '@/store/useAppStore';
import { ConnectionGlyph } from '@/components/home/ConnectionGlyph';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { t } from '@/i18n';
import type { ConnectionStyle } from '@/types';

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CoupleCapsule() {
  const userName = useAppStore((s) => s.userName || 'shuri');
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const connectionStyle = useAppStore((s) => s.connectionStyle || 'heartbeat') as ConnectionStyle;
  const memories = useAppStore((s) => s.memoryEntries);

  const userInitial = (profile.avatarInitial || userName || 'S').charAt(0).toUpperCase();
  const userColor = profile.avatarColor || 'user';
  const partnerName = partner?.name || 'LUNARIS';
  const partnerInitial = partner?.avatarInitial || 'L';
  const partnerColor = partner?.avatarColor || 'char';

  const today = todayDateStr();
  const hasTodayMemory = memories.some((m) => {
    const mDate = new Date(m.createdAt).toISOString().slice(0, 10);
    return mDate === today;
  });

  const statusText = hasTodayMemory ? t('capsule.hasMemory') : t('capsule.noMemory');
  const ariaLabel = `${userName} & ${partnerName} · ${statusText}`;

  return (
    <div className="couple-capsule" role="status" aria-label={ariaLabel}>
      <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={userInitial} initial={userInitial} color={userColor} size={32} label={userName} />
      <ConnectionGlyph variant={connectionStyle} size={48} />
      <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={partnerInitial} initial={partnerInitial} color={partnerColor} size={32} label={partnerName} />
    </div>
  );
}
