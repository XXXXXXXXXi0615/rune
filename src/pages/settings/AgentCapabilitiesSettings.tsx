import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_MOMENTS_AGENT_PERMISSIONS } from '@/features/moments/agentTools';

const DEFAULT_PERMISSIONS = { read: true, create: false, update: false, delete: false, comment: true };

export function AgentCapabilitiesSettings() {
  const permissions = useAppStore((state) => state.calendarPermissions || DEFAULT_PERMISSIONS);
  const momentsPermissions = useAppStore((state) => state.momentsAgentPermissions || DEFAULT_MOMENTS_AGENT_PERMISSIONS);
  return (
    <div className="settings-module-stack" data-testid="agent-calendar-permissions">
      <div className="settings-info-block">
        <strong>智能體權限</strong>
        <p>控制智能體可以如何使用你們共用的日曆。建立、修改與刪除預設關閉。</p>
      </div>
      <div className="settings-module-list">
        {([
          ['read', '讀取日曆'], ['create', '建立安排'], ['update', '修改安排'], ['delete', '刪除安排'], ['comment', '留下便箋'],
        ] as const).map(([key, label]) => (
          <label key={key} className="settings-standard-row">
            <span className="settings-standard-copy"><span>{label}</span></span>
            <input
              type="checkbox"
              checked={permissions[key]}
              onChange={(event) => useAppStore.setState((state) => ({
                calendarPermissions: { ...(state.calendarPermissions || DEFAULT_PERMISSIONS), [key]: event.target.checked },
              }))}
            />
          </label>
        ))}
      </div>
      <div className="settings-info-block">
        <strong>朋友圈互動</strong>
        <p>只提供明確工具呼叫能力，不會讓智能體自動發文、巡覽或留言。「僅自己」內容不會提供給智能體。</p>
      </div>
      <div className="settings-module-list" data-testid="agent-moments-permissions">
        {([
          ['momentsRead', '允許智能體查看朋友圈'],
          ['momentsWrite', '允許智能體發布動態'],
          ['momentsInteract', '允許智能體點讚與留言'],
        ] as const).map(([key, label]) => (
          <label key={key} className="settings-standard-row">
            <span className="settings-standard-copy"><span>{label}</span></span>
            <input
              type="checkbox"
              checked={momentsPermissions[key]}
              onChange={(event) => useAppStore.setState((state) => ({
                momentsAgentPermissions: { ...(state.momentsAgentPermissions || DEFAULT_MOMENTS_AGENT_PERMISSIONS), [key]: event.target.checked },
              }))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
