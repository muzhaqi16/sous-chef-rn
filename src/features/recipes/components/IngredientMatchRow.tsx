import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, TextInput } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';

import {
  type EditableMatch,
  getAvailabilityStatus,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

interface IngredientMatchRowProps {
  editableMatch: EditableMatch;
  index: number;
  onUpdate: (
    index: number,
    updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded'>>,
  ) => void;
}

type BadgeColor = 'success' | 'warning' | 'error';

/** Key paths — module-level table, resolved by the row that renders it. */
const BADGE_CONFIG: Record<string, { labelKey: string; color: BadgeColor }> = {
  available: { labelKey: 'ingredientMatch.available', color: 'success' },
  partial: { labelKey: 'ingredientMatch.partial', color: 'warning' },
  missing: { labelKey: 'ingredientMatch.missing', color: 'error' },
};

const IngredientMatchRowComponent: React.FC<IngredientMatchRowProps> = ({
  editableMatch,
  index,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const { match, ingredient, adjustedQuantity, isIncluded } = editableMatch;
  const status = getAvailabilityStatus(match);
  const badge = BADGE_CONFIG[status];
  const isOptional = ingredient.isOptional;
  styles.useVariants({ badgeColor: badge.color });

  return (
    <View style={[styles.row, !isIncluded && styles.rowExcluded]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            size="base"
            weight="medium"
            style={[styles.name, !isIncluded && styles.textExcluded]}
            numberOfLines={1}
          >
            {ingredient.name}
          </Text>
          <View style={styles.badge}>
            <Text size="xs" weight="semibold" style={styles.badgeText}>
              {isOptional ? t('ingredientMatch.optional') : t(badge.labelKey)}
            </Text>
          </View>
        </View>

        {!!match.matchedPantryItem && (
          <Text size="sm" tone="secondary" numberOfLines={1}>
            {t('ingredientMatch.matchedPantryItem', {
              name: match.matchedPantryItem.itemName,
              amount: `${match.matchedPantryItem.quantity}${
                match.matchedPantryItem.unit?.symbol
                  ? ` ${match.matchedPantryItem.unit.symbol}`
                  : ''
              }`,
            })}
          </Text>
        )}

        <View style={styles.bottomRow}>
          <View style={styles.quantityRow}>
            <Text size="sm" tone="secondary">
              {t('ingredientMatch.qtyLabel')}
            </Text>
            <TextInput
              style={styles.quantityInput}
              value={String(adjustedQuantity)}
              onChangeText={text => {
                const num = parseDecimalInput(text);
                if (!isNaN(num) && num >= 0) {
                  onUpdate(index, { adjustedQuantity: num });
                }
              }}
              keyboardType="decimal-pad"
              editable={isIncluded}
            />
            {!!match.suggestedUnit?.symbol && (
              <Text size="sm" tone="secondary">
                {match.suggestedUnit.symbol}
              </Text>
            )}
          </View>
          <BaseSwitch
            value={isIncluded}
            onValueChange={value => onUpdate(index, { isIncluded: value })}
          />
        </View>
      </View>
    </View>
  );
};

export const IngredientMatchRow = IngredientMatchRowComponent;

const styles = StyleSheet.create(theme => ({
  row: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowExcluded: {
    opacity: 0.5,
  },
  content: {
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
  },
  textExcluded: {
    color: theme.colors.textTertiary,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    variants: {
      badgeColor: {
        success: { backgroundColor: theme.colors.success + '20' },
        warning: { backgroundColor: theme.colors.warning + '20' },
        error: { backgroundColor: theme.colors.error + '20' },
      },
    },
  },
  badgeText: {
    variants: {
      badgeColor: {
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
        error: { color: theme.colors.error },
      },
    },
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  quantityInput: {
    minWidth: 60,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
}));
