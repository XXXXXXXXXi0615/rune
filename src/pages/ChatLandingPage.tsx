import { useLocation } from 'react-router-dom';
import { ChatInboxContent } from '@/pages/ChatInboxPage';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ChatSectionTabs } from '@/components/chat/moments/ChatSectionTabs';
import { MomentsFeed } from '@/components/chat/moments/MomentsFeed';
import { useAppStore } from '@/store/useAppStore';
import { isChatMomentRoute } from '@/utils/chatRoutes';
import { t } from '@/i18n';

function ChatLandingHeader() {
  const profile = useAppStore((state) => state.profile);
  const userName = useAppStore((state) => state.userName || 'shuri');
  const displayName = profile.displayName || userName;

  return (
    <header className="chat-inbox-header chat-landing-header">
      <div className="chat-inbox-heading">
        <span className="chat-inbox-eyebrow">{t('chat.inbox.eyebrow')}</span>
      </div>
      <AvatarImage
        avatarConfig={profile.avatarImage}
        fallbackInitial={displayName.charAt(0)}
        initial={displayName.charAt(0)}
        color={profile.avatarColor || 'user'}
        size={44}
        label={displayName}
      />
    </header>
  );
}

export function ChatLandingPage() {
  const { pathname } = useLocation();
  const momentsActive = isChatMomentRoute(pathname);

  return (
    <section
      className={`chat-landing-page${momentsActive ? ' is-moments' : ' is-messages'}`}
      data-chat-landing-section={momentsActive ? 'moments' : 'messages'}
      data-clawd-anchor={momentsActive ? 'chat-moments' : 'chat-list'}
    >
      <ChatLandingHeader />
      <ChatSectionTabs />
      {momentsActive ? <MomentsFeed /> : <ChatInboxContent />}
    </section>
  );
}
