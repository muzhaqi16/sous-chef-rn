import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { UsagePurpose } from '#generated';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';

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
                <Text size="base" weight="medium">
                  {formatDate(usage.usedAt)}
                </Text>
                {!!purposeLabel && (
                  <Text
                    size="sm"
                    tone={isAdjustment ? undefined : 'secondary'}
                    style={[
                      styles.store,
                      isAdjustment && styles.adjustmentPurpose,
                    ]}
                  >
                    {purposeLabel}
                  </Text>
                )}
                {!!isAdjustment && !!usage.adjustmentReason && (
                  <Text
                    size="xs"
                    tone="tertiary"
                    style={styles.adjustmentReason}
                  >
                    {usage.adjustmentReason}
                  </Text>
                )}
              </View>
              <Text
                size="base"
                weight="semibold"
                style={isAdjustment ? styles.adjustmentQuantity : undefined}
              >
                {quantityPrefix}
                {usage.quantityUsed}
                {usage.usageUnit?.symbol ? ` ${usage.usageUnit.symbol}` : ''}
              </Text>
            </View>
          );
        })}
        {usageRecords.length > 5 && (
          <Text size="sm" tone="secondary" style={styles.moreEntries}>
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
  store: {
    marginTop: 2,
  },
  moreEntries: {
    fontStyle: 'italic',
  },
  adjustmentPurpose: {
    color: theme.colors.info,
  },
  adjustmentReason: {
    marginTop: 1,
  },
  adjustmentQuantity: {
    color: theme.colors.info,
  },
}));
