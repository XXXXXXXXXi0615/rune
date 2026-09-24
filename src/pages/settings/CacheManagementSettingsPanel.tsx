import { DailyCacheBody } from '@/components/cache/DailyCacheBody';
import './CacheManagementSettingsPanel.css';

/**
 * 緩存管理 — Settings → 資料與儲存空間 → 緩存管理.
 * Daily cache window business logic is reused verbatim (DailyCacheBody),
 * so scan / clean / recovery semantics stay identical to the window surface.
 */
export function CacheManagementSettingsPanel() {
  return (
    <div className="settings-cache-managed-panel" data-testid="settings-cache-management">
      <p className="settings-cache-managed-intro">
        管理可安全清理的暫存資料、最近刪除與過期項目。聊天、記憶、手記與原始圖片不會被刪除。
      </p>
      <DailyCacheBody active />
    </div>
  );
}
