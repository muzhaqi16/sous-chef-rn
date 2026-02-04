import React, { useEffect } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface TabItemProps {
  route: {
    key: string;
    name: string;
    params?: object;
  };
  isFocused: boolean;
  options: {
    title?: string;
    tabBarIcon?: React.ComponentType<{
      focused: boolean;
      color: string;
      size: number;
    }>;
    tabBarAccessibilityLabel?: string;
  };
  onPress: () => void;
  showLabel: boolean;
}

export const TabItem: React.FC<TabItemProps> = React.memo(({
  route,
  isFocused,
  options,
  onPress,
  showLabel,
}) => {
  const { theme } = useUnistyles();
  const iconScale = useSharedValue(isFocused ? 1.2 : 1);

  // Update scale when focus changes
  useEffect(() => {
    iconScale.value = withSpring(isFocused ? 1.2 : 1, {
      damping: 35,
      stiffness: 250,
    });
  }, [isFocused, iconScale]);

  const handlePress = () => {
    // Animate icon scale on press (squeeze then expand)
    iconScale.value = withSequence(
      withSpring(0.85, { damping: 15, stiffness: 300 }),
      withSpring(isFocused ? 1.2 : 1, { damping: 15, stiffness: 300 })
    );
    onPress();
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const label = options.title || route.name;
  const TabBarIcon = options.tabBarIcon;

  return (
    <TouchableOpacity
      testID={`tab-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      onPress={handlePress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={animatedIconStyle}>
        {TabBarIcon && (
          <TabBarIcon
            focused={isFocused}
            color={isFocused ? theme.colors.primary : theme.colors.textTertiary}
            size={24}
          />
        )}
      </Animated.View>
      {showLabel && (
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
});

TabItem.displayName = 'TabItem';

const styles = StyleSheet.create(theme => ({
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minWidth: theme.sizes.touchTarget.sm,
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
  },
  tabLabelFocused: {
    color: theme.colors.primary,
  },
}));
