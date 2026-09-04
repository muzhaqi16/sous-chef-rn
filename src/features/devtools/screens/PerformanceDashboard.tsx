import React from 'react';
import { View, ScrollView } from 'react-native';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { useTranslation } from '#/i18n';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { Environment } from '#/utils/environment';
import { useCanAccessDevTools } from '#store/useAppStore';
import { Text } from '#components/atoms/Text';
import { usePerformanceDashboard } from '#features/devtools/hooks/usePerformanceDashboard';
import { formatTimestamp } from '#features/devtools/utils/formatMetrics';
import { styles } from '#features/devtools/components/dashboardStyles';
import { TrackingCard } from '#features/devtools/components/TrackingCard';
import { FpsCard } from '#features/devtools/components/FpsCard';
import { StartupCard } from '#features/devtools/components/StartupCard';
import { HttpCard } from '#features/devtools/components/HttpCard';
import { SlowestComponentsCard } from '#features/devtools/components/SlowestComponentsCard';
import { SlowestScreensCard } from '#features/devtools/components/SlowestScreensCard';
import { MemoryCard } from '#features/devtools/components/MemoryCard';
import { EmptyState } from '#components/molecules/EmptyState';

export const PerformanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const canAccessDevTools = useCanAccessDevTools();
  const {
    refreshing,
    lastUpdated,
    isEnabled,
    trackRenders,
    trackMemory,
    trackScreens,
    slowestComponents,
    slowestScreens,
    recentMemorySnapshots,
    startupMetrics,
    recentHttpRequests,
    onRefresh,
    onClearData,
  } = usePerformanceDashboard();

  if (!Environment.shouldEnableDebugFeatures() && !canAccessDevTools) {
    return (
      <ProfileScreenWrapper title={t('labels.performanceDashboard')}>
        <View style={styles.notAvailableContainer}>
          <Text tone="secondary" align="center">
            {t('performance.notAvailable')}
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  const hasData =
    slowestComponents.length > 0 ||
    slowestScreens.length > 0 ||
    recentMemorySnapshots.length > 0;

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
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.lastUpdated}>
          <Text role="caption" tone="tertiary">
            {t('performance.lastUpdated', {
              time: formatTimestamp(lastUpdated),
            })}
          </Text>
        </View>

        <TrackingCard />

        {!!__DEV__ && <FpsCard />}
        <StartupCard metrics={startupMetrics} />
        <HttpCard requests={recentHttpRequests} />
        {!!trackRenders && (
          <SlowestComponentsCard metrics={slowestComponents} />
        )}
        {!!trackScreens && <SlowestScreensCard metrics={slowestScreens} />}
        {!!trackMemory && <MemoryCard snapshots={recentMemorySnapshots} />}

        {!!isEnabled && !hasData && (
          <EmptyState
            title={t('performance.noDataYet')}
            description={t('performance.noDataSubtitle')}
          />
        )}

        {!!hasData && (
          <AppPressable style={styles.clearButton} onPress={onClearData}>
            <Text role="bodyStrong" style={styles.clearButtonText}>
              {t('performance.clearData')}
            </Text>
          </AppPressable>
        )}
      </ScrollView>
    </ProfileScreenWrapper>
  );
};

export default PerformanceDashboard;
