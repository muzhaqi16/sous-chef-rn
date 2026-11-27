import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { PressableScale } from '#components/atoms/PressableScale';
import { Text } from '#components/atoms/Text';
import {
  OnPrimaryActivityIndicator,
  OnErrorActivityIndicator,
  ThemedActivityIndicator,
} from '#components/atoms/themedComponents';

interface ButtonProps {
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentProps<typeof Icon>['name'];
  children?: React.ReactNode;
  fullWidth?: boolean;
  title?: string; // For backwards compatibility with atoms/Button
  /** Layout only (margin, flex, width): it lands on the touch target. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  children,
  title,
  fullWidth = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const buttonLabel =
    accessibilityLabel ??
    title ??
    (typeof children === 'string' ? children : undefined);

  const variantStyles = styles.useVariants({
    variant,
    size,
    fullWidth,
    disabled: disabled || loading,
  });

  return (
    // The touch target is a whole box at the platform floor, the button drawn
    // at its own size inside it. No `android_ripple`: it would fill the box.
    <PressableScale
      testID={testID}
      style={[variantStyles.target, style]}
      onPress={onPress}
      haptic="light"
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <View style={variantStyles.button}>
        {loading ? (
          // The same three-way split the icon's `tone` makes below; `danger`
          // sits on `error`, not `primary`.
          variant === 'primary' ? (
            <OnPrimaryActivityIndicator size="small" />
          ) : variant === 'danger' ? (
            <OnErrorActivityIndicator size="small" />
          ) : (
            <ThemedActivityIndicator size="small" />
          )
        ) : (
          <>
            {!!icon && (
              <Icon
                name={icon}
                size={size === 'small' ? 'xs' : size === 'large' ? 'md' : 'sm'}
                tone={
                  variant === 'primary'
                    ? 'onPrimary'
                    : variant === 'danger'
                    ? 'onError'
                    : undefined
                }
              />
            )}
            <Text role="bodyStrong" style={variantStyles.text}>
              {title ?? children}
            </Text>
          </>
        )}
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create(theme => ({
  target: {
    minHeight: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    variants: {
      fullWidth: {
        true: { flex: 1 },
      },
    },
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    gap: theme.spacing.xs,
    overflow: 'hidden',
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.primary },
        secondary: {
          backgroundColor: theme.colors.surface,
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.border,
        },
        danger: { backgroundColor: theme.colors.error },
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: theme.borderWidth.hairline,
          borderColor: 'transparent',
        },
        outline: {
          backgroundColor: 'transparent',
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.primary,
        },
      },
      size: {
        small: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          minHeight: theme.sizes.button.sm,
        },
        medium: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: theme.sizes.button.md,
        },
        large: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          minHeight: theme.sizes.button.lg,
        },
      },
      disabled: {
        true: { opacity: theme.opacity.disabled },
      },
    },
  },
  text: {
    textAlign: 'center',
    variants: {
      variant: {
        primary: { color: theme.colors.onPrimary },
        secondary: { color: theme.colors.textPrimary },
        danger: { color: theme.colors.onError },
        ghost: { color: theme.colors.primaryText },
        outline: { color: theme.colors.primaryText },
      },
    },
  },
}));
