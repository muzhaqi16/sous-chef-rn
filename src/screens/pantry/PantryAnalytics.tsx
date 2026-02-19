// TODO: Analytics queries removed from API - this screen is non-functional until replacement endpoints are available
import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { usePantryAnalytics } from '#hooks/pantry/usePantryAnalytics';
import { TabView, TabRoute } from '#components/molecules/TabView/TabView';
import { DateRangeFilter } from '#components/analytics/DateRangeFilter';
import { AnalyticsSummaryCard } from '#components/analytics/AnalyticsSummaryCard';
import { ChartSection } from '#components/analytics/ChartSection';
import { TrendLineChart } from '#components/charts/TrendLineChart';
import { BreakdownPieChart } from '#components/charts/BreakdownPieChart';
import { TopItemsBarChart } from '#components/charts/TopItemsBarChart';
import { PeriodGranularity } from '#generated';
import type { StaticScreenProps } from '@react-navigation/native';

type PantryAnalyticsProps = StaticScreenProps<{
  pantryId: string;
}>;

// Helper functions to format enum values
function formatPurpose(purpose: string): string {
  const map: Record<string, string> = {
    COOKING: 'Cooking',
    MEAL_PREP: 'Meal Prep',
    SNACK: 'Snack',
    GENERAL: 'General',
    GIFT: 'Gift',
    TRANSFER: 'Transfer',
    WASTE: 'Waste',
    ADJUSTMENT: 'Adjustment',
  };
  return map[purpose] || purpose;
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    MANUAL: 'Manual',
    COOKING_LOG: 'Cooking Log',
    MEAL_PLAN: 'Meal Plan',
    RECIPE: 'Recipe',
  };
  return map[source] || source;
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    EXPIRED: 'Expired',
    SPOILED: 'Spoiled',
    MOLD: 'Mold',
    PEST: 'Pest',
    COOKING_FAIL: 'Cooking Fail',
    SPILLED: 'Spilled',
    BURNT: 'Burnt',
    OVERSTOCK: 'Overstock',
    TASTE: 'Taste',
    GAVE_AWAY: 'Gave Away',
    UNKNOWN_LOSS: 'Unknown Loss',
    OTHER: 'Other',
  };
  return map[reason] || reason;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const PantryAnalytics: React.FC<PantryAnalyticsProps> = ({ route }) => {
  const { pantryId } = route.params;
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();

  const {
    usageData,
    wasteData,
    ledgerData,
    usageLoading,
    wasteLoading,
    ledgerLoading,
    usageError,
    wasteError,
    ledgerError,
    dateRange,
    setDateRange,
    ledgerGranularity,
    setLedgerGranularity,
    refetch,
  } = usePantryAnalytics({ pantryId });

  // These analytics endpoints have been removed from the API
  const consumptionRateData = null as any;
  const consumptionRateLoading = false;
  const consumptionRateError = undefined as Error | undefined;
  const restockingFrequencyData = null as any;
  const restockingFrequencyLoading = false;
  const restockingFrequencyError = undefined as Error | undefined;
  const expirationRiskData = null as any;
  const expirationRiskLoading = false;
  const expirationRiskError = undefined as Error | undefined;
  const effectiveUsageRateData = null as any;
  const effectiveUsageRateLoading = false;
  const effectiveUsageRateError = undefined as Error | undefined;

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const routes: TabRoute[] = useMemo(
    () => [
      { key: 'usage', title: 'Usage' },
      { key: 'waste', title: 'Waste' },
      { key: 'ledger', title: 'Ledger' },
      { key: 'insights', title: 'Insights' },
      { key: 'expiring', title: 'Expiring' },
      { key: 'restocking', title: 'Restocking' },
    ],
    [],
  );

  // Memoize transformed data at component level
  const usagePurposeData = useMemo(() => {
    if (!usageData?.usageByPurpose) return [];
    return usageData.usageByPurpose.map((item: any) => ({
      label: formatPurpose(item.purpose),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [usageData?.usageByPurpose]);

  const usageSourceData = useMemo(() => {
    if (!usageData?.usageBySource) return [];
    return usageData.usageBySource.map((item: any) => ({
      label: formatSource(item.source),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [usageData?.usageBySource]);

  const topUsedItemsData = useMemo(() => {
    if (!usageData?.topUsedItems) return [];
    return usageData.topUsedItems.map((item: any) => ({
      label: item.itemName,
      value: item.count,
    }));
  }, [usageData?.topUsedItems]);

  const wasteReasonData = useMemo(() => {
    if (!wasteData?.wasteByReason) return [];
    return wasteData.wasteByReason.map((item: any) => ({
      label: formatReason(item.reason),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [wasteData?.wasteByReason]);

  const topWastedItemsData = useMemo(() => {
    if (!wasteData?.topWastedItems) return [];
    return wasteData.topWastedItems.map((item: any) => ({
      label: item.itemName,
      value: item.count,
      secondaryValue: item.estimatedValue ?? undefined,
    }));
  }, [wasteData?.topWastedItems]);

  // Ledger data transformations
  const ledgerPeriodData = useMemo(() => {
    if (!ledgerData?.periodData) return [];
    return ledgerData.periodData.map((period: any) => ({
      date: period.periodLabel || period.periodStart,
      added: period.added,
      consumed: period.consumed,
      wasted: period.wasted,
      net: period.net,
    }));
  }, [ledgerData?.periodData]);

  const topRestockedItemsData = useMemo(() => {
    if (!ledgerData?.topRestockedItems) return [];
    return ledgerData.topRestockedItems.map((item: any) => ({
      label: item.itemName,
      value: item.totalQuantity,
    }));
  }, [ledgerData?.topRestockedItems]);

  // Granularity options for ledger
  const granularityOptions = useMemo(
    () => [
      { value: PeriodGranularity.Daily, label: 'Daily' },
      { value: PeriodGranularity.Weekly, label: 'Weekly' },
      { value: PeriodGranularity.Monthly, label: 'Monthly' },
    ],
    [],
  );

  const renderUsageTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Total Usage"
            value={usageData?.totalUsageCount ?? 0}
            icon="restaurant"
            subtitle="items used"
          />
          <AnalyticsSummaryCard
            title="Avg Per Day"
            value={(usageData?.averageUsagePerDay ?? 0).toFixed(1)}
            icon="schedule"
            subtitle="items/day"
          />
        </View>

        {/* Usage Trend */}
        <ChartSection
          title="Usage Trend"
          loading={usageLoading}
          error={usageError?.message}
          isEmpty={!usageData?.usageTrend?.length}
        >
          <TrendLineChart
            data={usageData?.usageTrend ?? []}
            height={200}
            color={theme.colors.primary}
            subtitle="Items used over time"
          />
        </ChartSection>

        {/* Usage by Purpose */}
        <ChartSection
          title="Usage by Purpose"
          loading={usageLoading}
          error={usageError?.message}
          isEmpty={!usagePurposeData.length}
        >
          <BreakdownPieChart data={usagePurposeData} height={150} />
        </ChartSection>

        {/* Usage by Source */}
        <ChartSection
          title="Usage by Source"
          loading={usageLoading}
          error={usageError?.message}
          isEmpty={!usageSourceData.length}
        >
          <BreakdownPieChart
            data={usageSourceData}
            height={150}
            colorScale={['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
          />
        </ChartSection>

        {/* Top Used Items */}
        <ChartSection
          title="Top Used Items"
          loading={usageLoading}
          error={usageError?.message}
          isEmpty={!topUsedItemsData.length}
        >
          <TopItemsBarChart data={topUsedItemsData} color={theme.colors.primary} />
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      usageData,
      usageLoading,
      usageError,
      usagePurposeData,
      usageSourceData,
      topUsedItemsData,
    ],
  );

  const renderWasteTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Total Waste"
            value={wasteData?.totalWasteCount ?? 0}
            icon="delete-outline"
            color={theme.colors.error}
            subtitle="items wasted"
          />
          <AnalyticsSummaryCard
            title="Waste Rate"
            value={`${(wasteData?.wasteRate ?? 0).toFixed(1)}%`}
            icon="pie-chart"
            color={theme.colors.warning}
            subtitle="of total"
          />
        </View>

        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Est. Value Lost"
            value={`$${(wasteData?.totalWasteValue ?? 0).toFixed(2)}`}
            icon="attach-money"
            color={theme.colors.error}
          />
          <AnalyticsSummaryCard
            title="Composted"
            value={(wasteData?.composted ?? 0).toFixed(1)}
            icon="eco"
            color={theme.colors.success}
            subtitle="units"
          />
        </View>

        {/* Waste Trend */}
        <ChartSection
          title="Waste Trend"
          loading={wasteLoading}
          error={wasteError?.message}
          isEmpty={!wasteData?.wasteTrend?.length}
        >
          <TrendLineChart
            data={wasteData?.wasteTrend ?? []}
            height={200}
            color={theme.colors.error}
            subtitle="Items wasted over time"
          />
        </ChartSection>

        {/* Waste by Reason */}
        <ChartSection
          title="Waste by Reason"
          loading={wasteLoading}
          error={wasteError?.message}
          isEmpty={!wasteReasonData.length}
        >
          <BreakdownPieChart
            data={wasteReasonData}
            height={150}
            colorScale={['#E74C3C', '#E67E22', '#F39C12', '#9B59B6', '#3498DB']}
          />
        </ChartSection>

        {/* Top Wasted Items */}
        <ChartSection
          title="Top Wasted Items"
          loading={wasteLoading}
          error={wasteError?.message}
          isEmpty={!topWastedItemsData.length}
        >
          <TopItemsBarChart
            data={topWastedItemsData}
            color={theme.colors.error}
            showSecondaryValue
            secondaryValuePrefix="$"
          />
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      theme.colors.error,
      theme.colors.warning,
      theme.colors.success,
      wasteData,
      wasteLoading,
      wasteError,
      wasteReasonData,
      topWastedItemsData,
    ],
  );

  const renderLedgerTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Granularity Selector */}
        <View style={styles.granularityRow}>
          <Text style={styles.granularityLabel}>Period:</Text>
          <View style={styles.granularityButtons}>
            {granularityOptions.map(option => (
              <Pressable
                key={option.value}
                onPress={() => setLedgerGranularity(option.value)}
                style={({pressed}) => [
                  styles.granularityButton,
                  {
                    backgroundColor:
                      ledgerGranularity === option.value
                        ? theme.colors.primary
                        : theme.colors.surface,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.granularityButtonText,
                    {
                      color:
                        ledgerGranularity === option.value
                          ? theme.colors.white
                          : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Added"
            value={ledgerData?.summary?.totalAdded ?? 0}
            icon="add-circle-outline"
            color={theme.colors.success}
            subtitle="total quantity"
          />
          <AnalyticsSummaryCard
            title="Consumed"
            value={ledgerData?.summary?.totalConsumed ?? 0}
            icon="restaurant"
            color={theme.colors.primary}
            subtitle="total quantity"
          />
        </View>

        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Wasted"
            value={ledgerData?.summary?.totalWasted ?? 0}
            icon="delete-outline"
            color={theme.colors.error}
            subtitle="total quantity"
          />
          <AnalyticsSummaryCard
            title="Net Change"
            value={ledgerData?.summary?.netQuantity ?? 0}
            icon="trending-up"
            color={
              (ledgerData?.summary?.netQuantity ?? 0) >= 0
                ? theme.colors.success
                : theme.colors.error
            }
            subtitle="added - used - wasted"
          />
        </View>

        {/* Transaction Counts */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Additions"
            value={ledgerData?.summary?.additionCount ?? 0}
            icon="playlist-add"
            subtitle="transactions"
          />
          <AnalyticsSummaryCard
            title="Consumptions"
            value={ledgerData?.summary?.consumptionCount ?? 0}
            icon="playlist-remove"
            subtitle="transactions"
          />
        </View>

        {/* Cost Analytics */}
        {ledgerData?.costAnalytics && (
          <View style={styles.summaryRow}>
            <AnalyticsSummaryCard
              title="Total Spent"
              value={`$${(ledgerData.costAnalytics.totalSpent ?? 0).toFixed(2)}`}
              icon="attach-money"
              color={theme.colors.warning}
            />
            <AnalyticsSummaryCard
              title="Avg Cost/Unit"
              value={`$${(ledgerData.costAnalytics.averageCostPerUnit ?? 0).toFixed(2)}`}
              icon="calculate"
              color={theme.colors.warning}
            />
          </View>
        )}

        {/* Period Breakdown Chart */}
        <ChartSection
          title="Activity Over Time"
          loading={ledgerLoading}
          error={ledgerError?.message}
          isEmpty={!ledgerPeriodData.length}
        >
          <View style={styles.periodLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
              <Text style={styles.legendText}>Added</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.legendText}>Consumed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.error }]} />
              <Text style={styles.legendText}>Wasted</Text>
            </View>
          </View>
          {ledgerPeriodData.length > 0 && (
            <View style={styles.periodDataList}>
              {ledgerPeriodData.slice(0, 7).map((period: any, index: number) => (
                <View key={index} style={styles.periodRow}>
                  <Text style={styles.periodLabel}>{period.date}</Text>
                  <View style={styles.periodValues}>
                    <Text style={[styles.periodValue, { color: theme.colors.success }]}>
                      +{period.added}
                    </Text>
                    <Text style={[styles.periodValue, { color: theme.colors.primary }]}>
                      -{period.consumed}
                    </Text>
                    <Text style={[styles.periodValue, { color: theme.colors.error }]}>
                      -{period.wasted}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ChartSection>

        {/* Unit Breakdown - Additions */}
        {ledgerData?.summary?.additionsByUnit && ledgerData.summary.additionsByUnit.length > 0 && (
          <ChartSection
            title="Additions by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.additionsByUnit.map((unit: any, index: number) => (
                <View key={unit.unitId || index} style={styles.unitBreakdownItem}>
                  <Text style={styles.unitBreakdownQuantity}>
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
                  </Text>
                  <Text style={styles.unitBreakdownCount}>({unit.count} transactions)</Text>
                </View>
              ))}
            </View>
          </ChartSection>
        )}

        {/* Unit Breakdown - Consumption */}
        {ledgerData?.summary?.consumptionByUnit && ledgerData.summary.consumptionByUnit.length > 0 && (
          <ChartSection
            title="Consumption by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.consumptionByUnit.map((unit: any, index: number) => (
                <View key={unit.unitId || index} style={styles.unitBreakdownItem}>
                  <Text style={styles.unitBreakdownQuantity}>
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
                  </Text>
                  <Text style={styles.unitBreakdownCount}>({unit.count} transactions)</Text>
                </View>
              ))}
            </View>
          </ChartSection>
        )}

        {/* Top Restocked Items */}
        <ChartSection
          title="Top Restocked Items"
          loading={ledgerLoading}
          error={ledgerError?.message}
          isEmpty={!topRestockedItemsData.length}
        >
          <TopItemsBarChart data={topRestockedItemsData} color={theme.colors.success} />
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      theme.colors.success,
      theme.colors.error,
      theme.colors.warning,
      theme.colors.surface,
      theme.colors.white,
      theme.colors.textSecondary,
      ledgerData,
      ledgerLoading,
      ledgerError,
      ledgerPeriodData,
      topRestockedItemsData,
      ledgerGranularity,
      setLedgerGranularity,
      granularityOptions,
    ],
  );

  // Insights tab - consumption rate + effective usage rate
  const renderInsightsTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Avg Daily Use"
            value={
              consumptionRateData && consumptionRateData.length > 0
                ? (
                    consumptionRateData.reduce((sum: any, r: any) => sum + r.averageDailyConsumption, 0) /
                    consumptionRateData.length
                  ).toFixed(1)
                : '0'
            }
            icon="trending-down"
            subtitle="items/day"
          />
          <AnalyticsSummaryCard
            title="Effective Rate"
            value={
              effectiveUsageRateData && effectiveUsageRateData.length > 0
                ? `${(
                    (effectiveUsageRateData.reduce((sum: any, r: any) => sum + r.effectiveRate, 0) /
                      effectiveUsageRateData.length) *
                    100
                  ).toFixed(0)}%`
                : '-'
            }
            icon="pie-chart"
            color={theme.colors.success}
            subtitle="consumed vs wasted"
          />
        </View>

        {/* Consumption Rate List */}
        <ChartSection
          title="Consumption Rate"
          loading={consumptionRateLoading}
          error={consumptionRateError?.message}
          isEmpty={!consumptionRateData?.length}
        >
          <View style={styles.periodDataList}>
            {consumptionRateData?.slice(0, 10).map((item: any, index: number) => (
              <View key={item.itemId || index} style={styles.periodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.periodLabel}>{item.itemName || 'Unknown'}</Text>
                  <Text style={styles.legendText}>
                    {item.averageDailyConsumption.toFixed(2)}/day
                    {item.daysUntilEmpty != null ? ` - ${Math.round(item.daysUntilEmpty)}d left` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ChartSection>

        {/* Effective Usage Rate List */}
        <ChartSection
          title="Effective Usage Rate"
          loading={effectiveUsageRateLoading}
          error={effectiveUsageRateError?.message}
          isEmpty={!effectiveUsageRateData?.length}
        >
          <View style={styles.periodDataList}>
            {effectiveUsageRateData?.slice(0, 10).map((item: any, index: number) => (
              <View key={item.itemId || index} style={styles.periodRow}>
                <Text style={[styles.periodLabel, { flex: 1 }]}>
                  {item.itemName || 'Unknown'}
                </Text>
                <Text
                  style={[
                    styles.periodValue,
                    { color: item.effectiveRate >= 0.8 ? theme.colors.success : item.effectiveRate >= 0.5 ? theme.colors.warning : theme.colors.error },
                  ]}
                >
                  {(item.effectiveRate * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        </ChartSection>

        {/* Top Consumed Items */}
        <ChartSection
          title="Top Consumed Items"
          loading={consumptionRateLoading}
          error={consumptionRateError?.message}
          isEmpty={!consumptionRateData?.length}
        >
          <TopItemsBarChart
            data={(consumptionRateData || []).slice(0, 5).map((item: any) => ({
              label: item.itemName || 'Unknown',
              value: item.averageDailyConsumption,
            }))}
            color={theme.colors.primary}
          />
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      theme.colors.success,
      theme.colors.warning,
      theme.colors.error,
      consumptionRateData,
      consumptionRateLoading,
      consumptionRateError,
      effectiveUsageRateData,
      effectiveUsageRateLoading,
      effectiveUsageRateError,
    ],
  );

  // Expiring tab - expiration risk
  const renderExpiringTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="At Risk"
            value={expirationRiskData?.totalAtRisk ?? 0}
            icon="warning"
            color={theme.colors.warning}
            subtitle={`within ${expirationRiskData?.daysThreshold ?? 7} days`}
          />
        </View>

        {/* Expiring Items List */}
        <ChartSection
          title="Items at Risk"
          loading={expirationRiskLoading}
          error={expirationRiskError?.message}
          isEmpty={!expirationRiskData?.items?.length}
        >
          <View style={styles.periodDataList}>
            {expirationRiskData?.items?.map((item: any, index: number) => {
              const urgencyColor =
                item.daysUntilExpiry <= 2
                  ? theme.colors.error
                  : item.daysUntilExpiry <= 5
                  ? theme.colors.warning
                  : theme.colors.textSecondary;
              return (
                <View key={item.pantryItemId || index} style={styles.periodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.periodLabel}>{item.itemName}</Text>
                    <Text style={styles.legendText}>
                      {item.quantity} {item.unitName || ''}
                    </Text>
                  </View>
                  <Text style={[styles.periodValue, { color: urgencyColor }]}>
                    {item.daysUntilExpiry <= 0
                      ? 'Expired'
                      : `${item.daysUntilExpiry}d`}
                  </Text>
                </View>
              );
            })}
          </View>
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      theme.colors.warning,
      theme.colors.error,
      theme.colors.textSecondary,
      expirationRiskData,
      expirationRiskLoading,
      expirationRiskError,
    ],
  );

  // Restocking tab - restocking frequency
  const renderRestockingTab = useCallback(
    () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title="Avg Restock Interval"
            value={
              restockingFrequencyData && restockingFrequencyData.length > 0
                ? `${(
                    restockingFrequencyData.reduce(
                      (sum: any, r: any) => sum + r.averageDaysBetweenRestocks,
                      0,
                    ) / restockingFrequencyData.length
                  ).toFixed(0)}d`
                : '-'
            }
            icon="autorenew"
            subtitle="days between restocks"
          />
        </View>

        {/* Restocking Frequency List */}
        <ChartSection
          title="Restocking Frequency"
          loading={restockingFrequencyLoading}
          error={restockingFrequencyError?.message}
          isEmpty={!restockingFrequencyData?.length}
        >
          <View style={styles.periodDataList}>
            {restockingFrequencyData?.slice(0, 10).map((item: any, index: number) => (
              <View key={item.itemId || index} style={styles.periodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.periodLabel}>{item.itemName || 'Unknown'}</Text>
                  <Text style={styles.legendText}>
                    {item.totalRestocks} restocks - avg {item.averageDaysBetweenRestocks.toFixed(0)}d apart
                  </Text>
                  {item.lastRestockedAt && (
                    <Text style={styles.legendText}>
                      Last: {formatDate(item.lastRestockedAt)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ChartSection>
      </ScrollView>
    ),
    [
      refreshing,
      handleRefresh,
      theme.colors.primary,
      restockingFrequencyData,
      restockingFrequencyLoading,
      restockingFrequencyError,
    ],
  );

  const renderScene = useCallback(
    ({ route: tabRoute }: { route: TabRoute }) => {
      switch (tabRoute.key) {
        case 'usage':
          return renderUsageTab();
        case 'waste':
          return renderWasteTab();
        case 'ledger':
          return renderLedgerTab();
        case 'insights':
          return renderInsightsTab();
        case 'expiring':
          return renderExpiringTab();
        case 'restocking':
          return renderRestockingTab();
        default:
          return null;
      }
    },
    [renderUsageTab, renderWasteTab, renderLedgerTab, renderInsightsTab, renderExpiringTab, renderRestockingTab],
  );

  return (
    <View style={commonStyles.container}>
      {/* Header */}
      <View style={[commonStyles.rowSpaceBetween, styles.header]}>
        <Pressable
          onPress={goBack}
          style={({pressed}) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[commonStyles.title, styles.headerTitle]}>Pantry Analytics</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Date Range Filter */}
      <DateRangeFilter selected={dateRange} onSelect={setDateRange} />

      {/* Tab View */}
      <TabView routes={routes} renderScene={renderScene} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  placeholder: {
    width: 24,
  },
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  granularityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  granularityLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  granularityButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  granularityButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
  granularityButtonText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
  },
  periodLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
  },
  legendText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  periodDataList: {
    gap: theme.spacing.sm,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  periodLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  periodValues: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  periodValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    minWidth: 40,
    textAlign: 'right',
  },
  unitBreakdownList: {
    gap: theme.spacing.sm,
  },
  unitBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  unitBreakdownQuantity: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  unitBreakdownCount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
