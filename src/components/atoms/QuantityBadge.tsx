import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { SortableListThemeColors } from '#features/shoppingList/components/SortableShoppingList/SortableListThemeContext';
import { formatQuantity } from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';

interface QuantityBadgeProps {
  quantity: number;
  quantityInput?: string | null;
  unit?: string | null;
  onPress: () => void;
  disabled?: boolean;
  isPurchased?: boolean;
  // PERFORMANCE: Optional theme colors passed from parent to avoid useUnistyles call
  themeColors?: SortableListThemeColors | null;
}

/**
 * QuantityBadge - Tappable pill displaying quantity + unit
 *
 * Displays quantity and optional unit in a pill-shaped badge.
 * Tapping opens the quantity edit sheet.
 *
 * Examples:
 * - "2 lb"
 * - "1 pc"
 * - "3" (when no unit)
 */
export const QuantityBadge: React.FC<QuantityBadgeProps> = ({
  quantity,
  quantityInput,
  unit,
  onPress,
  disabled = false,
  isPurchased = false,
  themeColors,
}) => {
  // PERFORMANCE: Only call useUnistyles if themeColors not provided
  // When used in shopping list, parent provides colors to avoid repeated hook calls
  const { theme } = useUnistyles();
  const colors = {
    surfaceVariant: themeColors?.surfaceVariant ?? theme.colors.surfaceVariant,
    textPrimary: themeColors?.textPrimary ?? theme.colors.textPrimary,
    textSecondary: themeColors?.textSecondary ?? theme.colors.textSecondary,
  };

  // Prefer quantityInput (user's original input like "1/4") over formatted numeric quantity
  const formattedQuantity = quantityInput || formatQuantity(quantity);
  const accessibilityText = unit
    ? `${formattedQuantity} ${unit}`
    : formattedQuantity;

  const isDisabled = disabled || isPurchased;
  const isInlineUnit = unit ? unit.length <= 3 : false;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={`Quantity: ${accessibilityText}. Tap to edit`}
      accessibilityHint="Opens quantity editor"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surfaceVariant },
          isInlineUnit && styles.containerInline,
          isDisabled && styles.disabled,
        ]}
      >
        <Text
          size="sm"
          weight="semibold"
          align="center"
          maxFontSizeMultiplier={1.5}
          style={[
            styles.quantityText,
            { color: colors.textPrimary },
            isPurchased && styles.purchasedText,
          ]}
        >
          {formattedQuantity}
        </Text>
        {!!unit && (
          <Text
            size={isInlineUnit ? 'sm' : '2xs'}
            weight="medium"
            align="center"
            maxFontSizeMultiplier={1.5}
            style={[
              isInlineUnit ? styles.unitTextInline : styles.unitText,
              { color: colors.textSecondary },
              isPurchased && styles.purchasedText,
            ]}
          >
            {unit}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.md,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerInline: {
    flexDirection: 'row',
    gap: 2,
  },
  quantityText: {
    lineHeight: 16,
  },
  unitText: {
    lineHeight: 13,
  },
  unitTextInline: {
    lineHeight: 16,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  purchasedText: {
    textDecorationLine: 'line-through',
  },
}));
