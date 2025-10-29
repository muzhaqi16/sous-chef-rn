import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useScanner } from '#context/ScannerContext';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';

export const TAB_BAR_HEIGHT = 65;

export const FloatingTabBar: React.FC<FloatingTabBarProps> = React.memo(({
  state,
  descriptors,
  navigation,
}) => {
  const { onScanPress, showScannerButton, setActiveTab, isOverlayOpen } = useScanner();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { theme } = useUnistyles();

  // Memoize tab bar width calculation
  const tabBarWidth = useMemo(() => screenWidth * 0.95, [screenWidth]);

  // Animated values for smooth hide/show
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Track active tab for scanner visibility
  useEffect(() => {
    const activeRoute = state.routes[state.index];
    setActiveTab(activeRoute.name);
  }, [state.index, state.routes, setActiveTab]);

  // Check if the focused route has tabBarStyle: { display: 'none' }
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;
  const shouldHideFromNavigation =
    focusedOptions?.tabBarStyle &&
    typeof focusedOptions.tabBarStyle === 'object' &&
    'display' in focusedOptions.tabBarStyle &&
    focusedOptions.tabBarStyle.display === 'none';

  // Animate tab bar visibility
  useEffect(() => {
    const shouldHide = isOverlayOpen || shouldHideFromNavigation;

    translateY.value = withSpring(shouldHide ? 150 : 0, {
      damping: 20,
      stiffness: 200,
    });
    opacity.value = withSpring(shouldHide ? 0 : 1, {
      damping: 20,
      stiffness: 200,
    });
  }, [isOverlayOpen, shouldHideFromNavigation, translateY, opacity]);

  // Animated style for smooth transitions
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Memoize container style
  const containerStyle = useMemo(
    () => ({
      width: tabBarWidth,
      bottom: safeBottom,
    }),
    [tabBarWidth, safeBottom]
  );

  return (
    <Animated.View
      style={[containerStyle, styles.container, animatedStyle]}
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

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {options.tabBarIcon && (
              <options.tabBarIcon
                focused={isFocused}
                color={isFocused ? theme.colors.primary : '#CCCCCC'}
                size={24}
              />
            )}
          </TouchableOpacity>
        );
      })}

      {showScannerButton && onScanPress && (
        <AddButton onPress={onScanPress} />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.secondaryDark,
    height: 65,
    alignSelf: 'center',
    borderRadius: 20,
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
    zIndex: 1000,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minWidth: 40,
  },
}));
