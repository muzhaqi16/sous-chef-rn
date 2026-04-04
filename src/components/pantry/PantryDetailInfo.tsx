import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { InfoRow } from '#components/molecules/InfoRow';
import { Icon } from '#/utils/iconUtils';
import { getUnitDisplayText } from '#utils/formatQuantity';
import type { GetPantryItemQuery } from '#generated';
import {
  formatCondition,
  formatAcquisitionMethod,
  formatCurrency,
  formatDate,
} from '#hooks/pantry/usePantryItemTransformation';

type PantryItemData = NonNullable<GetPantryItemQuery['pantryItem']>;

interface PantryDetailInfoProps {
  item: PantryItemData;
  brandName: string | null;
  netWeightText: string | null;
  remainingNetWeightText: string | null;
  quantityBreakdownText: string | null;
  packageBreakdownText: string | null;
  shelfLifeDays: number | null | undefined;
  shelfLifeOpenedDays: number | null | undefined;
  onCorrectWeight?: () => void;
}

export const PantryDetailInfo: React.FC<PantryDetailInfoProps> = ({
  item,
  brandName,
  netWeightText,
  remainingNetWeightText,
  quantityBreakdownText,
  packageBreakdownText,
  shelfLifeDays,
  shelfLifeOpenedDays,
  onCorrectWeight,
}) => {
  const { theme } = useUnistyles();

  return (
    <>
      {/* Quantity Row */}
      <InfoRow
        label="Quantity"
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
          label="Net Weight"
          value={netWeightText}
          icon="scale-outline"
          showColon={false}
          labelStyle={styles.labelText}
          containerStyle={styles.rowContainer}
        >
          <Text style={styles.valueText}>{netWeightText}</Text>
          {!!item.lastUsedAt && !!onCorrectWeight && (
            <Pressable
              onPress={onCorrectWeight}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.correctWeightButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name="create-outline"
                size={16}
                color={theme.colors.primary}
              />
            </Pressable>
          )}
        </InfoRow>
      )}

      {/* Remaining Weight Row */}
      {!!remainingNetWeightText && (
        <InfoRow
          label="Remaining Weight"
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
          label="Inventory"
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
          label="Package"
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
          label="Shelf Life"
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
          label="Brand"
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
          label="Storage"
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
          label="Store"
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
        <InfoRow
          label="Condition"
          value={formatCondition(item.condition)}
          icon="fitness-outline"
          iconColor={
            item.condition === 'SPOILED' || item.condition === 'EXPIRED'
              ? theme.colors.error
              : theme.colors.warning
          }
          valueStyle={[
            (item.condition === 'SPOILED' || item.condition === 'EXPIRED') &&
              styles.valueError,
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
          label="Acquired"
          value={formatAcquisitionMethod(item.acquisitionMethod)}
          icon="bag-handle-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}

      {/* Cost Per Unit Row */}
      {!!formatCurrency(item.costPerUnit) && (
        <InfoRow
          label="Cost/Unit"
          value={formatCurrency(item.costPerUnit)}
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
          label="Total Cost"
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
          label="Min Stock"
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
          label="Restock At"
          value={`${item.restockQuantity} ${item.unit?.name ?? ''}`}
          icon="refresh-outline"
          showColon={false}
          labelStyle={styles.labelText}
          valueStyle={styles.valueText}
          containerStyle={styles.rowContainer}
        />
      )}

      {/* Purchase Date Row */}
      {!!item.purchase?.purchaseDate && (
        <InfoRow
          label="Purchased"
          value={`${formatDate(item.purchase.purchaseDate)}${
            item.purchase.unitPrice != null && item.purchase.unitPrice > 0
              ? ` @ ${formatCurrency(item.purchase.unitPrice)}`
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
          label="Last Used"
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
            <Icon
              name="document-text-outline"
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.notesLabel}>Notes</Text>
          </View>
          <Text style={styles.notesText}>{item.storageNotes}</Text>
        </View>
      )}

      {/* Tags Section */}
      {!!item.tags && item.tags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Tags</Text>
          <View style={styles.tagsContainer}>
            {item.tags.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Added Info */}
      <InfoRow
        label="Added"
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  notesLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  notesText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  tagsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  tagsLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
  tagText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
