import React from 'react';
import { isTranslationKey, useTranslation } from '#/i18n';
import type { TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AdjustmentKind, UsagePurpose } from '#/graphql/generated/schemaTypes';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';

export interface UsageRecord {
  id: string;
  usedAt: string;
  quantityUsed: number;
  purpose: UsagePurpose;
  adjustmentKind?: AdjustmentKind | null;
  adjustmentReason?: string | null;
  usageUnit?: { symbol?: string | null } | null;
}

/** Local copy for the kinds the server writes itself. */
const SYSTEM_REASON_KEY: Record<AdjustmentKind, TranslationKey | null> = {
  // A person's own words; nothing to substitute.
  [AdjustmentKind.User]: null,
  [AdjustmentKind.StackMerge]: 'adjustQuantity.systemReason.stackMerged',
  [AdjustmentKind.StackPurged]: 'adjustQuantity.systemReason.stackPurged',
  [AdjustmentKind.StackRemoved]: 'adjustQuantity.systemReason.stackRemoved',
};

/**
 * The line a correction shows: local copy for a kind the server wrote, the
 * person's own text for their own correction. Null when there is nothing to
 * say — an unknown kind included, since its reason is then the server's.
 */
const correctionText = (usage: UsageRecord, t: Translate): string | null => {
  const kind = usage.adjustmentKind;
  if (!kind) return null;
  const key = SYSTEM_REASON_KEY[kind];
  if (key) return t(key);
  // A kind this build does not know reaches neither arm: its reason is the
  // server's, not a person's, so it stays off the screen.
  if (kind !== AdjustmentKind.User) return null;
  return usage.adjustmentReason ?? null;
};

/** One ledger line, shared by the detail summary and the full-history screen. */
export const UsageHistoryRow: React.FC<{ usage: UsageRecord }> = ({
  usage,
}) => {
  const { t } = useTranslation();

  const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
  // Gated on the KIND, not the purpose: a correction that finds stock is
  // recorded as a RESTOCK row and still carries one.
  const correction = correctionText(usage, t);
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
        {!!correction && (
          <Text role="caption" tone="tertiary" style={styles.adjustmentReason}>
            {correction}
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
