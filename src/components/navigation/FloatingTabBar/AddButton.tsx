import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useTabBarVisibility } from '#context/TabBarVisibilityContext';
import { Icon } from '#utils';
import type { AddButtonProps } from './types';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  isActive = false,
}) => {
  const { isVisible } = useTabBarVisibility();

  const animatedStyle = useAnimatedStyle(() => {
    // Hide/show animation - slide to the right when hiding
    const translateX = isVisible.value ? 0 : 100;

    // Scale animation for press feedback (no rotation for scanner)
    const scale = withSpring(isActive ? 0.95 : 1, {
      damping: 10,
      stiffness: 200,
    });

    return {
      transform: [
        { translateX: withTiming(translateX, { duration: 300 }) },
        { scale }
      ],
    };
  }, [isActive]);

  const handlePress = () => {
    // Add a subtle pulse animation on press
    onPress();
  };

  return (
    <AnimatedTouchableOpacity
      onPress={handlePress}
      style={[styles.addButton, animatedStyle]}
      activeOpacity={0.8}
    >
      <Icon
        name="qr-code-scanner"
        size={24}
        color="#FFFFFF"
        library="MaterialIcons"
      />
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 4, // Position outside the tab bar on the right
    top: -75, // Align with the tab bar height
    zIndex: 2,
    // Shadow for elevated effect
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}));
