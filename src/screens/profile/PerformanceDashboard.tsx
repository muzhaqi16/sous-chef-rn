import React, { useState, useEffect } from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingSection } from '#components/settings/SettingSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { usePerformanceStore } from '#/store/performanceStore';
import { Environment } from '#/utils/environment';
import { useCanAccessDevTools } from '#/store/useAppStore';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { useFPSMonitor } from '#/hooks/performance/useFPSMonitor';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import performance from 'react-native-performance';

/**
 * Isolated FPS display component.
 * Owns its own useFPSMonitor call so that FPS state updates (10/sec)
 * only re-render this small card — not the entire dashboard with its
 * table sorts and IIFE recomputations.
 */
const FPSSection: React.FC = () => {
  const { theme } = useUnistyles();
  const { fps, isLowFPS, stats: fpsStats } = useFPSMonitor();

  return (
    <View style={styles.metricsSection}>
      <Text style={styles.sectionTitle}>Live FPS</Text>
      <Text style={styles.sectionSubtitle}>Frame rate monitor (DEV only)</Text>
      <View style={styles.startupCard}>
        <View style={styles.startupRow}>
          <Text style={styles.startupLabel}>Current FPS</Text>
          <Text
            style={[
              styles.startupValue,
              isLowFPS && { color: theme.colors.error },
            ]}
          >
            {fps}
          </Text>
        </View>
        <View style={styles.startupRow}>
          <Text style={styles.startupLabel}>Min / Avg / Max</Text>
          <Text style={styles.startupValue}>
            {fpsStats.min} / {fpsStats.avg} / {fpsStats.max}
          </Text>
        </View>
        <View style={styles.startupRow}>
          <Text style={styles.startupLabel}>Low FPS Events</Text>
          <Text
            style={[
              styles.startupValue,
              fpsStats.lowFPSCount > 0 && { color: theme.colors.warning },
            ]}
          >
            {fpsStats.lowFPSCount}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const PerformanceDashboard: React.FC = () => {
  const { theme } = useUnistyles();

  // Performance state (from isolated performance store)
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

  const componentMetrics = usePerformanceStore(state => state.componentMetrics);
  const screenMetrics = usePerformanceStore(state => state.screenMetrics);
  const memorySnapshots = usePerformanceStore(state => state.memorySnapshots);
  const clearPerformanceData = usePerformanceStore(
    state => state.clearPerformanceData,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  // Auto-refresh every 5 seconds to keep startup/HTTP metrics current
  useEffect(() => {
    const tick = () => setLastUpdated(Date.now());
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  // Wire memory toggle: start/stop MemoryMonitor when toggled
  const handleTrackMemoryChange = (enabled: boolean) => {
    setTrackMemory(enabled);
    if (enabled && isEnabled) {
      MemoryMonitor.start(10000);
    } else {
      MemoryMonitor.stop();
    }
  };

  // Wire master toggle: stop MemoryMonitor when master is disabled
  const handlePerformanceEnabledChange = (enabled: boolean) => {
    setPerformanceEnabled(enabled);
    if (!enabled && MemoryMonitor.isEnabled()) {
      MemoryMonitor.stop();
    }
  };

  const handleRefresh = () => {
    executeRefreshWithFinally(async () => {
      if (trackMemory && isEnabled) {
        await MemoryMonitor.takeSnapshot('manual_refresh');
      }
      setLastUpdated(Date.now());
    }, setRefreshing);
  };

  // Derive sorted metrics from raw data
  const slowestComponents = [...componentMetrics.values()]
    .sort((a, b) => b.avgRenderTime - a.avgRenderTime)
    .slice(0, 10);
  const slowestScreens = [...screenMetrics.values()]
    .sort((a, b) => b.avgInteractiveTime - a.avgInteractiveTime)
    .slice(0, 10);
  const recentMemorySnapshots = memorySnapshots.slice(-5);
  const latestMemorySnapshot =
    memorySnapshots.length > 0
      ? memorySnapshots[memorySnapshots.length - 1]
      : null;

  const handleClearData = () => {
    alertService.alert(
      'Clear Performance Data',
      'Are you sure you want to clear all performance metrics?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
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

  const formatTime = (ms: number) => {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(0)}μs`;
    }
    return `${ms.toFixed(2)}ms`;
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)}MB`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const canAccessDevTools = useCanAccessDevTools();

  // lastUpdated is used to ensure IIFEs below recompute on interval/pull-to-refresh
  void lastUpdated;

  const startupMetrics = (() => {
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
  })();

  const recentHttpRequests = (() => {
    const entries = performance.getEntriesByType('resource');
    return entries
      .slice(-10)
      .reverse()
      .map(entry => {
        let host = 'unknown';
        try {
          host = new URL(entry.name).host;
        } catch {
          // Keep 'unknown'
        }
        return { host, duration: entry.duration, url: entry.name };
      });
  })();

  if (!Environment.shouldEnableDebugFeatures() && !canAccessDevTools) {
    return (
      <ProfileScreenWrapper title="Performance Dashboard">
        <View style={styles.notAvailableContainer}>
          <Text style={styles.notAvailableText}>
            Performance dashboard is only available to administrators.
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper title="Performance Dashboard" scrollEnabled={false}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Last Updated */}
        <View style={styles.lastUpdated}>
          <Text style={styles.lastUpdatedText}>
            Last updated: {formatTimestamp(lastUpdated)}
          </Text>
        </View>

        <SettingSection title="Performance Tracking">
          <SettingSwitch
            title="Enable Performance Tracking"
            description="Master switch for all performance monitoring"
            value={isEnabled}
            onValueChange={handlePerformanceEnabledChange}
          />
          <SettingSwitch
            title="Track Component Renders"
            description="Monitor component render times and counts"
            value={trackRenders}
            onValueChange={setTrackRenders}
            disabled={!isEnabled}
          />
          <SettingSwitch
            title="Track Memory Usage"
            description="Monitor memory consumption over time"
            value={trackMemory}
            onValueChange={handleTrackMemoryChange}
            disabled={!isEnabled}
          />
          <SettingSwitch
            title="Track Screen Transitions"
            description="Monitor screen navigation performance"
            value={trackScreens}
            onValueChange={setTrackScreens}
            disabled={!isEnabled}
          />
        </SettingSection>

        {/* FPS Monitor (DEV only) — isolated component to avoid 10/sec re-renders of parent */}
        {!!__DEV__ && <FPSSection />}

        {/* Startup Metrics */}
        {(startupMetrics.nativeLaunch !== null ||
          startupMetrics.bundleLoad !== null) && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Startup Metrics</Text>
            <Text style={styles.sectionSubtitle}>
              One-shot timing from app launch
            </Text>
            <View style={styles.startupCard}>
              {startupMetrics.nativeLaunch !== null && (
                <View style={styles.startupRow}>
                  <Text style={styles.startupLabel}>Native Launch</Text>
                  <Text style={styles.startupValue}>
                    {formatTime(startupMetrics.nativeLaunch)}
                  </Text>
                </View>
              )}
              {startupMetrics.bundleLoad !== null && (
                <View style={styles.startupRow}>
                  <Text style={styles.startupLabel}>JS Bundle Load</Text>
                  <Text style={styles.startupValue}>
                    {formatTime(startupMetrics.bundleLoad)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* HTTP Resource Summary */}
        {recentHttpRequests.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>HTTP Resource Summary</Text>
            <Text style={styles.sectionSubtitle}>
              Last {recentHttpRequests.length} HTTP requests
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderName}>Host</Text>
                <Text style={styles.tableHeaderAvg}>Duration</Text>
              </View>
              {recentHttpRequests.map((req, index) => (
                <View
                  key={`${req.url}-${index}`}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && {
                      backgroundColor: theme.colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Text style={styles.tableCellName} numberOfLines={1}>
                    {req.host}
                  </Text>
                  <Text style={styles.tableCellAvg}>
                    {formatTime(req.duration)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Slowest Components */}
        {!!trackRenders && slowestComponents.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Slowest Components</Text>
            <Text style={styles.sectionSubtitle}>
              Components with highest average render time
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderName}>Component</Text>
                <Text style={styles.tableHeaderAvg}>Avg</Text>
                <Text style={styles.tableHeaderMax}>Max</Text>
                <Text style={styles.tableHeaderTotal}>Total</Text>
                <Text style={styles.tableHeaderCount}>Count</Text>
              </View>
              {slowestComponents.map((metric, index) => (
                <View
                  key={metric.componentName}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && {
                      backgroundColor: theme.colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Text style={styles.tableCellName} numberOfLines={1}>
                    {metric.componentName}
                  </Text>
                  <Text style={styles.tableCellAvg}>
                    {formatTime(metric.avgRenderTime)}
                  </Text>
                  <Text style={styles.tableCellMax}>
                    {formatTime(metric.maxRenderTime)}
                  </Text>
                  <Text style={styles.tableCellTotal}>
                    {formatTime(metric.totalRenderTime)}
                  </Text>
                  <Text style={styles.tableCellCount}>
                    {metric.renderCount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Slowest Screens */}
        {!!trackScreens && slowestScreens.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Slowest Screen Transitions</Text>
            <Text style={styles.sectionSubtitle}>
              Screens with highest average interactive time
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderName}>Screen</Text>
                <Text style={styles.tableHeaderAvg}>Avg Mount</Text>
                <Text style={styles.tableHeaderMax}>Avg Interactive</Text>
                <Text style={styles.tableHeaderCount}>Count</Text>
              </View>
              {slowestScreens.map((metric, index) => (
                <View
                  key={metric.screenName}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && {
                      backgroundColor: theme.colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Text style={styles.tableCellName} numberOfLines={1}>
                    {metric.screenName}
                  </Text>
                  <Text style={styles.tableCellAvg}>
                    {formatTime(metric.avgMountTime)}
                  </Text>
                  <Text style={styles.tableCellMax}>
                    {formatTime(metric.avgInteractiveTime)}
                  </Text>
                  <Text style={styles.tableCellCount}>
                    {metric.transitionCount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Memory Usage */}
        {!!trackMemory && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Memory Usage</Text>
            {!!latestMemorySnapshot && (
              <>
                <Text style={styles.sectionSubtitle}>Current</Text>
                <View style={styles.startupCard}>
                  <View style={styles.startupRow}>
                    <Text style={styles.startupLabel}>Used</Text>
                    <Text
                      style={[
                        styles.startupValue,
                        latestMemorySnapshot.usagePercent > 80 && {
                          color: theme.colors.warning,
                        },
                        latestMemorySnapshot.usagePercent > 95 && {
                          color: theme.colors.error,
                        },
                      ]}
                    >
                      {formatMemory(latestMemorySnapshot.usedBytes)}
                      {!!latestMemorySnapshot.limitBytes &&
                        ` / ${formatMemory(latestMemorySnapshot.limitBytes)}`}
                    </Text>
                  </View>
                  <View style={styles.startupRow}>
                    <Text style={styles.startupLabel}>Usage</Text>
                    <Text
                      style={[
                        styles.startupValue,
                        latestMemorySnapshot.usagePercent > 80 && {
                          color: theme.colors.warning,
                        },
                        latestMemorySnapshot.usagePercent > 95 && {
                          color: theme.colors.error,
                        },
                      ]}
                    >
                      {latestMemorySnapshot.usagePercent.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Recent History */}
            {recentMemorySnapshots.length > 0 && (
              <>
                <Text style={styles.memoryHistorySubtitle}>Recent History</Text>
                <View style={styles.memoryList}>
                  {recentMemorySnapshots.map(snapshot => (
                    <View key={snapshot.timestamp} style={styles.memoryItem}>
                      <View style={styles.memoryItemHeader}>
                        <Text style={styles.memoryTime}>
                          {formatTimestamp(snapshot.timestamp)}
                        </Text>
                        <Text
                          style={[
                            styles.memoryUsage,
                            snapshot.usagePercent > 80 && {
                              color: theme.colors.warning,
                            },
                            snapshot.usagePercent > 95 && {
                              color: theme.colors.error,
                            },
                          ]}
                        >
                          {snapshot.usagePercent.toFixed(1)}%
                        </Text>
                      </View>
                      <Text style={styles.memoryDetails}>
                        {formatMemory(snapshot.usedBytes)}
                        {!!snapshot.limitBytes &&
                          ` / ${formatMemory(snapshot.limitBytes)}`}
                        {!!snapshot.context && ` • ${snapshot.context}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!latestMemorySnapshot && (
              <Text style={styles.sectionSubtitle}>
                Waiting for first memory snapshot...
              </Text>
            )}
          </View>
        )}

        {/* Empty State */}
        {!!isEnabled &&
          slowestComponents.length === 0 &&
          slowestScreens.length === 0 &&
          recentMemorySnapshots.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No performance data collected yet.
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Navigate through the app to start collecting metrics.
              </Text>
            </View>
          )}

        {/* Clear Data Button */}
        {(slowestComponents.length > 0 ||
          slowestScreens.length > 0 ||
          recentMemorySnapshots.length > 0) && (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton,
              pressed && { opacity: theme.opacity.pressed },
            ]}
            onPress={handleClearData}
          >
            <Text style={styles.clearButtonText}>Clear Performance Data</Text>
          </Pressable>
        )}
      </ScrollView>
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  notAvailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  notAvailableText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  lastUpdated: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  lastUpdatedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textTertiary,
  },
  metricsSection: {
    marginVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['3'],
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    flex: 2,
  },
  tableHeaderAvg: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
  },
  tableHeaderMax: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
  },
  tableHeaderTotal: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
  },
  tableHeaderCount: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    flex: 0.7,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableCellName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    flex: 2,
  },
  tableCellAvg: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  tableCellMax: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  tableCellTotal: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  tableCellCount: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    flex: 0.7,
    textAlign: 'right',
  },
  memoryHistorySubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['3'],
    marginTop: theme.spacing.md,
  },
  memoryList: {
    gap: theme.spacing['3'],
  },
  memoryItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  memoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  memoryTime: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  memoryUsage: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  memoryDetails: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  clearButton: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xl,
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
  startupCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  startupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  startupLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  startupValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
}));

export default PerformanceDashboard;
