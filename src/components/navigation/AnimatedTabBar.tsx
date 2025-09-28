import React from 'react';
import { TouchableOpacity } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTabBarVisibility } from '#/context/TabBarVisibilityContext';

export const TAB_BAR_HEIGHT = 40;

export const AnimatedTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { isVisible } = useTabBarVisibility();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = isVisible.value ? 0 : TAB_BAR_HEIGHT + safeBottom;

    return {
      transform: [
        {
          translateY: withTiming(translateY, {
            duration: 300,
          }),
        },
      ],
    };
  }, [safeBottom]);

  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_HEIGHT + safeBottom,
        },
        animatedStyle,
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Get icon from options
        const IconComponent = options.tabBarIcon;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
          >
            {IconComponent && (
              <IconComponent
                focused={isFocused}
                color={
                  isFocused ? theme.colors.primary : theme.colors.secondary
                }
                size={theme.sizes.icon.md}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
}));
