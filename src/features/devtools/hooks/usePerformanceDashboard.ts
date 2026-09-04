import { useState, useEffect } from 'react';
import performance from 'react-native-performance';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { usePerformanceStore } from '#/store/performanceStore';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import type {
  MemorySnapshot,
  RenderMetrics,
  ScreenMetrics,
} from '#/services/performance/types';

export interface StartupMetrics {
  nativeLaunch: number | null;
  bundleLoad: number | null;
}

export interface HttpRequestMetric {
  host: string;
  duration: number;
  url: string;
}

export interface PerformanceDashboardData {
  refreshing: boolean;
  lastUpdated: number;
  trackRenders: boolean;
  trackMemory: boolean;
  trackScreens: boolean;
  isEnabled: boolean;
  slowestComponents: RenderMetrics[];
  slowestScreens: ScreenMetrics[];
  recentMemorySnapshots: MemorySnapshot[];
  startupMetrics: StartupMetrics;
  recentHttpRequests: HttpRequestMetric[];
  onRefresh: () => void;
  onClearData: () => void;
}

const readStartupMetrics = (): StartupMetrics => {
  const entries = performance.getEntriesByType('react-native-mark');
  const find = (name: string) => entries.find(e => e.name === name);
  const launchStart = find('nativeLaunchStart');
  const launchEnd = find('nativeLaunchEnd');
  const bundleStart = find('runJsBundleStart');
  const bundleEnd = find('runJsBundleEnd');
  return {
    nativeLaunch:
      launchStart && launchEnd
        ? launchEnd.startTime - launchStart.startTime
        : null,
    bundleLoad:
      bundleStart && bundleEnd
        ? bundleEnd.startTime - bundleStart.startTime
        : null,
  };
};

const hostOf = (url: string): string => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  return parsed?.host ?? 'unknown';
};

const readRecentHttpRequests = (): HttpRequestMetric[] =>
  performance
    .getEntriesByType('resource')
    .slice(-10)
    .reverse()
    .map(entry => ({
      host: hostOf(entry.name),
      duration: entry.duration,
      url: entry.name,
    }));

/**
 * The dashboard's data: store metrics sorted for display, plus the two
 * `react-native-performance` reads, recomputed on the refresh tick.
 */
export const usePerformanceDashboard = (): PerformanceDashboardData => {
  const { t } = useTranslation();
  const isEnabled = usePerformanceStore(state => state.isEnabled);
  const trackRenders = usePerformanceStore(state => state.trackRenders);
  const trackMemory = usePerformanceStore(state => state.trackMemory);
  const trackScreens = usePerformanceStore(state => state.trackScreens);
  const componentMetrics = usePerformanceStore(state => state.componentMetrics);
  const screenMetrics = usePerformanceStore(state => state.screenMetrics);
  const memorySnapshots = usePerformanceStore(state => state.memorySnapshots);
  const clearPerformanceData = usePerformanceStore(
    state => state.clearPerformanceData,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  // The startup and HTTP reads are not store state, so a tick is what refreshes
  // them; it also re-stamps the "last updated" line.
  useEffect(() => {
    const tick = () => setLastUpdated(Date.now());
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = () => {
    executeRefreshWithFinally(async () => {
      if (trackMemory && isEnabled) {
        await MemoryMonitor.takeSnapshot('manual_refresh');
      }
      setLastUpdated(Date.now());
    }, setRefreshing);
  };

  const onClearData = () => {
    alertService.alert(
      t('performance.clearData'),
      t('performance.clearDataConfirm'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.clear'),
          style: 'destructive',
          onPress: () => {
            clearPerformanceData();
            performance.clearMarks();
            performance.clearMeasures();
            performance.clearResourceTimings();
            setLastUpdated(Date.now());
          },
        },
      ],
    );
  };

  // Read so the performance-API reads below recompute on the tick.
  void lastUpdated;

  return {
    refreshing,
    lastUpdated,
    isEnabled,
    trackRenders,
    trackMemory,
    trackScreens,
    slowestComponents: [...componentMetrics.values()]
      .sort((a, b) => b.avgRenderTime - a.avgRenderTime)
      .slice(0, 10),
    slowestScreens: [...screenMetrics.values()]
      .sort((a, b) => b.avgInteractiveTime - a.avgInteractiveTime)
      .slice(0, 10),
    recentMemorySnapshots: memorySnapshots.slice(-5),
    startupMetrics: readStartupMetrics(),
    recentHttpRequests: readRecentHttpRequests(),
    onRefresh,
    onClearData,
  };
};
