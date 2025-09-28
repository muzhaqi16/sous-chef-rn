import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { FloatingTabItemProps } from './types';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const FloatingTabItem: React.FC<FloatingTabItemProps> = ({
  route: _route,
  index,
  activeIndex,
  onPress,
  onLongPress,
  icon: IconComponent,
  accessibilityLabel,
  isActive,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActiveTab = activeIndex.value === index;

    // Scale animation for active tab
    const scale = withSpring(isActiveTab ? 1.1 : 1, {
      damping: 15,
      stiffness: 150,
    });

    // Icon color opacity animation
    const iconOpacity = withSpring(isActiveTab ? 1 : 0.6, {
      duration: 200,
    });

    // Subtle bounce animation when pressed
    const translateY = interpolate(
      scale,
      [1, 1.1],
      [0, -2]
    );

    return {
      transform: [
        { scale },
        { translateY },
      ],
      opacity: iconOpacity,
    };
  }, [index]);

  return (
    <AnimatedTouchableOpacity
      accessibilityRole="button"
      accessibilityState={isActive ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tabItem, animatedStyle]}
      activeOpacity={0.7}
    >
      {IconComponent && (
        <IconComponent
          focused={isActive}
          color={isActive ? '#FFFFFF' : '#CCCCCC'}
          size={24}
        />
      )}
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create(_theme => ({
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 1,
    minWidth: 40, // Ensure minimum width for touch target
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Temporary: see tab boundaries
    marginHorizontal: 2, // Small gap between tabs for visibility
    borderRadius: 16,
  },
}));