import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConversationList } from '@/components/chat/ConversationList';
import { ProviderSetupNotice } from '@/components/chat/ProviderSetupNotice';
import { CreateGroupSheet } from '@/components/chat/GroupChatPanels';
import { resolveChatProvider } from '@/ai/providerRuntime';
import { useAppStore } from '@/store/useAppStore';

export function ChatInboxContent() {
  const navigate = useNavigate();
  const createConv = useAppStore((s) => s.createConversation);
  const providers = useAppStore((s) => s.providers || []);
  const aiRoles = useAppStore((s) => s.aiRoles);
  const [groupOpen, setGroupOpen] = useState(false);
  const providerState = resolveChatProvider(aiRoles, providers);

  const handleNewChat = () => {
    const id = createConv();
    navigate(`/chat/${id}`);
  };

  return (
    <section className="chat-inbox-view" data-chat-screen="list" data-clawd-anchor="chat-list">
      <ProviderSetupNotice ready={providerState.configured} />

      <div className="chat-inbox-actions" data-pet-safe-region="interactive">
        <button type="button" onClick={handleNewChat}>新建私聊</button>
        <button type="button" onClick={() => setGroupOpen(true)}>建立群聊</button>
      </div>

      <ConversationList
        onSelect={(id) => navigate(`/chat/${id}`)}
        compact
        enableProjects
      />

      <CreateGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} onCreated={(id) => navigate(`/chat/${id}`)} />
    </section>
  );
}
