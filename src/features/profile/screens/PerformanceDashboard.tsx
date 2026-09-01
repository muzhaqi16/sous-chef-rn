import React, { useState, useEffect } from 'react';
import { View, ScrollView, type StyleProp, type TextStyle } from 'react-native';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { usePerformanceStore } from '#/store/performanceStore';
import { Environment } from '#/utils/environment';
import { useCanAccessDevTools } from '#store/useAppStore';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { useFPSMonitor } from '#/hooks/performance/useFPSMonitor';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import performance from 'react-native-performance';
import { Text } from '#components/atoms/Text';

/**
 * Isolated FPS display component.
 * Owns its own useFPSMonitor call so that FPS state updates (10/sec)
 * only re-render this small card — not the entire dashboard with its
 * table sorts and IIFE recomputations.
 */
const FPSSection: React.FC = () => {
  const { t } = useTranslation();
  const { fps, isLowFPS, stats: fpsStats } = useFPSMonitor();

  return (
    <View style={styles.metricsSection}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('performance.liveFps')}
      </Text>
      <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
        {t('performance.fpsSubtitle')}
      </Text>
      <View style={styles.startupCard}>
        <View style={styles.startupRow}>
          <Text size="sm" tone="secondary">
            {t('performance.currentFps')}
          </Text>
          <Text
            size="md"
            weight="semibold"
            tone={isLowFPS ? 'error' : undefined}
          >
            {fps}
          </Text>
        </View>
        <View style={styles.startupRow}>
          <Text size="sm" tone="secondary">
            {t('performance.minAvgMax')}
          </Text>
          <Text size="md" weight="semibold">
            {fpsStats.min} / {fpsStats.avg} / {fpsStats.max}
          </Text>
        </View>
        <View style={styles.startupRow}>
          <Text size="sm" tone="secondary">
            {t('performance.lowFpsEvents')}
          </Text>
          <Text
            size="md"
            weight="semibold"
            tone={fpsStats.lowFPSCount > 0 ? 'warning' : undefined}
          >
            {fpsStats.lowFPSCount}
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Alternating-row container for tables. Uses variants so the alt-row
 * background color stays in the stylesheet (parent does not need useUnistyles).
 */
const ZebraTableRow: React.FC<{
  alt: boolean;
  children: React.ReactNode;
}> = ({ alt, children }) => {
  styles.useVariants({ alt });
  return <View style={styles.tableRow}>{children}</View>;
};

/**
 * Threshold-colored text used by the memory rows. Variants encapsulate the
 * theme reads so the parent screen does not need useUnistyles.
 */
const ThresholdText: React.FC<{
  children: React.ReactNode;
  usagePercent: number;
  size?: 'md';
  weight?: 'semibold' | 'bold';
  baseStyle?: StyleProp<TextStyle>;
}> = ({ children, usagePercent, weight = 'semibold', baseStyle }) => {
  const tone =
    usagePercent > 95 ? 'error' : usagePercent > 80 ? 'warning' : undefined;
  return (
    <Text size="md" weight={weight} tone={tone} style={baseStyle}>
      {children}
    </Text>
  );
};

export const PerformanceDashboard: React.FC = () => {
  const { t } = useTranslation();
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

  // Read so the IIFEs below recompute on interval / pull-to-refresh.
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
      <ProfileScreenWrapper title={t('labels.performanceDashboard')}>
        <View style={styles.notAvailableContainer}>
          <Text size="md" tone="secondary" align="center">
            {t('performance.notAvailable')}
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper
      title={t('labels.performanceDashboard')}
      scrollEnabled={false}
    >
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <PlainScrollRefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Last Updated */}
        <View style={styles.lastUpdated}>
          <Text size="xs" tone="tertiary">
            {t('performance.lastUpdated', {
              time: formatTimestamp(lastUpdated),
            })}
          </Text>
        </View>

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

        {/* FPS Monitor (DEV only) — isolated component to avoid 10/sec re-renders of parent */}
        {!!__DEV__ && <FPSSection />}

        {/* Startup Metrics */}
        {(startupMetrics.nativeLaunch !== null ||
          startupMetrics.bundleLoad !== null) && (
          <View style={styles.metricsSection}>
            <Text size="lg" weight="semibold" style={styles.sectionTitle}>
              {t('performance.startupMetrics')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
              {t('performance.startupMetricsSubtitle')}
            </Text>
            <View style={styles.startupCard}>
              {startupMetrics.nativeLaunch !== null && (
                <View style={styles.startupRow}>
                  <Text size="sm" tone="secondary">
                    {t('performance.nativeLaunch')}
                  </Text>
                  <Text size="md" weight="semibold">
                    {formatTime(startupMetrics.nativeLaunch)}
                  </Text>
                </View>
              )}
              {startupMetrics.bundleLoad !== null && (
                <View style={styles.startupRow}>
                  <Text size="sm" tone="secondary">
                    {t('performance.jsBundleLoad')}
                  </Text>
                  <Text size="md" weight="semibold">
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
            <Text size="lg" weight="semibold" style={styles.sectionTitle}>
              {t('performance.httpSummary')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
              {t('performance.httpSummarySubtitle', {
                count: recentHttpRequests.length,
              })}
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  style={styles.tableHeaderName}
                >
                  {t('performance.host')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderAvg}
                >
                  {t('performance.duration')}
                </Text>
              </View>
              {recentHttpRequests.map((req, index) => (
                <ZebraTableRow
                  key={`${req.url}-${index}`}
                  alt={index % 2 === 0}
                >
                  <Text
                    size="sm"
                    style={styles.tableCellName}
                    numberOfLines={1}
                  >
                    {req.host}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellAvg}>
                    {formatTime(req.duration)}
                  </Text>
                </ZebraTableRow>
              ))}
            </View>
          </View>
        )}

        {/* Slowest Components */}
        {!!trackRenders && slowestComponents.length > 0 && (
          <View style={styles.metricsSection}>
            <Text size="lg" weight="semibold" style={styles.sectionTitle}>
              {t('performance.slowestComponents')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
              {t('performance.slowestComponentsSubtitle')}
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  style={styles.tableHeaderName}
                >
                  {t('performance.component')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderAvg}
                >
                  {t('performance.avg')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderMax}
                >
                  {t('performance.max')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderTotal}
                >
                  {t('performance.total')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderCount}
                >
                  {t('performance.count')}
                </Text>
              </View>
              {slowestComponents.map((metric, index) => (
                <ZebraTableRow key={metric.componentName} alt={index % 2 === 0}>
                  <Text
                    size="sm"
                    style={styles.tableCellName}
                    numberOfLines={1}
                  >
                    {metric.componentName}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellAvg}>
                    {formatTime(metric.avgRenderTime)}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellMax}>
                    {formatTime(metric.maxRenderTime)}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellTotal}>
                    {formatTime(metric.totalRenderTime)}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellCount}>
                    {metric.renderCount}
                  </Text>
                </ZebraTableRow>
              ))}
            </View>
          </View>
        )}

        {/* Slowest Screens */}
        {!!trackScreens && slowestScreens.length > 0 && (
          <View style={styles.metricsSection}>
            <Text size="lg" weight="semibold" style={styles.sectionTitle}>
              {t('performance.slowestScreens')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
              {t('performance.slowestScreensSubtitle')}
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  style={styles.tableHeaderName}
                >
                  {t('performance.screen')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderAvg}
                >
                  {t('performance.avg')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderMax}
                >
                  {t('performance.max')}
                </Text>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="secondary"
                  align="right"
                  style={styles.tableHeaderCount}
                >
                  {t('performance.count')}
                </Text>
              </View>
              {slowestScreens.map((metric, index) => (
                <ZebraTableRow key={metric.screenName} alt={index % 2 === 0}>
                  <Text
                    size="sm"
                    style={styles.tableCellName}
                    numberOfLines={1}
                  >
                    {metric.screenName}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellAvg}>
                    {formatTime(metric.avgInteractiveTime)}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellMax}>
                    {formatTime(metric.maxInteractiveTime)}
                  </Text>
                  <Text size="sm" align="right" style={styles.tableCellCount}>
                    {metric.transitionCount}
                  </Text>
                </ZebraTableRow>
              ))}
            </View>
          </View>
        )}

        {/* Memory Usage */}
        {!!trackMemory && (
          <View style={styles.metricsSection}>
            <Text size="lg" weight="semibold" style={styles.sectionTitle}>
              {t('performance.memoryUsage')}
            </Text>
            {!!latestMemorySnapshot && (
              <>
                <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
                  {t('performance.current')}
                </Text>
                <View style={styles.startupCard}>
                  <View style={styles.startupRow}>
                    <Text size="sm" tone="secondary">
                      {t('performance.used')}
                    </Text>
                    <ThresholdText
                      usagePercent={latestMemorySnapshot.usagePercent}
                    >
                      {formatMemory(latestMemorySnapshot.usedBytes)}
                      {!!latestMemorySnapshot.limitBytes &&
                        ` / ${formatMemory(latestMemorySnapshot.limitBytes)}`}
                    </ThresholdText>
                  </View>
                  <View style={styles.startupRow}>
                    <Text size="sm" tone="secondary">
                      {t('labels.usage')}
                    </Text>
                    <ThresholdText
                      usagePercent={latestMemorySnapshot.usagePercent}
                    >
                      {latestMemorySnapshot.usagePercent.toFixed(1)}%
                    </ThresholdText>
                  </View>
                </View>
              </>
            )}

            {/* Recent History */}
            {recentMemorySnapshots.length > 0 && (
              <>
                <Text
                  size="sm"
                  tone="secondary"
                  style={styles.memoryHistorySubtitle}
                >
                  {t('performance.recentHistory')}
                </Text>
                <View style={styles.memoryList}>
                  {recentMemorySnapshots.map(snapshot => (
                    <View key={snapshot.timestamp} style={styles.memoryItem}>
                      <View style={styles.memoryItemHeader}>
                        <Text size="sm" weight="semibold">
                          {formatTimestamp(snapshot.timestamp)}
                        </Text>
                        <ThresholdText
                          usagePercent={snapshot.usagePercent}
                          weight="bold"
                          baseStyle={styles.memoryUsage}
                        >
                          {snapshot.usagePercent.toFixed(1)}%
                        </ThresholdText>
                      </View>
                      <Text size="xs" tone="secondary">
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
              <Text size="sm" tone="secondary" style={styles.sectionSubtitle}>
                {t('performance.waitingForSnapshot')}
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
              <Text
                size="md"
                weight="semibold"
                align="center"
                style={styles.emptyStateText}
              >
                {t('performance.noDataYet')}
              </Text>
              <Text size="sm" tone="secondary" align="center">
                {t('performance.noDataSubtitle')}
              </Text>
            </View>
          )}

        {/* Clear Data Button */}
        {(slowestComponents.length > 0 ||
          slowestScreens.length > 0 ||
          recentMemorySnapshots.length > 0) && (
          <AppPressable style={styles.clearButton} onPress={handleClearData}>
            <Text size="md" weight="semibold" style={styles.clearButtonText}>
              {t('performance.clearData')}
            </Text>
          </AppPressable>
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
  lastUpdated: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  metricsSection: {
    marginVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    marginBottom: theme.spacing['3'],
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
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
    textTransform: 'uppercase',
    flex: 2,
  },
  tableHeaderAvg: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderMax: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderTotal: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderCount: {
    textTransform: 'uppercase',
    flex: 0.7,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    variants: {
      alt: {
        true: { backgroundColor: theme.colors.backgroundSecondary },
        false: {},
      },
    },
  },
  tableCellName: {
    flex: 2,
  },
  tableCellAvg: {
    flex: 1,
  },
  tableCellMax: {
    flex: 1,
  },
  tableCellTotal: {
    flex: 1,
  },
  tableCellCount: {
    flex: 0.7,
  },
  memoryHistorySubtitle: {
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
    borderCurve: 'continuous',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  memoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  memoryUsage: {
    color: theme.colors.success,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
  },
  emptyStateText: {
    marginBottom: theme.spacing.sm,
  },
  clearButton: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xl,
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.onError,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  startupCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
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
}));

export default PerformanceDashboard;
