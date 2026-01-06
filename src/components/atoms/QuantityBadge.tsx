import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface QuantityBadgeProps {
  quantity: number;
  quantityInput?: string | null;
  unit?: string | null;
  onPress: () => void;
  disabled?: boolean;
  isPurchased?: boolean;
}

/**
 * Format quantity to max 2 decimal places, removing trailing zeros
 */
const formatQuantity = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  if (rounded % 1 === 0) {
    return rounded.toString();
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
};

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
export const QuantityBadge: React.FC<QuantityBadgeProps> = React.memo(
  ({ quantity, quantityInput, unit, onPress, disabled = false, isPurchased = false }) => {
    const { theme } = useUnistyles();

    // Prefer quantityInput (user's original input like "1/4") over formatted numeric quantity
    const formattedQuantity = quantityInput || formatQuantity(quantity);
    const accessibilityText = unit ? `${formattedQuantity} ${unit}` : formattedQuantity;

    const isDisabled = disabled || isPurchased;

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
            { backgroundColor: theme.colors.surfaceVariant },
            isDisabled && styles.disabled,
          ]}
        >
          <Text
            style={[
              styles.quantityText,
              { color: theme.colors.textPrimary },
              isPurchased && styles.purchasedText,
            ]}
          >
            {formattedQuantity}
          </Text>
          {unit && (
            <Text
              style={[
                styles.unitText,
                { color: theme.colors.textSecondary },
                isPurchased && styles.purchasedText,
              ]}
            >
              {unit}
            </Text>
          )}
        </View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.md,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  unitText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  disabled: {
    opacity: 0.5,
  },
  purchasedText: {
    textDecorationLine: 'line-through',
  },
}));
