import React from 'react';
import { isTranslationKey, useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';

export interface UsageRecord {
  id: string;
  usedAt: string;
  quantityUsed: number;
  purpose: UsagePurpose;
  adjustmentReason?: string | null;
  usageUnit?: { symbol?: string | null } | null;
}

/**
 * An adjustment's reason is what a person typed, except for the two the server
 * writes itself in English; those render as local copy.
 */
const adjustmentReasonText = (reason: string, t: Translate): string => {
  switch (reason) {
    case 'PANTRY_STACK_PURGED':
      return t('adjustQuantity.systemReason.stackPurged');
    case 'stack merge reconciliation':
      return t('adjustQuantity.systemReason.stackMerged');
    default:
      return reason;
  }
};

/** One ledger line, shared by the detail summary and the full-history screen. */
export const UsageHistoryRow: React.FC<{ usage: UsageRecord }> = ({
  usage,
}) => {
  const { t } = useTranslation();

  const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
  const isRestock = usage.purpose === UsagePurpose.Restock;
  // `string`: the wire can carry a purpose this client's enum predates;
  // `enumKeyCoverage.test.ts` guards the members it does know.
  const purposeKey: string = `usagePurpose.${usage.purpose}`;
  const purposeLabel = isTranslationKey(purposeKey)
    ? t(purposeKey)
    : t('labels.unknown');
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
        <Text role="bodyStrong">{formatDate(usage.usedAt)}</Text>
        {!!purposeLabel && (
          <Text
            role="caption"
            tone={isAdjustment ? undefined : 'secondary'}
            style={[styles.store, isAdjustment && styles.adjustmentPurpose]}
          >
            {purposeLabel}
          </Text>
        )}
        {!!isAdjustment && !!usage.adjustmentReason && (
          <Text role="caption" tone="tertiary" style={styles.adjustmentReason}>
            {adjustmentReasonText(usage.adjustmentReason, t)}
          </Text>
        )}
      </View>
      <Text
        role="bodyStrong"
        style={isAdjustment ? styles.adjustmentQuantity : undefined}
      >
        {quantityPrefix}
        {formatQuantityForDisplay(usage.quantityUsed)}
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
