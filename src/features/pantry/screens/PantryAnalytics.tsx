import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import {
  Pressable,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Header } from '#components/molecules/Header';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import { TabView, TabRoute } from '#components/molecules/TabView/TabView';
import { AnalyticsSummaryCard as BaseAnalyticsSummaryCard } from '#components/analytics/AnalyticsSummaryCard';
import { DateRangeFilter } from '#components/analytics/DateRangeFilter';
import { ChartSection } from '#components/analytics/ChartSection';
import { TrendLineChart as BaseTrendLineChart } from '#components/charts/TrendLineChart';
import { BreakdownPieChart } from '#components/charts/BreakdownPieChart';
import { TopItemsBarChart as BaseTopItemsBarChart } from '#components/charts/TopItemsBarChart';
import { PeriodGranularity } from '#/graphql/generated/schemaTypes';
import type { StaticScreenProps } from '@react-navigation/native';
import { Text } from '#components/atoms/Text';

// Wrap chart primitives with withUnistyles so the per-call `uniProps` prop
// (used at consumer sites for theme-derived colors) is recognized at the type
// level. The wrappers themselves declare no static theme mapping — all theme
// reads happen at the call site via `uniProps={t => ({ … })}`.
const TrendLineChart = withUnistyles(BaseTrendLineChart);
const TopItemsBarChart = withUnistyles(BaseTopItemsBarChart);
const AnalyticsSummaryCard = withUnistyles(BaseAnalyticsSummaryCard);

type PantryAnalyticsProps = StaticScreenProps<{
  pantryId: string;
}>;

// Helper functions to format enum values
function formatPurpose(purpose: string): string {
  const map: Record<string, string> = {
    ADJUSTMENT: 'Adjustment',
    COOKING: 'Cooking',
    GENERAL: 'General',
    GIFT: 'Gift',
    MEAL_PREP: 'Meal Prep',
    RESTOCK: 'Restock',
    SNACK: 'Snack',
    TRANSFER: 'Transfer',
    WASTE: 'Waste',
  };
  return map[purpose] || purpose;
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    MANUAL: 'Manual',
    RECIPE_AUTO: 'Recipe (Auto)',
    RECIPE_MANUAL: 'Recipe (Manual)',
    TRANSFER: 'Transfer',
    WASTE: 'Waste',
  };
  return map[source] || source;
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    BURNT: 'Burnt',
    COOKING_FAIL: 'Cooking Fail',
    EXPIRED: 'Expired',
    GAVE_AWAY: 'Gave Away',
    MOLD: 'Mold',
    OTHER: 'Other',
    OVERSTOCK: 'Overstock',
    PEST: 'Pest',
    SPILLED: 'Spilled',
    SPOILED: 'Spoiled',
    TASTE: 'Taste',
    UNKNOWN_LOSS: 'Unknown Loss',
  };
  return map[reason] || reason;
}

/**
 * Granularity selector button. Extracted so `styles.useVariants({ active })`
 * is called per-instance with a consistent variant snapshot — calling
 * `useVariants` inside a `.map` iteration in the parent would mutate shared
 * style state between iterations.
 */
const GranularityButton: React.FC<{
  label: string;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, isActive, onPress }) => {
  styles.useVariants({ active: isActive });
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.granularityButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        size="xs"
        weight="medium"
        tone={isActive ? undefined : 'secondary'}
        style={isActive ? styles.granularityButtonTextActive : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const PantryAnalytics: React.FC<PantryAnalyticsProps> = ({ route }) => {
  const { pantryId } = route.params;
  const { goBack } = useAppNavigation();

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const routes: TabRoute[] = [
    { key: 'usage', title: 'Usage' },
    { key: 'waste', title: 'Waste' },
    { key: 'ledger', title: 'Ledger' },
  ];

  // Transformed data grouped by data source
  const usagePurposeData =
    usageData?.usageByPurpose?.map(item => ({
      label: formatPurpose(item.purpose),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const usageSourceData =
    usageData?.usageBySource?.map(item => ({
      label: formatSource(item.source),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const topUsedItemsData =
    usageData?.topUsedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
    })) ?? [];

  const wasteReasonData =
    wasteData?.wasteByReason?.map(item => ({
      label: formatReason(item.reason),
      value: item.count,
      percentage: item.percentage,
    })) ?? [];
  const topWastedItemsData =
    wasteData?.topWastedItems?.map(item => ({
      label: item.itemName,
      value: item.count,
      secondaryValue: item.estimatedValue ?? undefined,
    })) ?? [];

  const ledgerPeriodData =
    ledgerData?.periodData?.map(period => ({
      date: period.periodLabel || period.periodStart,
      added: period.added,
      consumed: period.consumed,
      wasted: period.wasted,
      net: period.net,
    })) ?? [];
  const topRestockedItemsData =
    ledgerData?.topRestockedItems?.map(item => ({
      label: item.itemName,
      value: item.totalQuantity,
    })) ?? [];

  // Granularity options for ledger
  const granularityOptions = [
    { value: PeriodGranularity.Daily, label: 'Daily' },
    { value: PeriodGranularity.Weekly, label: 'Weekly' },
    { value: PeriodGranularity.Monthly, label: 'Monthly' },
  ];

  const renderUsageTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      refreshControl={
        <ThemedRefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
          uniProps={t => ({ color: t.colors.primary })}
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
        <TopItemsBarChart
          data={topUsedItemsData}
          uniProps={t => ({ color: t.colors.primary })}
        />
      </ChartSection>
    </ScrollView>
  );

  const renderWasteTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      refreshControl={
        <ThemedRefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title="Total Waste"
          value={wasteData?.totalWasteCount ?? 0}
          icon="trash-outline"
          uniProps={t => ({ color: t.colors.error })}
          subtitle="items wasted"
        />
        <AnalyticsSummaryCard
          title="Waste Rate"
          value={`${(wasteData?.wasteRate ?? 0).toFixed(1)}%`}
          icon="pie-chart"
          uniProps={t => ({ color: t.colors.warning })}
          subtitle="of total"
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title="Est. Value Lost"
          value={`$${(wasteData?.totalWasteValue ?? 0).toFixed(2)}`}
          icon="cash-outline"
          uniProps={t => ({ color: t.colors.error })}
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title="Composted"
          value={(wasteData?.composted ?? 0).toFixed(1)}
          icon="leaf-outline"
          uniProps={t => ({ color: t.colors.success })}
          subtitle="units"
        />
        <AnalyticsSummaryCard
          title="Recycled"
          value={(wasteData?.recycled ?? 0).toFixed(1)}
          icon="refresh-outline"
          uniProps={t => ({ color: t.colors.info })}
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
          uniProps={t => ({ color: t.colors.error })}
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
          uniProps={t => ({ color: t.colors.error })}
          showSecondaryValue
          secondaryValuePrefix="$"
        />
      </ChartSection>
    </ScrollView>
  );

  const renderLedgerTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      refreshControl={
        <ThemedRefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* Granularity Selector */}
      <View style={styles.granularityRow}>
        <Text size="sm" tone="secondary" weight="medium">
          Period:
        </Text>
        <View style={styles.granularityButtons}>
          {granularityOptions.map(option => (
            <GranularityButton
              key={option.value}
              label={option.label}
              isActive={ledgerGranularity === option.value}
              onPress={() => setLedgerGranularity(option.value)}
            />
          ))}
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title="Added"
          value={ledgerData?.summary?.totalAdded ?? 0}
          icon="add-circle-outline"
          uniProps={t => ({ color: t.colors.success })}
          subtitle="total quantity"
        />
        <AnalyticsSummaryCard
          title="Consumed"
          value={ledgerData?.summary?.totalConsumed ?? 0}
          icon="restaurant"
          uniProps={t => ({ color: t.colors.primary })}
          subtitle="total quantity"
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title="Wasted"
          value={ledgerData?.summary?.totalWasted ?? 0}
          icon="trash-outline"
          uniProps={t => ({ color: t.colors.error })}
          subtitle="total quantity"
        />
        <AnalyticsSummaryCard
          title="Net Change"
          value={ledgerData?.summary?.netQuantity ?? 0}
          icon="trending-up"
          uniProps={t => ({
            color:
              (ledgerData?.summary?.netQuantity ?? 0) >= 0
                ? t.colors.success
                : t.colors.error,
          })}
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
            uniProps={t => ({ color: t.colors.warning })}
          />
          <AnalyticsSummaryCard
            title="Avg Cost/Unit"
            value={`$${(
              ledgerData.costAnalytics.averageCostPerUnit ?? 0
            ).toFixed(2)}`}
            icon="calculator-outline"
            uniProps={t => ({ color: t.colors.warning })}
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
            <View style={styles.legendDotSuccess} />
            <Text size="xs" tone="secondary">
              Added
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotPrimary} />
            <Text size="xs" tone="secondary">
              Consumed
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotError} />
            <Text size="xs" tone="secondary">
              Wasted
            </Text>
          </View>
        </View>
        {ledgerPeriodData.length > 0 && (
          <View style={styles.periodDataList}>
            {ledgerPeriodData.slice(0, 7).map((period, index) => (
              <View key={index} style={styles.periodRow}>
                <Text size="sm" style={styles.periodLabel}>
                  {period.date}
                </Text>
                <View style={styles.periodValues}>
                  <Text
                    size="sm"
                    weight="medium"
                    tone="success"
                    align="right"
                    style={styles.periodValue}
                  >
                    +{period.added}
                  </Text>
                  <Text
                    size="sm"
                    weight="medium"
                    tone="accent"
                    align="right"
                    style={styles.periodValue}
                  >
                    -{period.consumed}
                  </Text>
                  <Text
                    size="sm"
                    weight="medium"
                    tone="error"
                    align="right"
                    style={styles.periodValue}
                  >
                    -{period.wasted}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ChartSection>

      {/* Unit Breakdown - Additions */}
      {!!ledgerData?.summary?.additionsByUnit &&
        ledgerData.summary.additionsByUnit.length > 0 && (
          <ChartSection
            title="Additions by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.additionsByUnit.map((unit, index) => (
                <View
                  key={unit.unitId || index}
                  style={styles.unitBreakdownItem}
                >
                  <Text size="base" weight="semibold">
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
                  </Text>
                  <Text size="sm" tone="secondary">
                    ({unit.count} transactions)
                  </Text>
                </View>
              ))}
            </View>
          </ChartSection>
        )}

      {/* Unit Breakdown - Consumption */}
      {!!ledgerData?.summary?.consumptionByUnit &&
        ledgerData.summary.consumptionByUnit.length > 0 && (
          <ChartSection
            title="Consumption by Unit"
            loading={ledgerLoading}
            error={ledgerError?.message}
            isEmpty={false}
          >
            <View style={styles.unitBreakdownList}>
              {ledgerData.summary.consumptionByUnit.map((unit, index) => (
                <View
                  key={unit.unitId || index}
                  style={styles.unitBreakdownItem}
                >
                  <Text size="base" weight="semibold">
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
                  </Text>
                  <Text size="sm" tone="secondary">
                    ({unit.count} transactions)
                  </Text>
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
        <TopItemsBarChart
          data={topRestockedItemsData}
          uniProps={t => ({ color: t.colors.success })}
        />
      </ChartSection>
    </ScrollView>
  );

  const renderScene = ({ route: tabRoute }: { route: TabRoute }) => {
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
  };

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
  granularityButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  granularityButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    variants: {
      active: {
        true: { backgroundColor: theme.colors.primary },
        false: { backgroundColor: theme.colors.surface },
      },
    },
  },
  granularityButtonTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
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
  legendDotSuccess: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
  },
  legendDotPrimary: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
  legendDotError: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.error,
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
    flex: 1,
  },
  periodValues: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  periodValue: {
    minWidth: 40,
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
}));
