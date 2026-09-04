import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { AnalyticsSummaryCard as BaseAnalyticsSummaryCard } from '#features/pantry/components/analytics/AnalyticsSummaryCard';
import { EmptyState } from '#components/molecules/EmptyState';
import { TrendLineChart as BaseTrendLineChart } from '#features/pantry/components/charts/TrendLineChart';
import { TopItemsBarChart as BaseTopItemsBarChart } from '#features/pantry/components/charts/TopItemsBarChart';
import type { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import type { Translate } from '#/i18n/types';

// Wrapped only so `uniProps` type-checks at the call sites; no static theme
// mapping — every theme read happens via `uniProps={t => ({ … })}`.
export const TrendLineChart = withUnistyles(BaseTrendLineChart);
import { formatCurrency } from '#/utils/formatters/number';
export const TopItemsBarChart = withUnistyles(BaseTopItemsBarChart);
/**
 * An amount nobody recorded reads as an em dash, as InfoRow does. Module scope,
 * so the currency is passed in — a caller resolves it with `useMoney`.
 */
export const money = (
  amount: number | null | undefined,
  currency: string,
): string => formatCurrency(amount, currency);

export const AnalyticsSummaryCard = withUnistyles(BaseAnalyticsSummaryCard);

export type AnalyticsResult = ReturnType<typeof usePantryAnalytics>;

export interface SharedTabProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function formatPurpose(purpose: string, t: Translate): string {
  const map: Record<string, string> = {
    ADJUSTMENT: 'pantryAnalytics.purposeAdjustment',
    COOKING: 'pantryAnalytics.purposeCooking',
    GENERAL: 'labels.general',
    GIFT: 'usagePurpose.GIFT',
    MEAL_PREP: 'labels.mealPrep',
    RESTOCK: 'pantryAnalytics.purposeRestock',
    SNACK: 'usagePurpose.SNACK',
    TRANSFER: 'pantryAnalytics.purposeTransfer',
    WASTE: 'pantryAnalytics.purposeWaste',
  };
  return map[purpose] ? t(map[purpose]) : purpose;
}

export function formatSource(source: string, t: Translate): string {
  const map: Record<string, string> = {
    MANUAL: 'pantryAnalytics.sourceManual',
    RECIPE_AUTO: 'pantryAnalytics.sourceRecipeAuto',
    RECIPE_MANUAL: 'pantryAnalytics.sourceRecipeManual',
    TRANSFER: 'pantryAnalytics.purposeTransfer',
    WASTE: 'pantryAnalytics.purposeWaste',
  };
  return map[source] ? t(map[source]) : source;
}

export function formatReason(reason: string, t: Translate): string {
  const map: Record<string, string> = {
    BURNT: 'pantryAnalytics.reasonBurnt',
    COOKING_FAIL: 'labels.cookingFail',
    EXPIRED: 'pantryAnalytics.reasonExpired',
    GAVE_AWAY: 'labels.gaveAway',
    MOLD: 'labels.mold',
    OTHER: 'itemType.OTHER',
    OVERSTOCK: 'labels.overstock',
    PEST: 'labels.pest',
    SPILLED: 'pantryAnalytics.reasonSpilled',
    SPOILED: 'pantryAnalytics.reasonSpoiled',
    TASTE: 'pantryAnalytics.reasonTaste',
    UNKNOWN_LOSS: 'labels.unknownLoss',
  };
  return map[reason] ? t(map[reason]) : reason;
}

/**
 * Extracted so `styles.useVariants({ active })` runs per instance — calling it
 * inside a `.map` mutates shared style state between iterations.
 */
export const GranularityButton: React.FC<{
  label: string;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, isActive, onPress }) => {
  styles.useVariants({ active: isActive });
  return (
    <AppPressable onPress={onPress} style={styles.granularityButton}>
      <Text
        role="label"
        tone={isActive ? undefined : 'secondary'}
        style={isActive ? styles.granularityButtonTextActive : undefined}
      >
        {label}
      </Text>
    </AppPressable>
  );
};

/**
 * Offline with nothing cached for the current filters. One notice per tab, not
 * one per chart, and inside the ScrollView so pull-to-refresh — the retry —
 * stays reachable.
 */
export const OfflineTabState: React.FC<SharedTabProps> = ({
  refreshing,
  onRefresh,
}) => {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.offlineContent}
      refreshControl={
        <PlainScrollRefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
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

export const styles = StyleSheet.create(theme => ({
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  // Standalone, not composed with `tabScrollContent`: two `styles.*` on one
  // element breaks the Unistyles v3 proxy.
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
    color: theme.colors.onPrimary,
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
    borderBottomWidth: theme.borderWidth.hairline,
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
}));
