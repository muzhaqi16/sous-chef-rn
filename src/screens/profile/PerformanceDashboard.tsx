import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingSection } from '#components/settings/SettingSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { usePerformanceStore } from '#/store/performanceStore';
import { Environment } from '#/utils/environment';

export const PerformanceDashboard: React.FC = () => {
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

  const getSlowestComponents = usePerformanceStore(
    state => state.getSlowestComponents,
  );
  const getSlowestScreens = usePerformanceStore(
    state => state.getSlowestScreens,
  );
  const getRecentMemorySnapshots = usePerformanceStore(
    state => state.getRecentMemorySnapshots,
  );
  const clearPerformanceData = usePerformanceStore(
    state => state.clearPerformanceData,
  );

  // Get metrics
  const slowestComponents = getSlowestComponents(10);
  const slowestScreens = getSlowestScreens(10);
  const recentMemorySnapshots = getRecentMemorySnapshots(5);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear Performance Data',
      'Are you sure you want to clear all performance metrics?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearPerformanceData();
          },
        },
      ],
    );
  }, [clearPerformanceData]);

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

  if (!Environment.shouldEnableDebugFeatures()) {
    return (
      <ProfileScreenWrapper title="Performance Dashboard">
        <View style={styles.notAvailableContainer}>
          <Text style={styles.notAvailableText}>
            Performance dashboard is only available in development and staging builds.
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper title="Performance Dashboard">
      <ScrollView style={styles.scrollView}>
        <SettingSection title="Performance Tracking">
          <SettingSwitch
            title="Enable Performance Tracking"
            description="Master switch for all performance monitoring"
            value={isEnabled}
            onValueChange={setPerformanceEnabled}
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
            onValueChange={setTrackMemory}
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

        {/* Slowest Components */}
        {trackRenders && slowestComponents.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Slowest Components</Text>
            <Text style={styles.sectionSubtitle}>
              Components with highest average render time
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.nameColumn]}>
                  Component
                </Text>
                <Text style={[styles.tableHeaderText, styles.avgColumn]}>
                  Avg
                </Text>
                <Text style={[styles.tableHeaderText, styles.maxColumn]}>
                  Max
                </Text>
                <Text style={[styles.tableHeaderText, styles.countColumn]}>
                  Count
                </Text>
              </View>
              {slowestComponents.map((metric, index) => (
                <View
                  key={metric.componentName}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && styles.tableRowEven,
                  ]}
                >
                  <Text
                    style={[styles.tableCell, styles.nameColumn]}
                    numberOfLines={1}
                  >
                    {metric.componentName}
                  </Text>
                  <Text style={[styles.tableCell, styles.avgColumn]}>
                    {formatTime(metric.avgRenderTime)}
                  </Text>
                  <Text style={[styles.tableCell, styles.maxColumn]}>
                    {formatTime(metric.maxRenderTime)}
                  </Text>
                  <Text style={[styles.tableCell, styles.countColumn]}>
                    {metric.renderCount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Slowest Screens */}
        {trackScreens && slowestScreens.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Slowest Screen Transitions</Text>
            <Text style={styles.sectionSubtitle}>
              Screens with highest average interactive time
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.nameColumn]}>
                  Screen
                </Text>
                <Text style={[styles.tableHeaderText, styles.avgColumn]}>
                  Avg Mount
                </Text>
                <Text style={[styles.tableHeaderText, styles.maxColumn]}>
                  Avg Interactive
                </Text>
                <Text style={[styles.tableHeaderText, styles.countColumn]}>
                  Count
                </Text>
              </View>
              {slowestScreens.map((metric, index) => (
                <View
                  key={metric.screenName}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && styles.tableRowEven,
                  ]}
                >
                  <Text
                    style={[styles.tableCell, styles.nameColumn]}
                    numberOfLines={1}
                  >
                    {metric.screenName}
                  </Text>
                  <Text style={[styles.tableCell, styles.avgColumn]}>
                    {formatTime(metric.avgMountTime)}
                  </Text>
                  <Text style={[styles.tableCell, styles.maxColumn]}>
                    {formatTime(metric.avgInteractiveTime)}
                  </Text>
                  <Text style={[styles.tableCell, styles.countColumn]}>
                    {metric.transitionCount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Memory Snapshots */}
        {trackMemory && recentMemorySnapshots.length > 0 && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Recent Memory Snapshots</Text>
            <Text style={styles.sectionSubtitle}>
              Last 5 memory measurements
            </Text>
            <View style={styles.memoryList}>
              {recentMemorySnapshots.map((snapshot, _index) => (
                <View key={snapshot.timestamp} style={styles.memoryItem}>
                  <View style={styles.memoryItemHeader}>
                    <Text style={styles.memoryTime}>
                      {formatTimestamp(snapshot.timestamp)}
                    </Text>
                    <Text
                      style={[
                        styles.memoryUsage,
                        snapshot.usagePercent > 80 && styles.memoryWarning,
                        snapshot.usagePercent > 95 && styles.memoryCritical,
                      ]}
                    >
                      {snapshot.usagePercent.toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={styles.memoryDetails}>
                    {formatMemory(snapshot.usedBytes)}
                    {snapshot.limitBytes &&
                      ` / ${formatMemory(snapshot.limitBytes)}`}
                    {snapshot.context && ` • ${snapshot.context}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {isEnabled &&
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
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearData}
          >
            <Text style={styles.clearButtonText}>Clear Performance Data</Text>
          </TouchableOpacity>
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
  metricsSection: {
    marginVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
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
  tableHeaderText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableRowEven: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  tableCell: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
  },
  nameColumn: {
    flex: 2,
  },
  avgColumn: {
    flex: 1,
    textAlign: 'right',
  },
  maxColumn: {
    flex: 1,
    textAlign: 'right',
  },
  countColumn: {
    flex: 1,
    textAlign: 'right',
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  memoryUsage: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  memoryWarning: {
    color: theme.colors.warning,
  },
  memoryCritical: {
    color: theme.colors.error,
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.white,
  },
}));

export default PerformanceDashboard;
