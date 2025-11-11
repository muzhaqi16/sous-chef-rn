import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
  const { theme } = useUnistyles();
  const animatedStyle = useAnimatedStyle(() => {
    const isActiveTab = activeIndex.value === index;

    // Scale animation for active tab
    const scale = withSpring(isActiveTab ? 1.1 : 1, {
      damping: 15,
      stiffness: 150,
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
          color={isActive ? theme.colors.iconOnPrimary : theme.colors.iconDisabled}
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
    minWidth: 40, // Ensure minimum width for touch target
    // NO z-index or elevation needed - parent layer controls stacking
  },
}));