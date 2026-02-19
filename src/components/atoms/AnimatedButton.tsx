import React, { useEffect } from 'react';
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
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface AnimatedButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const loadingProgress = useSharedValue(0);
  const textOpacity = useSharedValue(1);
  const isDisabled = disabled || loading;

  useEffect(() => {
    if (loading) {
      // Shrink to circular loading indicator
      loadingProgress.value = withSpring(1, {
        damping: 20,
        stiffness: 180,
      });
      textOpacity.value = withTiming(0, { duration: 150 });
    } else {
      // Expand back to full width
      loadingProgress.value = withSpring(0, {
        damping: 20,
        stiffness: 180,
      });
      textOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [loading, loadingProgress, textOpacity]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    const minWidth = 48; // Circular button size when loading
    const maxWidth = fullWidth ? '100%' : 120;

    return {
      width: loading
        ? interpolate(loadingProgress.value, [0, 1], [120, minWidth])
        : maxWidth,
      paddingHorizontal: interpolate(
        loadingProgress.value,
        [0, 1],
        [16, 0]
      ),
    };
  });

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
        style,
      ]}
    >
      <AnimatedPressable
        {...props}
        disabled={disabled || loading}
        style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, animatedButtonStyle]}
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
      </AnimatedPressable>
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
  text: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.medium,
    textAlign: 'center',
  },
}));
