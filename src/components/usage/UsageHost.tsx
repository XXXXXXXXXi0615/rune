import { useState, useCallback, useRef } from 'react';
import { useUsageTracker } from '@/hooks/useUsageTracker';
import { UsageControlPanel } from '@/components/usage/UsageControlPanel';
import { UsageLockGate } from '@/components/usage/UsageLockGate';
import { UsageLockSettingsSheet } from '@/components/usage/UsageLockSettings';

export function UsageHost({ showControl = true }: { showControl?: boolean }) {
  const [showLockSettings, setShowLockSettings] = useState(false);
  const lockSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  // Activate usage tracking
  useUsageTracker();

  const handleOpenLockSettings = useCallback(() => {
    setShowLockSettings(true);
  }, []);

  const handleCloseLockSettings = useCallback(() => {
    setShowLockSettings(false);
    requestAnimationFrame(() => lockSettingsTriggerRef.current?.focus());
  }, []);

  return (
    <>
      <UsageControlPanel
        showTrigger={showControl}
        onOpenLockSettings={handleOpenLockSettings}
        lockSettingsOpen={showLockSettings}
        lockSettingsTriggerRef={lockSettingsTriggerRef}
      />
      <UsageLockGate />
      {showLockSettings && (
        <UsageLockSettingsSheet onClose={handleCloseLockSettings} />
      )}
    </>
  );
}
