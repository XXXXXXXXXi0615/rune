import { NavLink } from 'react-router-dom';

const CHAT_SECTIONS = [
  { label: '訊息', to: '/chat', end: true },
  { label: '朋友圈', to: '/chat/moments', end: false },
] as const;

export function ChatSectionTabs() {
  return (
    <nav className="chat-section-tabs" aria-label="聊天內容">
      {CHAT_SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) => `chat-section-tab${isActive ? ' is-active' : ''}`}
        >
          {({ isActive }) => (
            <span aria-current={isActive ? 'page' : undefined}>{section.label}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
