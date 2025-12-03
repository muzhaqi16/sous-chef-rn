import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { commonStyles } from '#styles';
import { useAppNavigation } from '#hooks';
import { usePantryAnalytics } from '#hooks/pantry';
import { TabView, TabRoute } from '#components/molecules/TabView';
import { DateRangeFilter, AnalyticsSummaryCard, ChartSection } from '#components/analytics';
import { TrendLineChart, BreakdownPieChart, TopItemsBarChart } from '#components/charts';
import type { RouteProp } from '@react-navigation/native';
import type { PantryStackParamList } from '#navigation/stacks/PantryStack';

type PantryAnalyticsRouteProp = RouteProp<PantryStackParamList, 'PantryAnalytics'>;

interface PantryAnalyticsProps {
  route: PantryAnalyticsRouteProp;
}

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
    usageLoading,
    wasteLoading,
    usageError,
    wasteError,
    loading,
    dateRange,
    setDateRange,
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
    ],
    [],
  );

  // Memoize transformed data at component level
  const usagePurposeData = useMemo(() => {
    if (!usageData?.usageByPurpose) return [];
    return usageData.usageByPurpose.map(item => ({
      label: formatPurpose(item.purpose),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [usageData?.usageByPurpose]);

  const usageSourceData = useMemo(() => {
    if (!usageData?.usageBySource) return [];
    return usageData.usageBySource.map(item => ({
      label: formatSource(item.source),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [usageData?.usageBySource]);

  const topUsedItemsData = useMemo(() => {
    if (!usageData?.topUsedItems) return [];
    return usageData.topUsedItems.map(item => ({
      label: item.itemName,
      value: item.count,
    }));
  }, [usageData?.topUsedItems]);

  const wasteReasonData = useMemo(() => {
    if (!wasteData?.wasteByReason) return [];
    return wasteData.wasteByReason.map(item => ({
      label: formatReason(item.reason),
      value: item.count,
      percentage: item.percentage,
    }));
  }, [wasteData?.wasteByReason]);

  const topWastedItemsData = useMemo(() => {
    if (!wasteData?.topWastedItems) return [];
    return wasteData.topWastedItems.map(item => ({
      label: item.itemName,
      value: item.count,
      secondaryValue: item.estimatedValue,
    }));
  }, [wasteData?.topWastedItems]);

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
          />
        </ChartSection>

        {/* Usage by Purpose */}
        <ChartSection
          title="Usage by Purpose"
          loading={usageLoading}
          error={usageError?.message}
          isEmpty={!usagePurposeData.length}
        >
          <BreakdownPieChart data={usagePurposeData} height={200} />
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
            height={200}
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
            value={`${((wasteData?.wasteRate ?? 0) * 100).toFixed(1)}%`}
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
            height={200}
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

  const renderScene = useCallback(
    ({ route: tabRoute }: { route: TabRoute }) => {
      switch (tabRoute.key) {
        case 'usage':
          return renderUsageTab();
        case 'waste':
          return renderWasteTab();
        default:
          return null;
      }
    },
    [renderUsageTab, renderWasteTab],
  );

  return (
    <View style={commonStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[commonStyles.title, styles.headerTitle]}>Pantry Analytics</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Date Range Filter */}
      <DateRangeFilter selected={dateRange} onSelect={setDateRange} />

      {/* Tab View */}
      <TabView
        routes={routes}
        renderScene={renderScene}
        onRefresh={handleRefresh}
        refreshing={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    ...commonStyles.rowSpaceBetween,
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
}));
