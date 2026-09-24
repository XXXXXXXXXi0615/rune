import { useNavigate } from 'react-router-dom';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { ConversationList } from './ConversationList';

interface ChatSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ collapsed, onToggle }: ChatSidebarProps) {
  const navigate = useNavigate();
  const partner = useAppStore((s) => s.partner);

  const handleSelect = (id: string) => {
    navigate(`/chat/${id}`);
  };

  return (
    <aside className={`chat-sidebar${collapsed ? ' chat-sidebar--collapsed' : ''}`} aria-label="對話列表">
      <div className="chat-sidebar-head">
        <div className="chat-sidebar-brand-row">
          <span className="chat-sidebar-brand">Lunartide</span>
          <span className="chat-sidebar-brand-sub">Chat</span>
        </div>
        <button
          type="button"
          className="chat-sidebar-collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? '展開側欄' : '收起側欄'}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points={collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
          </svg>
        </button>
      </div>

      <ConversationList onSelect={handleSelect} />

      <div className="chat-sidebar-foot">
        <span className="chat-sidebar-foot-label">{selectPartnerDisplayName(partner)} 的對話空間</span>
      </div>
    </aside>
  );
}
