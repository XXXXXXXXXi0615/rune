import { useAppStore } from '@/store/useAppStore';
import type { AgentTool, AgentToolType } from '@/types';

interface ToolsCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

function toolTypeLabel(type: AgentToolType): string {
  switch (type) {
    case 'moonread': return '月讀室';
    case 'memory': return '記憶搜尋';
    case 'web_search': return 'Web Search';
    case 'file_reader': return 'File Reader';
    case 'custom_http': return 'Custom HTTP';
  }
}

function ChevronSvg() {
  return <svg className="liquid-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>;
}

export function ToolsCenter({ isOpen, onClose }: ToolsCenterProps) {
  const tools = useAppStore((s) => s.agentTools);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const agentRuntimeLogs = useAppStore((s) => s.agentRuntimeLogs);

  if (!isOpen) return null;

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <div className="liquid-modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="liquid-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 430, margin: '0 auto' }}>
        {/* Header */}
        <div className="liquid-sheet-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>工具中心</h2>
          <button type="button" className="liquid-btn-back" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 2 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Subtitle */}
        <div style={{ padding: '0 20px 4px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          管理 Luna 可調用的工具。第一版僅 UI，不接真實 MCP Server。<br />
          已啟用 {enabledCount}/{tools.length} 個工具
        </div>

        {/* Tool list */}
        <div className="liquid-section" style={{ padding: '12px 20px' }}>
          {tools.map((tool: AgentTool) => (
            <div
              key={tool.id}
              className="liquid-row"
              style={{ cursor: 'default', opacity: tool.enabled ? 1 : 0.55 }}
            >
              <div className="liquid-row-left" style={{ flex: 1 }}>
                <div className="liquid-icon-capsule" style={{
                  background: tool.enabled
                    ? tool.requireConfirmation ? 'rgba(212,160,80,0.12)' : 'rgba(93,184,114,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  color: tool.enabled
                    ? tool.requireConfirmation ? 'var(--amber)' : 'var(--success)'
                    : 'var(--text-3)',
                }}>
                  {tool.type === 'moonread' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                  )}
                  {tool.type === 'memory' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  )}
                  {tool.type === 'web_search' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  )}
                  {tool.type === 'file_reader' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  {tool.type === 'custom_http' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                  )}
                </div>
                <div className="liquid-row-text">
                  <div className="liquid-row-label">
                    {tool.name}
                    {tool.requireConfirmation && (
                      <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 6, fontWeight: 400 }}>需確認</span>
                    )}
                  </div>
                  <div className="liquid-row-hint">{tool.description}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                    {toolTypeLabel(tool.type)}
                    {tool.allowedPresets.length > 0 && ` · 可用於：${tool.allowedPresets.join(', ')}`}
                  </div>
                </div>
              </div>
              <div className="liquid-row-right">
                <label className="liquid-switch">
                  <input
                    type="checkbox"
                    checked={tool.enabled}
                    onChange={() => toggleTool(tool.id)}
                    aria-label={`切換${tool.name}`}
                  />
                  <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Recent logs count */}
        <div style={{ padding: '0 20px 20px', fontSize: 12, color: 'var(--text-3)' }}>
          最近執行記錄：{agentRuntimeLogs.length} 筆
        </div>
      </div>
    </div>
  );
}
