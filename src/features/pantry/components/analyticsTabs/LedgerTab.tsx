import React from 'react';
import { View, ScrollView } from 'react-native';
import { usePreferredCurrency } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { ChartSection } from '#features/pantry/components/analytics/ChartSection';
import { PeriodGranularity } from '#/graphql/generated/schemaTypes';
import {
  AnalyticsSummaryCard,
  GranularityButton,
  OfflineTabState,
  TopItemsBarChart,
  money,
  styles,
} from './shared';
import type { AnalyticsResult, SharedTabProps } from './shared';

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
  const preferredCurrency = usePreferredCurrency();

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
            title={t('labels.totalSpent')}
            value={money(
              ledgerData.costAnalytics.totalSpent,
              preferredCurrency,
            )}
            icon="cash-outline"
            uniProps={theme => ({ color: theme.colors.warning })}
          />
          <AnalyticsSummaryCard
            title={t('labels.avgCostPerUnit')}
            value={money(
              ledgerData.costAnalytics.averageCostPerUnit,
              preferredCurrency,
            )}
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
                    +{period.added}
                  </Text>
                  <Text
                    role="label"
                    tone="accent"
                    align="right"
                    style={styles.periodValue}
                  >
                    -{period.consumed}
                  </Text>
                  <Text
                    role="label"
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
                  <Text role="bodyStrong">
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
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
                  <Text role="bodyStrong">
                    {unit.totalQuantity} {unit.unitSymbol || unit.unitName}
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
