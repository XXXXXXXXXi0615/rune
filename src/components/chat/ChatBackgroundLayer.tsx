import type { ChatBackgroundConfig } from '@/config/chatBackground';
import { useResolvedAssetUrl } from '@/hooks/useAssetBlobUrl';

export function ChatBackgroundLayer({ config }: { config: ChatBackgroundConfig }) {
  const url = useResolvedAssetUrl(config.source === 'custom' ? config.assetId : undefined);
  if (!url) return null;
  return <div className="chat-background-layer" aria-hidden="true" data-testid="chat-background-layer" data-asset-id={config.assetId}>
    <img className="chat-background-layer__image" src={url} alt="" style={{ objectPosition: `${config.positionX}% ${config.positionY}%`, transform: `scale(${config.scale / 100})`, filter: config.blurPx ? `blur(${config.blurPx}px)` : undefined }}/>
    <div className="chat-background-layer__overlay" style={{ backgroundColor: `color-mix(in srgb, var(--chat-background-scrim) ${Math.round(config.overlayOpacity * 100)}%, transparent)` }}/>
  </div>;
}
