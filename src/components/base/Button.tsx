import React, { useCallback } from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';

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
  style?: any; // For custom styling
  btnStyle?: any; // For backwards compatibility
  txtStyle?: any; // For backwards compatibility
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const RIPPLE_PRIMARY = { color: 'rgba(255,255,255,0.2)', borderless: false };
const RIPPLE_DEFAULT = { color: 'rgba(0,0,0,0.1)', borderless: false };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    HapticService.light();
    onPress();
  }, [onPress]);

  // Use title/children as fallback for accessibility label
  const buttonLabel = accessibilityLabel || title || (typeof children === 'string' ? children : undefined);

  const useWhiteRipple = variant === 'primary' || variant === 'danger';

  return (
    <AnimatedPressable
      testID={testID}
      style={[
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        animatedStyle,
        style,
        btnStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      android_ripple={useWhiteRipple ? RIPPLE_PRIMARY : RIPPLE_DEFAULT}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={useWhiteRipple ? 'white' : undefined}
        />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
              color={
                variant === 'primary' || variant === 'danger'
                  ? 'white'
                  : undefined
              }
            />
          )}
          <Text style={[styles.text, styles[`${variant}Text`], txtStyle]}>
            {title || children}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.lg,
    gap: theme.spacing.xs,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.error,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
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
  fullWidth: {
    flex: 1,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  text: {
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    fontSize: theme.fonts.size.md,
  },
  primaryText: {
    color: theme.colors.white,
  },
  secondaryText: {
    color: theme.colors.textPrimary,
  },
  dangerText: {
    color: theme.colors.white,
  },
  ghostText: {
    color: theme.colors.primary,
  },
  outlineText: {
    color: theme.colors.primary,
  },
}));
