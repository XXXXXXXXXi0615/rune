import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { resolveActiveProvider } from '@/ai/providerRuntime';
import { AvatarImage } from '@/components/ui/AvatarImage';
import type { HomeWidgetSize } from '@/features/home/types';
import { HomeWidgetEmptyState } from './HomeWidgetEmptyState';
import { HomeWidgetIcon } from './HomeWidgetIcon';

export function HomeLunarisWidget({ size }: { size: HomeWidgetSize }) {
  const navigate = useNavigate();
  const rawPartner = useAppStore((s) => s.partner);
  const partner = rawPartner ?? {};
  const rawProviders = useAppStore((s) => s.providers);
  const providers = rawProviders || [];
  const lunarisName = selectPartnerDisplayName(rawPartner);
  const providerState = useMemo(() => {
    try { return resolveActiveProvider(providers); } catch { return null; }
  }, [providers]);
  const isOnline = providerState?.configured;

const fallbackInitial = (partner.avatarInitial || lunarisName || 'L').charAt(0).toUpperCase();
const avatarColor = partner.avatarColor || 'char';

  // If no providers at all, show empty state
  if (!providers || providers.length === 0) {
    return (
      <div className="hwg-widget hwg-widget--lunaris lunaris-status-paper" data-home-widget-id="home-lunaris"
        data-home-widget-state="empty"
        data-home-widget-size={size}
        onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
        <HomeWidgetEmptyState
          icon={<HomeWidgetIcon name="lunaris" size={size === 'small' ? 'sm' : 'md'} decorative />}
          title="尚未連接 AI 模型"
          description="設定一個 AI Provider 來啟用伴侶"
          actionLabel="前往設定"
          onAction={() => navigate('/settings')}
          compact={size === 'small'}
        />
      </div>
    );
  }

  return (
    <button type="button" className="hwg-widget hwg-widget--lunaris lunaris-status-paper" data-home-widget-id="home-lunaris"
      data-home-widget-state="active"
      data-home-widget-size={size}
      onClick={() => { /* open profile */ }}
      data-provider-status={isOnline ? 'connected' : 'standby'}>
      <div className="lunaris-status-paper__body">
        <div className="lunaris-status-paper__avatar">
          <AvatarImage
            avatarConfig={partner.avatarImage}
            initial={partner.avatarInitial || fallbackInitial}
            color={avatarColor}
            size={size === 'small' ? 40 : 52}
          />
          <span className="lunaris-status-paper__dot" />
        </div>
        <div className="lunaris-status-paper__copy">
          <span className="hw-kicker">LUNARIS 陪伴狀態</span>
          <div className="lunaris-status-paper__name">
            {lunarisName}
          </div>
          <div className="lunaris-status-paper__state">
            {isOnline ? '已連線' : '待命中'}
          </div>
        </div>
      </div>
    </button>
  );
}
