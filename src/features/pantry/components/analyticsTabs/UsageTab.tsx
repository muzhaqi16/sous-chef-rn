import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from '#/i18n';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { ChartSection } from '#features/pantry/components/analytics/ChartSection';
import { BreakdownPieChart } from '#features/pantry/components/charts/BreakdownPieChart';
import {
  AnalyticsSummaryCard,
  OfflineTabState,
  TopItemsBarChart,
  TrendLineChart,
  formatPurpose,
  formatSource,
  styles,
} from './shared';
import type { AnalyticsResult, SharedTabProps } from './shared';

/** The pantry analytics tab for consumption over time. */
export const UsageTab: React.FC<
  SharedTabProps & {
    usageData: AnalyticsResult['usageData'];
    usageLoading: AnalyticsResult['usageLoading'];
    usageError: AnalyticsResult['usageError'];
    usageOffline: AnalyticsResult['usageOffline'];
  }
> = ({
  usageData,
  usageLoading,
  usageError,
  usageOffline,
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();

  const usagePurposeData =
    usageData?.usageByPurpose?.map(item => ({
      label: formatPurpose(item.purpose, t),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const usageSourceData =
    usageData?.usageBySource?.map(item => ({
      label: formatSource(item.source, t),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const topUsedItemsData =
    usageData?.topUsedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
    })) ?? [];

  if (usageOffline) {
    return <OfflineTabState refreshing={refreshing} onRefresh={onRefresh} />;
  }

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      refreshControl={
        <PlainScrollRefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.totalUsage')}
          value={usageData?.totalUsageCount ?? 0}
          icon="restaurant"
          subtitle={t('pantryAnalytics.itemsUsed')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.avgPerDay')}
          value={(usageData?.averageUsagePerDay ?? 0).toFixed(1)}
          icon="time-outline"
          subtitle={t('pantryAnalytics.itemsPerDay')}
        />
      </View>

      {/* Usage Trend */}
      <ChartSection
        title={t('pantryAnalytics.usageTrend')}
        loading={usageLoading}
        error={usageError?.message}
        isEmpty={!usageData?.usageTrend?.length}
      >
        <TrendLineChart
          data={usageData?.usageTrend ?? []}
          height={200}
          uniProps={theme => ({ color: theme.colors.primary })}
          subtitle={t('pantryAnalytics.usageTrendSubtitle')}
        />
      </ChartSection>

      {/* Usage by Purpose */}
      <ChartSection
        title={t('pantryAnalytics.usageByPurpose')}
        loading={usageLoading}
        error={usageError?.message}
        isEmpty={!usagePurposeData.length}
      >
        <BreakdownPieChart data={usagePurposeData} height={150} />
      </ChartSection>

      {/* Usage by Source */}
      <ChartSection
        title={t('pantryAnalytics.usageBySource')}
        loading={usageLoading}
        error={usageError?.message}
        isEmpty={!usageSourceData.length}
      >
        <BreakdownPieChart data={usageSourceData} height={150} />
      </ChartSection>

      {/* Top Used Items */}
      <ChartSection
        title={t('pantryAnalytics.topUsedItems')}
        loading={usageLoading}
        error={usageError?.message}
        isEmpty={!topUsedItemsData.length}
      >
        <TopItemsBarChart
          data={topUsedItemsData}
          uniProps={theme => ({ color: theme.colors.primary })}
        />
      </ChartSection>
    </ScrollView>
  );
};
