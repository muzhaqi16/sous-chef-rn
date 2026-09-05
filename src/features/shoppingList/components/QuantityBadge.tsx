import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
// RNGH's Pressable, not the themed RN re-export: nested inside the row's RNGH
// Swipeable, only RNGH's native button captures the tap. An RN Pressable is in a
// separate gesture system, so the tap fires both edit and row navigation.
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import type { RowThemeColors } from '#components/atoms/rowTheme';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';

interface QuantityBadgeProps {
  testID?: string;
  quantity: number;
  quantityInput?: string | null;
  unit?: string | null;
  onPress: () => void;
  disabled?: boolean;
  isPurchased?: boolean;
  /** Inline override on top of the stylesheet's already theme-reactive colors. */
  themeColors?: RowThemeColors | null;
}

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
  const formattedQuantity = formatQuantityForDisplay(quantity, {
    quantityInput,
  });
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

  // The shopping list passes these through context to share one theme read.
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
          role="label"
          align="center"
          style={[styles.quantityText, quantityOverride]}
        >
          {formattedQuantity}
        </Text>
        {!!unit && (
          <Text
            role="label"
            align="center"
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
    color: theme.colors.textPrimary,
    variants: {
      purchased: {
        true: { textDecorationLine: 'line-through' },
        false: {},
      },
    },
  },
  unitText: {
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
