import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Icon } from '#utils';
import { HapticService } from '#services/haptic';

type AnimatedCheckboxProps = {
  checked: boolean;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = React.memo(({
  checked,
  onPress,
  size = 24,
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  const isPressed = useSharedValue(false);

  // Animated style for the checkbox container
  const animatedContainerStyle = useAnimatedStyle(() => {
    // Combine checked scale (1.05) with press scale (0.9)
    const baseScale = checked ? 1.05 : 1;
    const pressScale = isPressed.value ? 0.9 : 1;
    const finalScale = baseScale * pressScale;

    return {
      backgroundColor: withTiming(
        checked ? theme.colors.primary : 'transparent',
        {
          duration: 120,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      borderColor: withTiming(
        checked ? theme.colors.primary : theme.colors.border,
        {
          duration: 120,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      transform: [
        {
          scale: withSpring(finalScale, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [checked, theme]);

  const handlePressIn = () => {
    if (!disabled) {
      isPressed.value = true;
      // Short haptic feedback for checkbox toggle
      HapticService.light();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      isPressed.value = false;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
          animatedContainerStyle,
        ]}
      >
        {checked && (
          <Animated.View
            entering={FadeIn.duration(80)
              .easing(Easing.bezier(0.25, 0.1, 0.25, 1).factory())
              .springify()
              .damping(15)
              .stiffness(200)}
            exiting={FadeOut.duration(60).easing(
              Easing.bezier(0.25, 0.1, 0.25, 1).factory(),
            )}
          >
            <Icon name="check" size={size * 0.66} color="white" />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
