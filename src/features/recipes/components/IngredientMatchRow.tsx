import React from 'react';
import { View, Switch, TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  type EditableMatch,
  getAvailabilityStatus,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';

interface IngredientMatchRowProps {
  editableMatch: EditableMatch;
  index: number;
  onUpdate: (
    index: number,
    updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded'>>,
  ) => void;
}

const BADGE_CONFIG: Record<
  string,
  { label: string; color: 'success' | 'warning' | 'error' }
> = {
  available: { label: 'Available', color: 'success' },
  partial: { label: 'Partial', color: 'warning' },
  missing: { label: 'Missing', color: 'error' },
};

const IngredientMatchRowComponent: React.FC<IngredientMatchRowProps> = ({
  editableMatch,
  index,
  onUpdate,
}) => {
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
            size="base"
            weight="medium"
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
              size="xs"
              weight="semibold"
              style={{ color: theme.colors[badge.color] }}
            >
              {isOptional ? 'Optional' : badge.label}
            </Text>
          </View>
        </View>

        {!!match.matchedPantryItem && (
          <Text size="sm" tone="secondary" numberOfLines={1}>
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
            <Text size="sm" tone="secondary">
              Qty:
            </Text>
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
            {!!match.suggestedUnit?.symbol && (
              <Text size="sm" tone="secondary">
                {match.suggestedUnit.symbol}
              </Text>
            )}
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
}));
