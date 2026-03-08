import React, { useLayoutEffect } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TIMING } from '#/constants/animations';

interface AnimatedButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  loading = false,
  variant = 'primary',
  fullWidth = false,
  disabled,
  style,
  accessibilityLabel,
  accessibilityHint,
  ...props
}) => {
  const { theme } = useUnistyles();
  const textOpacity = useSharedValue(1);
  const isDisabled = disabled || loading;

  useLayoutEffect(() => {
    if (loading) {
      textOpacity.set(withTiming(0, { duration: TIMING.FAST }));
    } else {
      textOpacity.set(withTiming(1, { duration: TIMING.STANDARD }));
    }
  }, [loading, textOpacity]);

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
    };
  });

  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary,
        };
      case 'secondary':
        return {
          backgroundColor: theme.colors.surfaceVariant,
        };
      case 'danger':
        return {
          backgroundColor: theme.colors.error,
        };
      default:
        return {
          backgroundColor: theme.colors.primary,
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return theme.colors.white;
      case 'secondary':
        return theme.colors.textPrimary;
      default:
        return theme.colors.white;
    }
  };

  // Generate default accessibility label from children if not provided
  const defaultLabel = typeof children === 'string' ? children : accessibilityLabel;

  // UNISTYLES FIX: Wrapper pattern - static Unistyles on outer View,
  // only Reanimated/inline styles on AnimatedTouchable
  // Uses dynamic function for disabled state to ensure updates when prop changes
  return (
    <View
      style={[
        styles.button(isDisabled),
        getButtonStyle(),
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <Pressable
        {...props}
        disabled={disabled || loading}
        style={styles.pressableInner}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={loading ? `Loading ${defaultLabel}` : defaultLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: disabled || loading,
          busy: loading,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={getTextColor()} />
        ) : (
          <Animated.View style={animatedTextStyle}>
            <Text style={[styles.text, { color: getTextColor() }]}>
              {children}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  button: (isDisabled: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    minHeight: theme.sizes.fab.sm,
    overflow: 'hidden',
    opacity: isDisabled ? 0.5 : 1,
  }),
  fullWidth: {
    width: '100%',
  },
  pressableInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.medium,
    textAlign: 'center',
  },
}));
