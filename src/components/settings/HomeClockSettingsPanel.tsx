import { AppSwitch } from '@/components/ui/AppPrimitives';
import { useHomeClockStore } from '@/store/useHomeClockStore';

export function HomeClockSettingsPanel() {
  const settings = useHomeClockStore((state) => state.settings);
  const update = useHomeClockStore((state) => state.update);
  const reset = useHomeClockStore((state) => state.reset);
  const toggle = (key: 'showSeconds' | 'showSolarTerm' | 'showShichen' | 'showPillarOutline', label: string) => (
    <div className="settings-standard-row"><span className="settings-standard-copy"><span>{label}</span></span>
      <AppSwitch label={label} checked={settings[key]} onChange={(checked) => update({ [key]: checked })} /></div>
  );
  return <div className="settings-module-stack home-clock-settings" data-testid="home-clock-settings">
    <div className="settings-module-list">
      {toggle('showSeconds', '顯示秒數')}{toggle('showSolarTerm', '顯示節氣')}{toggle('showShichen', '顯示時辰')}{toggle('showPillarOutline', '顯示柱框')}
      <div className="settings-standard-row"><span className="settings-standard-copy"><span>固定 Hero 時鐘</span><small>位置與比例固定於首頁主視覺；此處只調整顯示內容</small></span></div>
      <div className="settings-standard-row"><span className="settings-standard-copy"><span>重設時鐘外觀</span><small>恢復預設值</small></span><button type="button" className="app-button app-button--secondary" onClick={reset}>重設</button></div>
    </div>
  </div>;
}
