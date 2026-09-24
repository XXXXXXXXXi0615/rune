import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSwitch } from '@/components/ui/AppPrimitives';
import { useCompanionPetStore, type CompanionBreakpoint } from '@/store/useCompanionPetStore';

function currentBreakpoint(): CompanionBreakpoint {
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

export function CompanionDisplaySettings() {
  const location = useLocation();
  const preferences = useCompanionPetStore((state) => state.preferences);
  const setEnabled = useCompanionPetStore((state) => state.setEnabled);
  const setPinned = useCompanionPetStore((state) => state.setPinned);
  const setScale = useCompanionPetStore((state) => state.setScale);
  const resetPosition = useCompanionPetStore((state) => state.resetPosition);
  const resetRoutePresentation = useCompanionPetStore((state) => state.resetRoutePresentation);
  const [breakpoint, setBreakpoint] = useState<CompanionBreakpoint>(() => currentBreakpoint());
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    const update = () => setBreakpoint(currentBreakpoint());
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  const resetCurrentPosition = () => {
    resetPosition(breakpoint);
    resetRoutePresentation(location.pathname);
    setResetDone(true);
  };

  return (
    <div className="settings-module-stack companion-display-settings" data-testid="companion-display-settings">
      <div className="settings-info-block">
        <strong>桌寵</strong>
        <p>管理 Companion 的顯示、大小與位置。設定頁與互動視窗開啟時會暫時隱藏桌寵。</p>
      </div>

      <div className="settings-module-list">
        <div className="settings-standard-row">
          <span className="settings-standard-copy">
            <span>顯示桌寵</span>
            <small>在一般頁面顯示 Companion</small>
          </span>
          <AppSwitch label="顯示桌寵" checked={preferences.enabled} onChange={setEnabled} />
        </div>

        <div className="settings-standard-row">
          <span className="settings-standard-copy">
            <span>鎖定位置</span>
            <small>鎖定後桌寵為純展示，不接收頁面上的指標操作</small>
          </span>
          <AppSwitch label="鎖定位置" checked={preferences.pinned} onChange={setPinned} />
        </div>

        <label className="settings-standard-row settings-standard-row--stacked companion-display-settings__scale">
          <span className="settings-standard-copy">
            <span>大小</span>
            <small>套用到未設定個別大小的頁面</small>
          </span>
          <span className="companion-display-settings__range">
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={preferences.scale}
              aria-label="桌寵大小"
              onChange={(event) => setScale(Number(event.target.value))}
            />
            <output>{Math.round(preferences.scale * 100)}%</output>
          </span>
        </label>

        <div className="settings-standard-row">
          <span className="settings-standard-copy">
            <span>目前頁面位置</span>
            <small>重設這個裝置尺寸與目前 Settings route 的位置</small>
          </span>
          <button type="button" className="companion-display-settings__reset" onClick={resetCurrentPosition}>
            重設位置
          </button>
        </div>
        <span className="companion-display-settings__status" role="status" aria-live="polite">
          {resetDone ? '位置已重設' : ''}
        </span>
      </div>
    </div>
  );
}
