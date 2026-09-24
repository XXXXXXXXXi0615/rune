import { ChatPage } from '@/pages/ChatPage';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Conversation-detail adapter. Top-level Chat sections are owned by
 * ChatLandingPage and never enter this component.
 */
export function ChatEntry() {
  return (
    <ErrorBoundary fallback="聊天工作區載入失敗">
      <ChatPage />
    </ErrorBoundary>
  );
}
