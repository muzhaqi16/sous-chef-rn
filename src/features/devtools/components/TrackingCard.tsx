import React from 'react';
import { useTranslation } from '#/i18n';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { usePerformanceStore } from '#/store/performanceStore';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';

/**
 * The four tracking toggles. Owns the `MemoryMonitor` wiring, which is the one
 * side effect a toggle has beyond the store write.
 */
export const TrackingCard: React.FC = () => {
  const { t } = useTranslation();
  const isEnabled = usePerformanceStore(state => state.isEnabled);
  const trackRenders = usePerformanceStore(state => state.trackRenders);
  const trackMemory = usePerformanceStore(state => state.trackMemory);
  const trackScreens = usePerformanceStore(state => state.trackScreens);
  const setPerformanceEnabled = usePerformanceStore(
    state => state.setPerformanceEnabled,
  );
  const setTrackRenders = usePerformanceStore(state => state.setTrackRenders);
  const setTrackMemory = usePerformanceStore(state => state.setTrackMemory);
  const setTrackScreens = usePerformanceStore(state => state.setTrackScreens);

  const handleTrackMemoryChange = (enabled: boolean) => {
    setTrackMemory(enabled);
    if (enabled && isEnabled) {
      MemoryMonitor.start(10000);
    } else {
      MemoryMonitor.stop();
    }
  };

  const handlePerformanceEnabledChange = (enabled: boolean) => {
    setPerformanceEnabled(enabled);
    if (!enabled && MemoryMonitor.isEnabled()) {
      MemoryMonitor.stop();
    }
  };

  return (
    <SettingsSection variant="inset" title={t('performance.tracking')}>
      <SettingSwitch
        title={t('performance.enableTracking')}
        description={t('performance.enableTrackingDesc')}
        value={isEnabled}
        onValueChange={handlePerformanceEnabledChange}
      />
      <SettingSwitch
        title={t('performance.trackRenders')}
        description={t('performance.trackRendersDesc')}
        value={trackRenders}
        onValueChange={setTrackRenders}
        disabled={!isEnabled}
      />
      <SettingSwitch
        title={t('performance.trackMemory')}
        description={t('performance.trackMemoryDesc')}
        value={trackMemory}
        onValueChange={handleTrackMemoryChange}
        disabled={!isEnabled}
      />
      <SettingSwitch
        title={t('performance.trackScreens')}
        description={t('performance.trackScreensDesc')}
        value={trackScreens}
        onValueChange={setTrackScreens}
        disabled={!isEnabled}
      />
    </SettingsSection>
  );
};
