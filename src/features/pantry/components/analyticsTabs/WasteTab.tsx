import React from 'react';
import { View, ScrollView } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { ChartSection } from '#features/pantry/components/analytics/ChartSection';
import { BreakdownPieChart } from '#features/pantry/components/charts/BreakdownPieChart';
import {
  AnalyticsSummaryCard,
  OfflineTabState,
  TopItemsBarChart,
  TrendLineChart,
  formatReason,
  styles,
} from './shared';
import type { AnalyticsResult, SharedTabProps } from './shared';

/** The pantry analytics tab for what was thrown away. */
export const WasteTab: React.FC<
  SharedTabProps & {
    wasteData: AnalyticsResult['wasteData'];
    wasteLoading: AnalyticsResult['wasteLoading'];
    wasteError: AnalyticsResult['wasteError'];
    wasteOffline: AnalyticsResult['wasteOffline'];
  }
> = ({
  wasteData,
  wasteLoading,
  wasteError,
  wasteOffline,
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const money = useMoney();

  const wasteReasonData =
    wasteData?.wasteByReason?.map(item => ({
      label: formatReason(item.reason, t),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const topWastedItemsData =
    wasteData?.topWastedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
      secondaryValue: item.estimatedValue ?? undefined,
    })) ?? [];

  if (wasteOffline) {
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
          title={t('pantryAnalytics.totalWaste')}
          value={wasteData?.totalWasteCount ?? 0}
          icon="trash-outline"
          uniProps={theme => ({ color: theme.colors.error })}
          subtitle={t('pantryAnalytics.itemsWasted')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.wasteRate')}
          value={`${(wasteData?.wasteRate ?? 0).toFixed(1)}%`}
          icon="pie-chart"
          uniProps={theme => ({ color: theme.colors.warning })}
          subtitle={t('pantryAnalytics.ofTotal')}
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.estValueLost')}
          value={money(wasteData?.totalWasteValue)}
          icon="cash-outline"
          uniProps={theme => ({ color: theme.colors.error })}
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.composted')}
          value={(wasteData?.composted ?? 0).toFixed(1)}
          icon="leaf-outline"
          uniProps={theme => ({ color: theme.colors.success })}
          subtitle={t('labels.units')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.recycled')}
          value={(wasteData?.recycled ?? 0).toFixed(1)}
          icon="refresh-outline"
          uniProps={theme => ({ color: theme.colors.info })}
          subtitle={t('labels.units')}
        />
      </View>

      {/* Waste Trend */}
      <ChartSection
        title={t('pantryAnalytics.wasteTrend')}
        loading={wasteLoading}
        error={wasteError?.message}
        isEmpty={!wasteData?.wasteTrend?.length}
      >
        <TrendLineChart
          data={wasteData?.wasteTrend ?? []}
          height={200}
          uniProps={theme => ({ color: theme.colors.error })}
          subtitle={t('pantryAnalytics.wasteTrendSubtitle')}
        />
      </ChartSection>

      {/* Waste by Reason */}
      <ChartSection
        title={t('pantryAnalytics.wasteByReason')}
        loading={wasteLoading}
        error={wasteError?.message}
        isEmpty={!wasteReasonData.length}
      >
        <BreakdownPieChart data={wasteReasonData} height={150} />
      </ChartSection>

      {/* Top Wasted Items */}
      <ChartSection
        title={t('pantryAnalytics.topWastedItems')}
        loading={wasteLoading}
        error={wasteError?.message}
        isEmpty={!topWastedItemsData.length}
      >
        <TopItemsBarChart
          data={topWastedItemsData}
          uniProps={theme => ({ color: theme.colors.error })}
          showSecondaryValue
          secondaryValuePrefix="$"
        />
      </ChartSection>
    </ScrollView>
  );
};
