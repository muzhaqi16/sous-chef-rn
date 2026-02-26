import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Header } from '#components/molecules/Header';
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
    OVERSTOCK: 'Overstock',
    TASTE: 'Taste',
    OTHER: 'Other',
  };
  return map[reason] || reason;
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
    ],
    [],
  );

  // Memoize transformed data grouped by data source
  const { usagePurposeData, usageSourceData, topUsedItemsData } = useMemo(() => ({
    usagePurposeData: usageData?.usageByPurpose?.map(item => ({
      label: formatPurpose(item.purpose),
      value: item.count,
      percentage: item.percentage,
    })) ?? [],
    usageSourceData: usageData?.usageBySource?.map(item => ({
      label: formatSource(item.source),
      value: item.count,
      percentage: item.percentage,
    })) ?? [],
    topUsedItemsData: usageData?.topUsedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
    })) ?? [],
  }), [usageData]);

  const { wasteReasonData, topWastedItemsData } = useMemo(() => ({
    wasteReasonData: wasteData?.wasteByReason?.map(item => ({
      label: formatReason(item.reason),
      value: item.count,
      percentage: item.percentage,
    })) ?? [],
    topWastedItemsData: wasteData?.topWastedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
      secondaryValue: item.estimatedValue ?? undefined,
    })) ?? [],
  }), [wasteData]);

  const { ledgerPeriodData, topRestockedItemsData } = useMemo(() => ({
    ledgerPeriodData: ledgerData?.periodData?.map(period => ({
      date: period.periodLabel || period.periodStart,
      added: period.added,
      consumed: period.consumed,
      wasted: period.wasted,
      net: period.net,
    })) ?? [],
    topRestockedItemsData: ledgerData?.topRestockedItems?.map(item => ({
      label: item.itemName,
      value: item.totalQuantity,
    })) ?? [],
  }), [ledgerData]);

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
            icon="time-outline"
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
            icon="trash-outline"
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
            icon="cash-outline"
            color={theme.colors.error}
          />
          <AnalyticsSummaryCard
            title="Composted"
            value={(wasteData?.composted ?? 0).toFixed(1)}
            icon="leaf-outline"
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
              <TouchableOpacity
                key={option.value}
                onPress={() => setLedgerGranularity(option.value)}
                style={[
                  styles.granularityButton,
                  {
                    backgroundColor:
                      ledgerGranularity === option.value
                        ? theme.colors.primary
                        : theme.colors.surface,
                  },
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
              </TouchableOpacity>
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
            icon="trash-outline"
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
            icon="add-circle-outline"
            subtitle="transactions"
          />
          <AnalyticsSummaryCard
            title="Consumptions"
            value={ledgerData?.summary?.consumptionCount ?? 0}
            icon="remove-circle-outline"
            subtitle="transactions"
          />
        </View>

        {/* Cost Analytics */}
        {!!ledgerData?.costAnalytics && (
          <View style={styles.summaryRow}>
            <AnalyticsSummaryCard
              title="Total Spent"
              value={`$${(ledgerData.costAnalytics.totalSpent ?? 0).toFixed(2)}`}
              icon="cash-outline"
              color={theme.colors.warning}
            />
            <AnalyticsSummaryCard
              title="Avg Cost/Unit"
              value={`$${(ledgerData.costAnalytics.averageCostPerUnit ?? 0).toFixed(2)}`}
              icon="calculator-outline"
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
              {ledgerPeriodData.slice(0, 7).map((period, index) => (
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
        {!!ledgerData?.summary?.additionsByUnit && ledgerData.summary.additionsByUnit.length > 0 && (
          <ChartSection
            title="Additions by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.additionsByUnit.map((unit, index) => (
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
        {!!ledgerData?.summary?.consumptionByUnit && ledgerData.summary.consumptionByUnit.length > 0 && (
          <ChartSection
            title="Consumption by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.consumptionByUnit.map((unit, index) => (
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

  const renderScene = useCallback(
    ({ route: tabRoute }: { route: TabRoute }) => {
      switch (tabRoute.key) {
        case 'usage':
          return renderUsageTab();
        case 'waste':
          return renderWasteTab();
        case 'ledger':
          return renderLedgerTab();
        default:
          return null;
      }
    },
    [renderUsageTab, renderWasteTab, renderLedgerTab],
  );

  return (
    <View style={commonStyles.container}>
      <Header title="Pantry Analytics" onBack={goBack} centerTitle />

      {/* Date Range Filter */}
      <DateRangeFilter selected={dateRange} onSelect={setDateRange} />

      {/* Tab View */}
      <TabView routes={routes} renderScene={renderScene} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
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
}));
