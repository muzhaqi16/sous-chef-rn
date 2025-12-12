import React from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface QuantityBadgeProps {
  quantity: number;
  unit?: string | null;
  onPress: () => void;
  disabled?: boolean;
  isPurchased?: boolean;
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
export const QuantityBadge: React.FC<QuantityBadgeProps> = React.memo(
  ({ quantity, unit, onPress, disabled = false, isPurchased = false }) => {
    const { theme } = useUnistyles();
    const isPressed = useSharedValue(false);

    // Format display text
    const displayText = unit ? `${quantity} ${unit}` : `${quantity}`;

    // Animated style for press feedback
    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            scale: withSpring(isPressed.value ? 0.95 : 1, {
              damping: 15,
              stiffness: 300,
            }),
          },
        ],
      };
    }, []);

    const handlePressIn = () => {
      if (!disabled && !isPurchased) {
        isPressed.value = true;
      }
    };

    const handlePressOut = () => {
      isPressed.value = false;
    };

    const isDisabled = disabled || isPurchased;

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={`Quantity: ${displayText}. Tap to edit`}
        accessibilityHint="Opens quantity editor"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: theme.colors.surfaceVariant },
            isDisabled && styles.disabled,
            animatedStyle,
          ]}
        >
          <Text
            style={[
              styles.text,
              { color: theme.colors.textPrimary },
              isPurchased && styles.purchasedText,
            ]}
          >
            {displayText}
          </Text>
        </Animated.View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  purchasedText: {
    textDecorationLine: 'line-through',
  },
}));
