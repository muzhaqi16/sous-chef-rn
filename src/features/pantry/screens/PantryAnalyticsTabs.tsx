import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { AnalyticsSummaryCard as BaseAnalyticsSummaryCard } from '#components/analytics/AnalyticsSummaryCard';
import { ChartSection } from '#components/analytics/ChartSection';
import { EmptyState } from '#components/base/EmptyState';
import { TrendLineChart as BaseTrendLineChart } from '#components/charts/TrendLineChart';
import { BreakdownPieChart } from '#components/charts/BreakdownPieChart';
import { TopItemsBarChart as BaseTopItemsBarChart } from '#components/charts/TopItemsBarChart';
import { PeriodGranularity } from '#/graphql/generated/schemaTypes';
import type { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import type { Translate } from '#/i18n/types';

// Wrap chart primitives with withUnistyles so the per-call `uniProps` prop
// (used at consumer sites for theme-derived colors) is recognized at the type
// level. The wrappers declare no static theme mapping — all theme reads happen
// at the call site via `uniProps={t => ({ … })}`.
const TrendLineChart = withUnistyles(BaseTrendLineChart);
const TopItemsBarChart = withUnistyles(BaseTopItemsBarChart);
const AnalyticsSummaryCard = withUnistyles(BaseAnalyticsSummaryCard);

type AnalyticsResult = ReturnType<typeof usePantryAnalytics>;

interface SharedTabProps {
  refreshing: boolean;
  onRefresh: () => void;
}

// Helper functions to format enum values via translation keys
function formatPurpose(purpose: string, t: Translate): string {
  const map: Record<string, string> = {
    ADJUSTMENT: 'pantryAnalytics.purposeAdjustment',
    COOKING: 'pantryAnalytics.purposeCooking',
    GENERAL: 'pantryAnalytics.purposeGeneral',
    GIFT: 'pantryAnalytics.purposeGift',
    MEAL_PREP: 'pantryAnalytics.purposeMealPrep',
    RESTOCK: 'pantryAnalytics.purposeRestock',
    SNACK: 'pantryAnalytics.purposeSnack',
    TRANSFER: 'pantryAnalytics.purposeTransfer',
    WASTE: 'pantryAnalytics.purposeWaste',
  };
  return map[purpose] ? t(map[purpose]) : purpose;
}

function formatSource(source: string, t: Translate): string {
  const map: Record<string, string> = {
    MANUAL: 'pantryAnalytics.sourceManual',
    RECIPE_AUTO: 'pantryAnalytics.sourceRecipeAuto',
    RECIPE_MANUAL: 'pantryAnalytics.sourceRecipeManual',
    TRANSFER: 'pantryAnalytics.purposeTransfer',
    WASTE: 'pantryAnalytics.purposeWaste',
  };
  return map[source] ? t(map[source]) : source;
}

function formatReason(reason: string, t: Translate): string {
  const map: Record<string, string> = {
    BURNT: 'pantryAnalytics.reasonBurnt',
    COOKING_FAIL: 'pantryAnalytics.reasonCookingFail',
    EXPIRED: 'pantryAnalytics.reasonExpired',
    GAVE_AWAY: 'pantryAnalytics.reasonGaveAway',
    MOLD: 'pantryAnalytics.reasonMold',
    OTHER: 'pantryAnalytics.reasonOther',
    OVERSTOCK: 'pantryAnalytics.reasonOverstock',
    PEST: 'pantryAnalytics.reasonPest',
    SPILLED: 'pantryAnalytics.reasonSpilled',
    SPOILED: 'pantryAnalytics.reasonSpoiled',
    TASTE: 'pantryAnalytics.reasonTaste',
    UNKNOWN_LOSS: 'pantryAnalytics.reasonUnknownLoss',
  };
  return map[reason] ? t(map[reason]) : reason;
}

/**
 * Granularity selector button. Extracted so `styles.useVariants({ active })`
 * is called per-instance with a consistent variant snapshot — calling
 * `useVariants` inside a `.map` iteration would mutate shared style state
 * between iterations.
 */
const GranularityButton: React.FC<{
  label: string;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, isActive, onPress }) => {
  styles.useVariants({ active: isActive });
  return (
    <AppPressable onPress={onPress} style={styles.granularityButton}>
      <Text
        size="xs"
        weight="medium"
        tone={isActive ? undefined : 'secondary'}
        style={isActive ? styles.granularityButtonTextActive : undefined}
      >
        {label}
      </Text>
    </AppPressable>
  );
};

/**
 * Offline with nothing cached for the current filters.
 *
 * One notice per tab, not one per chart: offline is a property of the whole
 * screen, and eleven identical boxes stacked down a scroll view read as eleven
 * separate failures. It stays inside the ScrollView so pull-to-refresh remains
 * reachable — that is the retry, once the connection is back.
 */
const OfflineTabState: React.FC<SharedTabProps> = ({
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.offlineContent}
      refreshControl={
        <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <EmptyState
        icon="cloud-offline-outline"
        title={t('pantryAnalytics.offlineTitle')}
        description={t('pantryAnalytics.offlineDescription')}
        action={{
          label: t('labels.refresh'),
          onPress: onRefresh,
          variant: 'outline',
        }}
      />
    </ScrollView>
  );
};

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
        <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
        <BreakdownPieChart
          data={usageSourceData}
          height={150}
          colorScale={['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
        />
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
        <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
          value={`$${(wasteData?.totalWasteValue ?? 0).toFixed(2)}`}
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
          subtitle={t('pantryAnalytics.units')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.recycled')}
          value={(wasteData?.recycled ?? 0).toFixed(1)}
          icon="refresh-outline"
          uniProps={theme => ({ color: theme.colors.info })}
          subtitle={t('pantryAnalytics.units')}
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
        <BreakdownPieChart
          data={wasteReasonData}
          height={150}
          colorScale={['#E74C3C', '#E67E22', '#F39C12', '#9B59B6', '#3498DB']}
        />
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

export const LedgerTab: React.FC<
  SharedTabProps & {
    ledgerData: AnalyticsResult['ledgerData'];
    ledgerLoading: AnalyticsResult['ledgerLoading'];
    ledgerError: AnalyticsResult['ledgerError'];
    ledgerOffline: AnalyticsResult['ledgerOffline'];
    ledgerGranularity: AnalyticsResult['ledgerGranularity'];
    setLedgerGranularity: AnalyticsResult['setLedgerGranularity'];
  }
> = ({
  ledgerData,
  ledgerLoading,
  ledgerError,
  ledgerOffline,
  ledgerGranularity,
  setLedgerGranularity,
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();

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

  const granularityOptions = [
    {
      value: PeriodGranularity.Daily,
      label: t('pantryAnalytics.granularityDaily'),
    },
    {
      value: PeriodGranularity.Weekly,
      label: t('pantryAnalytics.granularityWeekly'),
    },
    {
      value: PeriodGranularity.Monthly,
      label: t('pantryAnalytics.granularityMonthly'),
    },
  ];

  if (ledgerOffline) {
    return <OfflineTabState refreshing={refreshing} onRefresh={onRefresh} />;
  }

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      refreshControl={
        <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Granularity Selector */}
      <View style={styles.granularityRow}>
        <Text size="sm" tone="secondary" weight="medium">
          {t('pantryAnalytics.period')}
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
          title={t('pantryAnalytics.added')}
          value={ledgerData?.summary?.totalAdded ?? 0}
          icon="add-circle-outline"
          uniProps={theme => ({ color: theme.colors.success })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.consumed')}
          value={ledgerData?.summary?.totalConsumed ?? 0}
          icon="restaurant"
          uniProps={theme => ({ color: theme.colors.primary })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.wasted')}
          value={ledgerData?.summary?.totalWasted ?? 0}
          icon="trash-outline"
          uniProps={theme => ({ color: theme.colors.error })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.netChange')}
          value={ledgerData?.summary?.netQuantity ?? 0}
          icon="trending-up"
          uniProps={theme => ({
            color:
              (ledgerData?.summary?.netQuantity ?? 0) >= 0
                ? theme.colors.success
                : theme.colors.error,
          })}
          subtitle={t('pantryAnalytics.netChangeFormula')}
        />
      </View>

      {/* Transaction Counts */}
      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.additions')}
          value={ledgerData?.summary?.additionCount ?? 0}
          icon="add-circle-outline"
          subtitle={t('pantryAnalytics.transactions')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.consumptions')}
          value={ledgerData?.summary?.consumptionCount ?? 0}
          icon="remove-circle-outline"
          subtitle={t('pantryAnalytics.transactions')}
        />
      </View>

      {/* Cost Analytics */}
      {!!ledgerData?.costAnalytics && (
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title={t('pantryAnalytics.totalSpent')}
            value={`$${(ledgerData.costAnalytics.totalSpent ?? 0).toFixed(2)}`}
            icon="cash-outline"
            uniProps={theme => ({ color: theme.colors.warning })}
          />
          <AnalyticsSummaryCard
            title={t('pantryAnalytics.avgCostPerUnit')}
            value={`$${(
              ledgerData.costAnalytics.averageCostPerUnit ?? 0
            ).toFixed(2)}`}
            icon="calculator-outline"
            uniProps={theme => ({ color: theme.colors.warning })}
          />
        </View>
      )}

      {/* Period Breakdown Chart */}
      <ChartSection
        title={t('pantryAnalytics.activityOverTime')}
        loading={ledgerLoading}
        error={ledgerError?.message}
        isEmpty={!ledgerPeriodData.length}
      >
        <View style={styles.periodLegend}>
          <View style={styles.legendItem}>
            <View style={styles.legendDotSuccess} />
            <Text size="xs" tone="secondary">
              {t('pantryAnalytics.added')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotPrimary} />
            <Text size="xs" tone="secondary">
              {t('pantryAnalytics.consumed')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotError} />
            <Text size="xs" tone="secondary">
              {t('pantryAnalytics.wasted')}
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
            title={t('pantryAnalytics.additionsByUnit')}
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
                    {t('pantryAnalytics.transactionCount', {
                      count: unit.count,
                    })}
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
            title={t('pantryAnalytics.consumptionByUnit')}
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
                    {t('pantryAnalytics.transactionCount', {
                      count: unit.count,
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </ChartSection>
        )}

      {/* Top Restocked Items */}
      <ChartSection
        title={t('pantryAnalytics.topRestockedItems')}
        loading={ledgerLoading}
        error={ledgerError?.message}
        isEmpty={!topRestockedItemsData.length}
      >
        <TopItemsBarChart
          data={topRestockedItemsData}
          uniProps={theme => ({ color: theme.colors.success })}
        />
      </ChartSection>
    </ScrollView>
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
  // Standalone rather than composed with `tabScrollContent` — combining two
  // `styles.*` on one element breaks the Unistyles v3 proxy. Fills the tab so
  // the notice centers, while leaving the ScrollView scrollable enough to
  // trigger pull-to-refresh.
  offlineContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
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
