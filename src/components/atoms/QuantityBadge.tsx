import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
// RNGH's Pressable (not the themed RN re-export). This badge is nested inside
// the row's RNGH Swipeable/Pressable; RNGH's native button captures the tap so
// it doesn't also fire the row's onPress. An RN Pressable here lives in a
// separate gesture system and the tap fires both (edit quantity + row navigate).
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import type { RowThemeColors } from '#components/atoms/rowTheme';
import { formatQuantity } from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';

interface QuantityBadgeProps {
  testID?: string;
  quantity: number;
  quantityInput?: string | null;
  unit?: string | null;
  onPress: () => void;
  disabled?: boolean;
  isPurchased?: boolean;
  // Optional theme override applied as inline style on top of the variant-based
  // stylesheet defaults (the stylesheet already gives theme-reactive colors).
  themeColors?: RowThemeColors | null;
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
  testID,
}) => {
  const { t } = useTranslation();
  // Prefer quantityInput (user's original input like "1/4") over formatted numeric quantity
  const formattedQuantity = quantityInput || formatQuantity(quantity);
  const accessibilityText = unit
    ? `${formattedQuantity} ${unit}`
    : formattedQuantity;

  const isDisabled = disabled || isPurchased;
  const isInlineUnit = unit ? unit.length <= 3 : false;

  styles.useVariants({
    inline: isInlineUnit,
    disabled: isDisabled,
    purchased: isPurchased,
  });

  // Optional per-instance color overrides from parent (shopping list passes these
  // via context to share a single theme read across many items).
  const containerOverride = themeColors
    ? { backgroundColor: themeColors.surfaceVariant }
    : null;
  const quantityOverride = themeColors
    ? { color: themeColors.textPrimary }
    : null;
  const unitOverride = themeColors
    ? { color: themeColors.textSecondary }
    : null;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={t('quantityBadge.a11yLabel', {
        quantity: accessibilityText,
      })}
      accessibilityHint={t('quantityBadge.a11yHint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.container, containerOverride]}>
        <Text
          size="sm"
          weight="semibold"
          align="center"
          maxFontSizeMultiplier={1.5}
          style={[styles.quantityText, quantityOverride]}
        >
          {formattedQuantity}
        </Text>
        {!!unit && (
          <Text
            size={isInlineUnit ? 'sm' : '2xs'}
            weight="medium"
            align="center"
            maxFontSizeMultiplier={1.5}
            style={[styles.unitText, unitOverride]}
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
    borderCurve: 'continuous',
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    variants: {
      inline: {
        true: { flexDirection: 'row', gap: 2 },
        false: {},
      },
      disabled: {
        true: { opacity: theme.opacity.disabled },
        false: {},
      },
      purchased: {
        true: {},
        false: {},
      },
    },
  },
  quantityText: {
    lineHeight: 16,
    color: theme.colors.textPrimary,
    variants: {
      purchased: {
        true: { textDecorationLine: 'line-through' },
        false: {},
      },
    },
  },
  unitText: {
    lineHeight: 13,
    color: theme.colors.textSecondary,
    variants: {
      inline: {
        true: { lineHeight: 16 },
        false: {},
      },
      purchased: {
        true: { textDecorationLine: 'line-through' },
        false: {},
      },
    },
  },
}));
