import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';

export interface CardProps {
  children: React.ReactNode;
  /** How far off the page the card sits. `flat` is a bordered surface. */
  elevation?: 'flat' | 'sm' | 'md' | 'card';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Corner rounding. The tree uses three; `lg` is the common card. */
  radius?: 'md' | 'lg' | 'xl';
  /** Given, the whole card is the touch target. */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The surface a content block sits on. Its shadow is spread from
 * `theme.shadows`, which has no spread distance on the contact layer — so a
 * container around a `Card` must keep `overflow: 'visible'`.
 */
export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'card',
  padding = 'md',
  radius = 'lg',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  styles.useVariants({ elevation, padding, radius });
  if (onPress) {
    return (
      <AppPressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, style]}
        testID={testID}
      >
        {children}
      </AppPressable>
    );
  }
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderCurve: 'continuous',
    variants: {
      radius: {
        md: { borderRadius: theme.radii.md },
        lg: { borderRadius: theme.radii.lg },
        xl: { borderRadius: theme.radii.xl },
      },
      elevation: {
        flat: {
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.border,
        },
        sm: theme.shadows.sm,
        md: theme.shadows.md,
        card: theme.shadows.card,
      },
      padding: {
        none: {},
        sm: { padding: theme.spacing.sm },
        md: { padding: theme.spacing.md },
        lg: { padding: theme.spacing.lg },
      },
    },
  },
}));

export default Card;
