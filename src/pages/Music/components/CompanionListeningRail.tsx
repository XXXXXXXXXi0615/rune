import { AvatarImage } from '@/components/ui/AvatarImage';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';

export function CompanionListeningRail({ playing }: { playing: boolean }) {
  const profile = useAppStore((state) => state.profile);
  const userName = useAppStore((state) => state.userName);
  const partner = useAppStore((state) => state.partner);
  const userFallback = (profile.displayName || userName || '理').charAt(0);
  const partnerName = selectPartnerDisplayName(partner);
  const partnerFallback = partnerName.charAt(0);
  const hasPartner = Boolean(partner.name);
  return <section className={`hifi-companion${playing ? ' is-playing' : ''}`} aria-label={hasPartner ? '双人陪伴聆听' : '单人聆听'}>
    <div className="hifi-companion__person">
      <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={userFallback} initial={userFallback} color="user" size={52} />
      <span>{profile.displayName || userName || '理'}</span>
    </div>
    <div className="hifi-companion__connection" aria-hidden="true">
      <svg viewBox="0 0 150 44"><path d="M5 31 Q42 4 75 23 Q108 4 145 31"/><path d="M5 34 Q42 13 75 25 Q108 13 145 34"/><circle cx="75" cy="23" r="4"/></svg>
      <strong>{hasPartner ? '一起聆听中' : '单人聆听'}</strong>
    </div>
    <div className="hifi-companion__person">
      {hasPartner ? <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={partnerFallback} initial={partnerFallback} color="char" size={52} /> : <span className="hifi-companion__empty" aria-hidden="true" />}
      <span>{hasPartner ? partnerName : '尚未选择陪伴角色'}</span>
    </div>
  </section>;
}
