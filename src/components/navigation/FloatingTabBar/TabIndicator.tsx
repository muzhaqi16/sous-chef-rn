import React from 'react';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { TabIndicatorProps } from './types';

export const TabIndicator: React.FC<TabIndicatorProps> = ({
  activeIndex,
  tabWidth,
  tabCount: _tabCount,
  tabBarWidth,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Use percentage-based padding offset like reference (5% of tab bar width)
    const paddingOffset = tabBarWidth * 0.05;
    const translateX = withSpring(paddingOffset + (activeIndex.value * tabWidth), {
      damping: 20,
      stiffness: 150,
    });

    return {
      transform: [{ translateX }],
    };
  }, [tabWidth, tabBarWidth]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.indicator,
        {
          width: tabWidth,
        },
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  indicator: {
    position: 'absolute',
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    opacity: 0.35, // More visible indicator
    // NO z-index or elevation needed - parent layer controls stacking
  },
}));