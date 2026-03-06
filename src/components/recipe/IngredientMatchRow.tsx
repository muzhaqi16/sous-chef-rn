import React from 'react';
import { View, Text, Switch, TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { createPropsComparator } from '#utils/memoUtils';
import {
  type EditableMatch,
  getAvailabilityStatus,
} from '#hooks/recipe/useRecipeIngredientMatching';

interface IngredientMatchRowProps {
  editableMatch: EditableMatch;
  index: number;
  onUpdate: (
    index: number,
    updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded'>>,
  ) => void;
}

const BADGE_CONFIG = {
  available: { label: 'Available', color: 'success' as const },
  partial: { label: 'Partial', color: 'warning' as const },
  missing: { label: 'Missing', color: 'error' as const },
} as const;

const IngredientMatchRowComponent: React.FC<IngredientMatchRowProps> =
  ({ editableMatch, index, onUpdate }) => {
    const { theme } = useUnistyles();
    const { match, adjustedQuantity, isIncluded } = editableMatch;
    const status = getAvailabilityStatus(match);
    const badge = BADGE_CONFIG[status];
    const isOptional = match.ingredient.isOptional;

    return (
      <View style={[styles.row, !isIncluded && styles.rowExcluded]}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[styles.name, !isIncluded && styles.textExcluded]}
              numberOfLines={1}
            >
              {match.ingredient.name}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.colors[badge.color] + '20' },
              ]}
            >
              <Text
                style={[styles.badgeText, { color: theme.colors[badge.color] }]}
              >
                {isOptional ? 'Optional' : badge.label}
              </Text>
            </View>
          </View>

          {!!match.matchedPantryItem && (
            <Text style={styles.matchInfo} numberOfLines={1}>
              Matched: {match.matchedPantryItem.itemName} (
              {match.matchedPantryItem.quantity}
              {match.matchedPantryItem.unit?.symbol
                ? ` ${match.matchedPantryItem.unit.symbol}`
                : ''}{' '}
              available)
            </Text>
          )}

          <View style={styles.bottomRow}>
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Qty:</Text>
              <TextInput
                style={styles.quantityInput}
                value={String(adjustedQuantity)}
                onChangeText={text => {
                  const num = parseFloat(text);
                  if (!isNaN(num) && num >= 0) {
                    onUpdate(index, { adjustedQuantity: num });
                  }
                }}
                keyboardType="decimal-pad"
                editable={isIncluded}
              />
              {!!match.suggestedUnit?.symbol && <Text style={styles.unitText}>{match.suggestedUnit.symbol}</Text>}
            </View>
            <Switch
              value={isIncluded}
              onValueChange={value => onUpdate(index, { isIncluded: value })}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>
      </View>
    );
  };

IngredientMatchRowComponent.displayName = 'IngredientMatchRow';

const areIngredientMatchRowPropsEqual = createPropsComparator<IngredientMatchRowProps>({
  referenceKeys: ['index'],
  nestedComparisons: {
    editableMatch: ['adjustedQuantity', 'isIncluded'],
    'editableMatch.match.ingredient': ['id'],
  },
});

export const IngredientMatchRow = React.memo(IngredientMatchRowComponent, areIngredientMatchRowPropsEqual);

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
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  textExcluded: {
    color: theme.colors.textTertiary,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  badgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
  matchInfo: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
  quantityLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  quantityInput: {
    minWidth: 60,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  unitText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
