import { useState, useCallback, useRef, useEffect } from 'react';
import { useUsageTracker } from '@/hooks/useUsageTracker';
import { UsageControlPanel } from '@/components/usage/UsageControlPanel';
import { UsageLockGate } from '@/components/usage/UsageLockGate';
import { UsageLockSettingsSheet } from '@/components/usage/UsageLockSettings';

export function UsageHost({ showControl = true }: { showControl?: boolean }) {
  const [showLockSettings, setShowLockSettings] = useState(false);
  const lockSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  // Activate usage tracking
  useUsageTracker();

  const handleOpenLockSettings = useCallback((event: Event) => {
    const trigger = (event as CustomEvent<HTMLButtonElement>).detail;
    lockSettingsTriggerRef.current = trigger instanceof HTMLButtonElement ? trigger : null;
    setShowLockSettings(true);
  }, []);
  useEffect(() => {
    window.addEventListener('today-status-lock-settings', handleOpenLockSettings);
    return () => window.removeEventListener('today-status-lock-settings', handleOpenLockSettings);
  }, [handleOpenLockSettings]);

  const handleCloseLockSettings = useCallback(() => {
    setShowLockSettings(false);
    requestAnimationFrame(() => {
      const trigger = lockSettingsTriggerRef.current;
      if (trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length && !trigger.closest('[hidden], [inert], [aria-hidden="true"]')) trigger.focus();
    });
  }, []);

  return (
    <>
      <UsageControlPanel
        showTrigger={showControl}
        lockSettingsOpen={showLockSettings}
      />
      <UsageLockGate />
      {showLockSettings && (
        <UsageLockSettingsSheet onClose={handleCloseLockSettings} />
      )}
    </>
  );
}
