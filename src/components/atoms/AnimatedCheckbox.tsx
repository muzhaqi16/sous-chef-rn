import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Icon } from '#utils';

type AnimatedCheckboxProps = {
  checked: boolean;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onPress,
  size = 24,
  disabled = false,
}) => {
  const { theme } = useUnistyles();

  // Animated style for the checkbox container
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        checked ? theme.colors.primary : 'transparent',
        {
          duration: 200,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      borderColor: withTiming(
        checked ? theme.colors.primary : theme.colors.border,
        {
          duration: 200,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      transform: [
        {
          scale: withSpring(checked ? 1.05 : 1, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [checked, theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
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
            entering={FadeIn.duration(150)
              .easing(Easing.bezier(0.25, 0.1, 0.25, 1).factory())
              .springify()
              .damping(15)
              .stiffness(200)}
            exiting={FadeOut.duration(100).easing(
              Easing.bezier(0.25, 0.1, 0.25, 1).factory(),
            )}
          >
            <Icon name="check" size={size * 0.66} color="white" />
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
