import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useTabBarVisibility } from '#context/TabBarVisibilityContext';
import { useScanner } from '#context/ScannerContext';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { isVisible } = useTabBarVisibility();
  const { onScanPress, showScannerButton, setActiveTab } = useScanner();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Follow reference implementation exactly
  const tabBarWidth = screenWidth * 0.95;

  // Track active tab for scanner visibility
  useEffect(() => {
    const activeRoute = state.routes[state.index];
    setActiveTab(activeRoute.name);
  }, [state.index, state.routes, setActiveTab]);

  // Hide/show animation for tab bar
  const animatedStyle = useAnimatedStyle(() => {
    const translateY = isVisible.value ? 0 : 100 + safeBottom;

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
        {
          width: tabBarWidth,
          bottom: safeBottom,
        },
        styles.container,
        animatedStyle,
      ]}
    >
      {/* Render tabs - following reference pattern */}
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

        const IconComponent = options.tabBarIcon;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.iconContainer}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            {IconComponent && (
              <IconComponent
                focused={isFocused}
                color={isFocused ? '#FFFFFF' : '#CCCCCC'}
                size={24}
              />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Scanner Button */}
      {showScannerButton && onScanPress && (
        <AddButton onPress={onScanPress} />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  container: {
    backgroundColor: theme.colors.secondaryDark,
    height: 65,
    alignSelf: 'center',
    borderRadius: 20, // Make more rounded to match reference
    position: 'absolute',
    paddingHorizontal: '5%',
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1000, // Much higher z-index to be above everything
  },
}));
