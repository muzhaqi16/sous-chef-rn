import React, { useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface AnimatedButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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

  return (
    <AnimatedTouchable
      {...props}
      disabled={disabled || loading}
      style={[
        styles.button,
        getButtonStyle(),
        animatedButtonStyle,
        (disabled || loading) && styles.disabled,
        style,
      ]}
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
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create(_theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
}));
