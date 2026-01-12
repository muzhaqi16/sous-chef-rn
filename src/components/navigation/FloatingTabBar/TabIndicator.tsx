import React from 'react';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { TabIndicatorProps } from './types';

export const TabIndicator: React.FC<TabIndicatorProps> = ({
  activeIndex,
  tabWidth,
  tabCount: _tabCount,
  tabBarWidth,
}) => {
  // Use useAnimatedTheme for proper theme access in worklets
  const theme = useAnimatedTheme();

  const animatedStyle = useAnimatedStyle(() => {
    // Use percentage-based padding offset like reference (5% of tab bar width)
    const paddingOffset = tabBarWidth * 0.05;
    const translateX = withSpring(
      paddingOffset + activeIndex.value * tabWidth,
      {
        damping: 20,
        stiffness: 150,
      },
    );

    return {
      width: tabWidth,
      backgroundColor: theme.value.colors.primary,
      borderRadius: theme.value.radii['2xl'],
      transform: [{ translateX }],
    };
  }, [tabWidth, tabBarWidth]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.indicator, animatedStyle]}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    height: '100%',
    opacity: 0.35,
  },
});
