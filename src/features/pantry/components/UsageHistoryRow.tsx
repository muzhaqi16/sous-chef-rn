import React from 'react';
import { isTranslationKey, useTranslation } from '#/i18n';
import type { TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AdjustmentKind, UsagePurpose } from '#/graphql/generated/schemaTypes';
import { formatDate } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
import { useMoney } from '#domain/money';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import type { UsageRecord } from '#features/pantry/types';
import { formatReading, readingOf, type ReadingSystem } from '#domain/measure';

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

/** One ledger line of the full-history screen. */
export const UsageHistoryRow: React.FC<{
  usage: UsageRecord;
  /** The system a recount stated in a unit reads in. */
  readingSystem: ReadingSystem;
}> = ({ usage, readingSystem }) => {
  const { t } = useTranslation();
  const money = useMoney();
  const showsCost = useBudgetAndPricesEnabled();

  const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
  // Only a purchase carries one; 0 is a price, null is unknown.
  const pricePaid =
    !showsCost || usage.totalCost == null
      ? null
      : money(usage.totalCost, usage.currency);
  // Gated on the KIND, not the purpose: a correction that finds stock is
  // recorded as a RESTOCK row and still carries one.
  const correction = correctionText(usage, t);
  // A recount stated in a unit says what was counted ("Counted: 2.5 lb").
  const stated = usage.statedAmount
    ? formatReading(readingOf(usage.statedAmount, readingSystem))
    : null;
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
        {!!stated && (
          <Text role="caption" tone="tertiary" style={styles.adjustmentReason}>
            {t('adjustQuantity.countedAs', { amount: stated })}
          </Text>
        )}
        {pricePaid !== null && (
          <Text role="caption" tone="tertiary" style={styles.adjustmentReason}>
            {pricePaid}
          </Text>
        )}
      </View>
      <Text
        role="bodyStrong"
        style={isAdjustment ? styles.adjustmentQuantity : undefined}
      >
        {quantityPrefix}
        {formatQuantityWithUnit(usage.quantityUsed, usage.usageUnit)}
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
