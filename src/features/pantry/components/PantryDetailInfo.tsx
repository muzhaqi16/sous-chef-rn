import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { InfoRow } from '#components/molecules/InfoRow';

const ThemedConditionInfoRow = withUnistyles(InfoRow);
import { Icon } from '#/utils/iconUtils';
import { getUnitDisplayText } from '#utils/formatQuantity';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import {
  PantryDetailInfo_PantryItemFragmentDoc,
  type PantryDetailInfo_PantryItemFragment,
} from './PantryDetailInfo.generated';
import {
  formatCondition,
  formatAcquisitionMethod,
  formatCurrency,
  formatDate,
} from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import type { BatchPricingSummary } from '#features/pantry/utils/summarizeBatchPricing';

interface PantryDetailInfoProps {
  itemRef:
    | FragmentType<typeof PantryDetailInfo_PantryItemFragmentDoc>
    | PantryDetailInfo_PantryItemFragment;
  brandName: string | null;
  netWeightText: string | null;
  remainingNetWeightText: string | null;
  quantityBreakdownText: string | null;
  packageBreakdownText: string | null;
  shelfLifeDays: number | null | undefined;
  shelfLifeOpenedDays: number | null | undefined;
  onCorrectWeight?: () => void;
  /**
   * What the batches say about the item's money fields — which rows to label as
   * a blend, and when the rate is too diluted to show. {@link summarizeBatchPricing}
   */
  pricing?: BatchPricingSummary;
}

export const PantryDetailInfo: React.FC<PantryDetailInfoProps> = ({
  itemRef,
  brandName,
  netWeightText,
  remainingNetWeightText,
  quantityBreakdownText,
  packageBreakdownText,
  shelfLifeDays,
  shelfLifeOpenedDays,
  onCorrectWeight,
  pricing,
}) => {
  const { t } = useTranslation();
  // Per-entity cache subscription: re-renders only when this PantryItem's
  // fields change. Falls back to the source prop on cache miss so the
  // component renders correctly under test fixtures + tolerates stale state.
  const fragmentResult = useFragment({
    fragment: PantryDetailInfo_PantryItemFragmentDoc,
    fragmentName: 'PantryDetailInfo_pantryItem',
    from: itemRef,
  });
  const item: PantryDetailInfo_PantryItemFragment = fragmentResult.complete
    ? fragmentResult.data
    : (itemRef as PantryDetailInfo_PantryItemFragment);

  const isCriticalCondition =
    item.condition === 'SPOILED' || item.condition === 'EXPIRED';

  // The server derives both from the active batches; `costPerUnit` is a display
  // rate rounded to cents, so it is never multiplied back — `totalCost` is the
  // authoritative value. Null means no priced stock, and the row is omitted.
  const isAveraged = pricing?.isAveraged ?? false;
  // Unpriced stock dilutes the rate below any price actually paid; the value is
  // still honest about the part it knows.
  const costPerUnit = pricing?.isRateDiluted ? null : item.costPerUnit;
  // `item.purchase` is the FIRST acquisition; a restock's is on its own batch.
  // Label by SOURCE: a batch has no join to its Purchase, so only `createdAt`
  // is reachable and "Purchased" would claim an intake time is a purchase date.
  const fromBatch = pricing?.lastPurchase ?? null;
  const purchaseDate = fromBatch?.date ?? item.purchase?.purchaseDate;
  const purchaseTotal = fromBatch
    ? fromBatch.totalCost
    : item.purchase?.totalPrice;

  return (
    <>
      {/* Quantity Row */}
      <InfoRow
        label={t('labels.quantity')}
        value={`${item.quantity} ${getUnitDisplayText(item.unit)}`}
        icon="apps-outline"
        showColon={false}
        labelStyle={styles.labelText}
        valueStyle={styles.valueText}
        containerStyle={styles.rowContainer}
      />
      {/* Net Weight Row */}
      {!!netWeightText && (
        <InfoRow
          label={t('labels.netWeight')}
          value={netWeightText}
          icon="scale-outline"
          showColon={false}
          labelStyle={styles.labelText}
          containerStyle={styles.rowContainer}
        >
          <Text size="base" weight="medium" style={styles.valueText}>
            {netWeightText}
          </Text>
          {!!item.lastUsedAt && !!onCorrectWeight && (
            <AppPressable
              onPress={onCorrectWeight}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.correctWeightButton}
            >
              <Icon name="create-outline" size={16} tone="primary" />
            </AppPressable>
          )}
        </InfoRow>
      )}
      {/* Remaining Weight Row */}
      {!!remainingNetWeightText && (
        <InfoRow
          label={t('labels.remainingWeight')}
          value={remainingNetWeightText}
          icon="scale-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Inventory Breakdown Row */}
      {!!quantityBreakdownText && (
        <InfoRow
          label={t('labels.inventory')}
          value={quantityBreakdownText}
          icon="layers-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Package Details Row */}
      {!!packageBreakdownText && (
        <InfoRow
          label={t('pantryItemDetail.fields.package')}
          value={packageBreakdownText}
          icon="layers-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Shelf Life Row */}
      {(shelfLifeDays != null || shelfLifeOpenedDays != null) && (
        <InfoRow
          label={t('pantryItemDetail.fields.shelfLife')}
          value={
            shelfLifeOpenedDays != null && shelfLifeDays != null
              ? `${shelfLifeDays}d (${shelfLifeOpenedDays}d once opened)`
              : shelfLifeDays != null
              ? `${shelfLifeDays} days`
              : `${shelfLifeOpenedDays}d once opened`
          }
          icon="timer-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Brand Row */}
      {!!brandName && (
        <InfoRow
          label={t('labels.brand')}
          value={brandName}
          icon="pricetag-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Storage Location */}
      {!!item.storageLocation && (
        <InfoRow
          label={t('labels.storage')}
          value={
            typeof item.storageLocation === 'string'
              ? item.storageLocation
              : item.storageLocation.name
          }
          icon="cube-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Store Row */}
      {!!item.store?.name && (
        <InfoRow
          label={t('labels.store')}
          value={item.store.name}
          icon="storefront-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Condition Row - only show if not GOOD */}
      {!!formatCondition(item.condition) && (
        <ThemedConditionInfoRow
          label={t('labels.condition')}
          value={formatCondition(item.condition)}
          icon="fitness-outline"
          uniProps={theme => ({
            iconColor: isCriticalCondition
              ? theme.colors.error
              : theme.colors.warning,
          })}
          valueStyle={[
            isCriticalCondition && styles.valueError,
            item.condition === 'FAIR' && styles.valueWarning,
          ]}
          showColon={false}
          labelStyle={styles.labelText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Acquired Via Row */}
      {!!formatAcquisitionMethod(item.acquisitionMethod) && (
        <InfoRow
          label={t('pantryItemDetail.fields.acquired')}
          value={formatAcquisitionMethod(item.acquisitionMethod)}
          icon="bag-handle-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Cost Per Unit Row */}
      {!!formatCurrency(costPerUnit) && (
        <InfoRow
          label={t(
            isAveraged
              ? 'labels.avgCostPerUnit'
              : 'pantryItemDetail.fields.costPerUnit',
          )}
          value={formatCurrency(costPerUnit)}
          icon="cash-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Total Cost Row */}
      {!!formatCurrency(item.totalCost) && (
        <InfoRow
          label={t('labels.stockValue')}
          value={formatCurrency(item.totalCost)}
          icon="wallet-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Min Stock Row */}
      {item.minQuantity != null && item.minQuantity > 0 && (
        <InfoRow
          label={t('pantryItemDetail.fields.minStock')}
          value={`${item.minQuantity} ${item.unit?.name ?? ''}`}
          icon="alert-circle-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Restock At Row */}
      {item.restockQuantity != null && item.restockQuantity > 0 && (
        <InfoRow
          label={t('pantryItemDetail.fields.restockAt')}
          value={`${item.restockQuantity} ${item.unit?.name ?? ''}`}
          icon="refresh-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Purchase Date Row */}
      {!!purchaseDate && (
        <InfoRow
          label={t(
            fromBatch
              ? 'pantryItemDetail.fields.lastPurchase'
              : 'pantryItemDetail.fields.purchased',
          )}
          // The TOTAL, not the unit price the Cost/Unit row above already shows.
          value={`${formatDate(purchaseDate)}${
            purchaseTotal != null && purchaseTotal > 0
              ? ` · ${formatCurrency(purchaseTotal)}`
              : ''
          }`}
          icon="receipt-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Usage Info Row */}
      {!!item.lastUsedAt && (
        <InfoRow
          label={t('pantryItemDetail.fields.lastUsed')}
          value={formatDate(item.lastUsedAt)}
          icon="time-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}
      {/* Notes Section */}
      {!!item.storageNotes && (
        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <Icon name="document-text-outline" size={16} tone="textSecondary" />
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.notesLabel}
            >
              {t('pantryItemDetail.notes')}
            </Text>
          </View>
          <Text size="base" style={styles.notesText}>
            {item.storageNotes}
          </Text>
        </View>
      )}
      {/* Tags Section */}
      {!!item.tags && item.tags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text size="sm" tone="secondary" style={styles.tagsLabel}>
            {t('pantryItemDetail.tags')}
          </Text>
          <View style={styles.tagsContainer}>
            {item.tags.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text size="sm" weight="medium" tone="accent">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {/* Added Info */}
      <InfoRow
        label={t('pantryItemDetail.fields.added')}
        value={formatDate(item.createdAt)}
        icon="calendar-outline"
        showColon={false}
        labelStyle={styles.labelText}
        valueStyle={styles.valueText}
        containerStyle={styles.rowContainer}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  rowContainer: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  labelText: {
    color: theme.colors.textSecondary,
  },
  valueText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  correctWeightButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  valueError: {
    color: theme.colors.error,
  },
  valueWarning: {
    color: theme.colors.warning,
  },
  notesSection: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  notesLabel: {
    marginLeft: theme.spacing.xs,
  },
  notesText: {
    lineHeight: 22,
  },
  tagsSection: {
    paddingVertical: theme.spacing.md,
  },
  tagsLabel: {
    marginBottom: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
}));
