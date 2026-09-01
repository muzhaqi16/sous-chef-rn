import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';

export interface UsageRecord {
  id: string;
  usedAt: string;
  quantityUsed: number;
  purpose: string;
  adjustmentReason?: string | null;
  usageUnit?: { symbol?: string | null } | null;
}

/** One ledger line, shared by the detail summary and the full-history screen. */
export const UsageHistoryRow: React.FC<{ usage: UsageRecord }> = ({
  usage,
}) => {
  const { t } = useTranslation();

  const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
  const isRestock = usage.purpose === UsagePurpose.Restock;
  // Falls back to the raw value for a purpose the server has but this client's
  // enum predates; `enumKeyCoverage.test.ts` guards the members we do know.
  const purposeLabel = t(`usagePurpose.${usage.purpose}`, usage.purpose);
  const quantityPrefix = isAdjustment
    ? usage.quantityUsed >= 0
      ? '+'
      : ''
    : isRestock
    ? '+'
    : '-';

  return (
    <View style={styles.row}>
      <View style={styles.dateStore}>
        <Text size="base" weight="medium">
          {formatDate(usage.usedAt)}
        </Text>
        {!!purposeLabel && (
          <Text
            size="sm"
            tone={isAdjustment ? undefined : 'secondary'}
            style={[styles.store, isAdjustment && styles.adjustmentPurpose]}
          >
            {purposeLabel}
          </Text>
        )}
        {!!isAdjustment && !!usage.adjustmentReason && (
          <Text size="xs" tone="tertiary" style={styles.adjustmentReason}>
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
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  dateStore: {
    flex: 1,
  },
  store: {
    marginTop: theme.spacing.xs,
  },
  adjustmentPurpose: {
    color: theme.colors.warning,
  },
  adjustmentReason: {
    marginTop: theme.spacing.xs,
  },
  adjustmentQuantity: {
    color: theme.colors.warning,
  },
}));
