import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { STORAGE_KEY } from '@/store/storage';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { createLunartideBackup, restoreLunartideBackup, serializePersistedStore } from '@/utils/backup';

export function SettingsDataExportPanel() {
  const showToast = useToastStore((state) => state.showToast);

  const handleExport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        showToast('尚無資料可匯出');
        return;
      }
      const backup = createLunartideBackup(JSON.parse(raw));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lunartide_backup_${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('匯出完成');
    } catch {
      showToast('匯出失敗');
    }
  };

  return (
    <div className="settings-module-stack">
      <div className="settings-info-block">
        <strong>匯出完整備份</strong>
        <p>將 Rune 的本機資料（對話記錄、記憶、待辦事項、設定與音樂庫等）打包為單一 JSON 檔案，方便遷移或歸檔。</p>
      </div>
      <div className="settings-panel-actions settings-panel-actions--start">
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleExport}>匯出備份檔</button>
      </div>
    </div>
  );
}

export function SettingsDataImportPanel() {
  const showToast = useToastStore((state) => state.showToast);
  const [fileName, setFileName] = useState('');

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = restoreLunartideBackup(JSON.parse(reader.result as string));
        localStorage.setItem(STORAGE_KEY, serializePersistedStore(data));
        showToast('匯入完成，即將重新載入');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        showToast('匯入失敗，請確認備份格式');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-module-stack">
      <div className="settings-info-block settings-info-block--warning">
        <strong>從備份還原</strong>
        <p>選擇之前匯出的 .json 備份檔，即可還原所有資料。<br />⚠ 匯入會完全覆蓋目前的本機資料，且無法復原。建議執行前先匯出現有備份。</p>
      </div>
      <label className="settings-file-field">
        <span>選擇備份檔案</span>
        <small>{fileName || '尚未選擇檔案'}</small>
        <input type="file" accept="application/json,.json" onChange={handleImport} />
      </label>
    </div>
  );
}

export function SettingsDataResetPanel() {
  const showToast = useToastStore((state) => state.showToast);
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
  }, []);

  const resetConfirm = () => {
    setConfirming(true);
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = window.setTimeout(() => {
      setConfirming(false);
      confirmTimerRef.current = null;
    }, 5000);
  };

  const clearAll = async () => {
    const { deleteAssets } = await import('@/store/assets');
    const state = useAppStore.getState();
    const assetIds = [
      ...state.messages.flatMap((message) =>
        (message.type === 'image' || message.type === 'file') && message.assetId
          ? [message.assetId]
          : [],
      ),
      ...state.music.tracks.flatMap((track) => track.assetId ? [track.assetId] : []),
      ...(state.profile.avatarAssetId ? [state.profile.avatarAssetId] : []),
      ...(state.profile.coverAssetId ? [state.profile.coverAssetId] : []),
    ];
    try { await deleteAssets(assetIds); } catch { /* continue local reset */ }
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div className="settings-module-stack">
      <div className="settings-info-block settings-info-block--danger">
        <strong>清除所有本機資料</strong>
        <p>刪除 Rune 儲存在此裝置上的所有本機資料，包括對話記錄、記憶、待辦事項、設定檔和自訂字體等。<br />⚠ 此操作無法復原，請先匯出需要保留的資料。</p>
      </div>
      <div className="settings-panel-actions settings-panel-actions--start">
        <button
          type="button"
          className="liquid-btn liquid-btn--danger"
          onClick={confirming ? clearAll : resetConfirm}
        >
          {confirming ? '再次點擊確認清除' : '清除所有本機資料'}
        </button>
        {confirming && <span className="settings-confirm-hint">5 秒內再次點擊才會執行。</span>}
      </div>
    </div>
  );
}
