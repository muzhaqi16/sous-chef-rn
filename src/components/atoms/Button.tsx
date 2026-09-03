import React from 'react';
import { type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { RIPPLE } from '#constants/ripple';
import { Icon } from '#utils/iconUtils';
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
  style?: StyleProp<ViewStyle>; // For custom styling
  btnStyle?: StyleProp<ViewStyle>; // For backwards compatibility
  txtStyle?: StyleProp<TextStyle>; // For backwards compatibility
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
  btnStyle,
  txtStyle,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // Use title/children as fallback for accessibility label
  const buttonLabel =
    accessibilityLabel ||
    title ||
    (typeof children === 'string' ? children : undefined);

  const useWhiteRipple = variant === 'primary' || variant === 'danger';

  styles.useVariants({
    variant,
    size,
    fullWidth,
    disabled: disabled || loading,
  });

  return (
    <PressableScale
      testID={testID}
      style={[styles.button, style, btnStyle]}
      onPress={onPress}
      haptic="light"
      disabled={disabled || loading}
      android_ripple={useWhiteRipple ? RIPPLE.PRIMARY : RIPPLE.DEFAULT}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
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
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              tone={
                variant === 'primary'
                  ? 'onPrimary'
                  : variant === 'danger'
                  ? 'onError'
                  : undefined
              }
            />
          )}
          <Text style={[styles.text, txtStyle]}>{title || children}</Text>
        </>
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create(theme => ({
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
      fullWidth: {
        true: { flex: 1 },
      },
      disabled: {
        true: { opacity: theme.opacity.disabled },
      },
    },
  },
  text: {
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    fontSize: theme.fonts.size.md,
    variants: {
      variant: {
        primary: { color: theme.colors.onPrimary },
        secondary: { color: theme.colors.textPrimary },
        danger: { color: theme.colors.onError },
        ghost: { color: theme.colors.primary },
        outline: { color: theme.colors.primary },
      },
    },
  },
}));
