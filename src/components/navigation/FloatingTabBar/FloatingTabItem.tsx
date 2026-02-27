import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SPRING } from '#/constants/animations';
import type { FloatingTabItemProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const FloatingTabItem: React.FC<FloatingTabItemProps> = ({
  route: _route,
  index,
  activeIndex,
  onPress,
  onLongPress,
  icon: tabBarIcon,
  accessibilityLabel,
  isActive,
}) => {
  const { theme } = useUnistyles();
  const animatedStyle = useAnimatedStyle(() => {
    const isActiveTab = activeIndex.value === index;

    // Scale animation for active tab
    const scale = withSpring(isActiveTab ? 1.1 : 1, SPRING.DEFAULT);

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

  const iconColor = isActive ? theme.colors.iconOnPrimary : theme.colors.iconDisabled;

  const renderIcon = () => {
    if (!tabBarIcon) return null;
    if (typeof tabBarIcon === 'function') {
      const result = tabBarIcon({ focused: isActive, color: iconColor, size: 24 });
      return result as React.ReactNode;
    }
    return null;
  };

  // UNISTYLES FIX: Wrapper pattern - static Unistyles on outer View
  return (
    <View style={styles.tabItem}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityState={isActive ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}
      >
        {renderIcon()}
      </AnimatedPressable>
    </View>
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