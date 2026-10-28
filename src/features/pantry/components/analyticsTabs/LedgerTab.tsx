import React from 'react';
import { View, ScrollView } from 'react-native';
import { UNKNOWN_AMOUNT } from '#/utils/formatters/number';
import { moneyByCurrency } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { ChartSection } from '#features/pantry/components/analytics/ChartSection';
import { PeriodGranularity } from '#/graphql/generated/schemaTypes';
import { safeParseDate } from '#utils/dateUtils';
import { formatMonthDay, formatMonthYear } from '#/utils/formatters/date';
import {
  formatQuantityDisplay,
  formatQuantityForDisplay,
} from '#/utils/formatQuantity';
import {
  AnalyticsSummaryCard,
  GranularityButton,
  OfflineTabState,
  TopItemsBarChart,
  money,
  styles,
} from './shared';
import type { AnalyticsResult, SharedTabProps } from './shared';

/**
 * `periodLabel` is the server's UTC bucket key (`2026-09-14`, `2026-09`), so it
 * is parsed as a local calendar date and formatted in the interface language.
 */
const formatPeriod = (
  label: string,
  granularity: PeriodGranularity,
): string => {
  const date = safeParseDate(label);
  if (!date) return '';
  return granularity === PeriodGranularity.Monthly
    ? formatMonthYear(date)
    : formatMonthDay(date);
};

/** The pantry analytics tab for every movement, as a running log. */
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
  const showsCost = useBudgetAndPricesEnabled();
  const costAnalytics = showsCost ? ledgerData?.costAnalytics : null;
  // One average per currency AND unit: a kilogram and a piece do not average.
  const unitCosts = costAnalytics?.averageCostPerUnit ?? [];
  const [onlyUnitCost] = unitCosts.length === 1 ? unitCosts : [];

  const ledgerPeriodData =
    ledgerData?.periodData.map(period => ({
      date: formatPeriod(period.periodLabel, ledgerGranularity),
      added: period.added,
      consumed: period.consumed,
      wasted: period.wasted,
      net: period.net,
    })) ?? [];
  const topRestockedItemsData =
    ledgerData?.topRestockedItems.map(item => ({
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
      label: t('labels.weekly'),
    },
    {
      value: PeriodGranularity.Monthly,
      label: t('labels.monthly'),
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
        <PlainScrollRefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Granularity Selector */}
      <View style={styles.granularityRow}>
        <Text role="label" tone="secondary">
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
          value={formatQuantityForDisplay(ledgerData?.summary.totalAdded ?? 0)}
          icon="add-circle-outline"
          uniProps={theme => ({ color: theme.colors.success })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.consumed')}
          value={formatQuantityForDisplay(
            ledgerData?.summary.totalConsumed ?? 0,
          )}
          icon="restaurant"
          uniProps={theme => ({ color: theme.colors.primary })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
      </View>

      <View style={styles.summaryRow}>
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.wasted')}
          value={formatQuantityForDisplay(ledgerData?.summary.totalWasted ?? 0)}
          icon="trash-outline"
          uniProps={theme => ({ color: theme.colors.error })}
          subtitle={t('pantryAnalytics.totalQuantity')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.netChange')}
          value={formatQuantityForDisplay(ledgerData?.summary.netQuantity ?? 0)}
          icon="trending-up"
          uniProps={theme => ({
            color:
              (ledgerData?.summary.netQuantity ?? 0) >= 0
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
          value={ledgerData?.summary.additionCount ?? 0}
          icon="add-circle-outline"
          subtitle={t('pantryAnalytics.transactions')}
        />
        <AnalyticsSummaryCard
          title={t('pantryAnalytics.consumptions')}
          value={ledgerData?.summary.consumptionCount ?? 0}
          icon="remove-circle-outline"
          subtitle={t('pantryAnalytics.transactions')}
        />
      </View>

      {/* Cost Analytics */}
      {!!costAnalytics && (
        <View style={styles.summaryRow}>
          <AnalyticsSummaryCard
            title={t('labels.totalSpent')}
            // No costed restock in the period is an unknown spend, never zero.
            value={moneyByCurrency(costAnalytics.totalSpent) ?? UNKNOWN_AMOUNT}
            icon="cash-outline"
            uniProps={theme => ({ color: theme.colors.warning })}
          />
          {!!onlyUnitCost && (
            <AnalyticsSummaryCard
              title={t('labels.avgCostPerUnit')}
              value={money(onlyUnitCost.amount, onlyUnitCost.currencyCode)}
              icon="calculator-outline"
              uniProps={theme => ({ color: theme.colors.warning })}
              subtitle={
                onlyUnitCost.unitSymbol
                  ? t('pantryAnalytics.perUnit', {
                      unit: onlyUnitCost.unitSymbol,
                    })
                  : undefined
              }
            />
          )}
        </View>
      )}

      {unitCosts.length > 1 && (
        <ChartSection
          title={t('labels.avgCostPerUnit')}
          loading={ledgerLoading}
          error={ledgerError}
          isEmpty={false}
        >
          <View style={styles.unitBreakdownList}>
            {unitCosts.map(cost => (
              <View
                key={`${cost.currencyCode}:${cost.unitSymbol ?? ''}`}
                style={styles.unitBreakdownItem}
              >
                <Text role="bodyStrong">
                  {money(cost.amount, cost.currencyCode)}
                </Text>
                {!!cost.unitSymbol && (
                  <Text role="caption" tone="secondary">
                    {t('pantryAnalytics.perUnit', { unit: cost.unitSymbol })}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ChartSection>
      )}

      {/* Period Breakdown Chart */}
      <ChartSection
        title={t('pantryAnalytics.activityOverTime')}
        loading={ledgerLoading}
        error={ledgerError}
        isEmpty={!ledgerPeriodData.length}
      >
        <View style={styles.periodLegend}>
          <View style={styles.legendItem}>
            <View style={styles.legendDotSuccess} />
            <Text role="caption" tone="secondary">
              {t('pantryAnalytics.added')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotPrimary} />
            <Text role="caption" tone="secondary">
              {t('pantryAnalytics.consumed')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDotError} />
            <Text role="caption" tone="secondary">
              {t('pantryAnalytics.wasted')}
            </Text>
          </View>
        </View>
        {ledgerPeriodData.length > 0 && (
          <View style={styles.periodDataList}>
            {ledgerPeriodData.slice(0, 7).map((period, index) => (
              <View key={index} style={styles.periodRow}>
                <Text role="caption" style={styles.periodLabel}>
                  {period.date}
                </Text>
                <View style={styles.periodValues}>
                  <Text
                    role="label"
                    tone="success"
                    align="right"
                    style={styles.periodValue}
                  >
                    +{formatQuantityForDisplay(period.added)}
                  </Text>
                  <Text
                    role="label"
                    tone="accent"
                    align="right"
                    style={styles.periodValue}
                  >
                    -{formatQuantityForDisplay(period.consumed)}
                  </Text>
                  <Text
                    role="label"
                    tone="danger"
                    align="right"
                    style={styles.periodValue}
                  >
                    -{formatQuantityForDisplay(period.wasted)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ChartSection>

      {/* Unit Breakdown - Additions */}
      {!!ledgerData && ledgerData.summary.additionsByUnit.length > 0 && (
        <ChartSection
          title={t('pantryAnalytics.additionsByUnit')}
          loading={ledgerLoading}
          error={ledgerError}
          isEmpty={false}
        >
          <View style={styles.unitBreakdownList}>
            {ledgerData.summary.additionsByUnit.map((unit, index) => (
              <View key={unit.unitId || index} style={styles.unitBreakdownItem}>
                <Text role="bodyStrong">
                  {formatQuantityDisplay(
                    unit.totalQuantity,
                    unit.unitSymbol || unit.unitName,
                  )}
                </Text>
                <Text role="caption" tone="secondary">
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
      {!!ledgerData && ledgerData.summary.consumptionByUnit.length > 0 && (
        <ChartSection
          title={t('pantryAnalytics.consumptionByUnit')}
          loading={ledgerLoading}
          error={ledgerError}
          isEmpty={false}
        >
          <View style={styles.unitBreakdownList}>
            {ledgerData.summary.consumptionByUnit.map((unit, index) => (
              <View key={unit.unitId || index} style={styles.unitBreakdownItem}>
                <Text role="bodyStrong">
                  {formatQuantityDisplay(
                    unit.totalQuantity,
                    unit.unitSymbol || unit.unitName,
                  )}
                </Text>
                <Text role="caption" tone="secondary">
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
        error={ledgerError}
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
