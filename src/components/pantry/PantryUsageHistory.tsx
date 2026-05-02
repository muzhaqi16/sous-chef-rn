import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { UsagePurpose } from '../../graphql/generated/schemaTypes';
import { formatDate } from '#hooks/pantry/usePantryItemTransformation';

const usagePurposeLabels: Record<string, string> = {
  [UsagePurpose.General]: 'Consumed',
  [UsagePurpose.Cooking]: 'Cooking',
  [UsagePurpose.Snack]: 'Snack',
  [UsagePurpose.MealPrep]: 'Meal prep',
  [UsagePurpose.Restock]: 'Restocked',
  [UsagePurpose.Waste]: 'Wasted',
  [UsagePurpose.Gift]: 'Gift',
  [UsagePurpose.Transfer]: 'Transfer',
};

interface UsageRecord {
  id: string;
  usedAt: string;
  quantityUsed: number;
  purpose: string;
  adjustmentReason?: string | null;
  usageUnit?: { symbol?: string | null } | null;
}

interface PantryUsageHistoryProps {
  usageRecords: ReadonlyArray<{ node: UsageRecord }>;
  expanded: boolean;
  onToggle: () => void;
}

export const PantryUsageHistory: React.FC<PantryUsageHistoryProps> = ({
  usageRecords,
  expanded,
  onToggle,
}) => {
  if (usageRecords.length === 0) return null;

  return (
    <CollapsibleSection
      title="Usage History"
      count={usageRecords.length}
      expanded={expanded}
      onToggle={onToggle}
    >
      <View style={styles.content}>
        {usageRecords.slice(0, 5).map(({ node: usage }) => {
          const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
          const isRestock = usage.purpose === UsagePurpose.Restock;
          const purposeLabel = isAdjustment
            ? 'Inventory adjusted'
            : usagePurposeLabels[usage.purpose] ?? usage.purpose;
          const quantityPrefix = isAdjustment
            ? usage.quantityUsed >= 0
              ? '+'
              : ''
            : isRestock
            ? '+'
            : '-';

          return (
            <View key={usage.id} style={styles.row}>
              <View style={styles.dateStore}>
                <Text style={styles.date}>{formatDate(usage.usedAt)}</Text>
                {!!purposeLabel && (
                  <Text
                    style={[
                      styles.store,
                      isAdjustment && styles.adjustmentPurpose,
                    ]}
                  >
                    {purposeLabel}
                  </Text>
                )}
                {!!isAdjustment && !!usage.adjustmentReason && (
                  <Text style={styles.adjustmentReason}>
                    {usage.adjustmentReason}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.quantity,
                  isAdjustment && styles.adjustmentQuantity,
                ]}
              >
                {quantityPrefix}
                {usage.quantityUsed}
                {usage.usageUnit?.symbol ? ` ${usage.usageUnit.symbol}` : ''}
              </Text>
            </View>
          );
        })}
        {usageRecords.length > 5 && (
          <Text style={styles.moreEntries}>
            +{usageRecords.length - 5} more entries
          </Text>
        )}
      </View>
    </CollapsibleSection>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  dateStore: {
    flex: 1,
  },
  date: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  store: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  quantity: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  moreEntries: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  adjustmentPurpose: {
    color: theme.colors.info,
  },
  adjustmentReason: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    marginTop: 1,
  },
  adjustmentQuantity: {
    color: theme.colors.info,
  },
}));
