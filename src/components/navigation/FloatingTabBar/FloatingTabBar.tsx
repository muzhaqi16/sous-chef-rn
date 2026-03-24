import React, {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import {
  useTabBarState,
  useTabBarSetters,
} from '#context/TabBarActionsContext';
import { toastService } from '#/services/toastService';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';
import { TabItem } from './TabItem';
import { useShowNavigationLabels } from '#hooks/settings/useSettings';
import { HapticService } from '#services/haptic/HapticService';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { SPRING, TIMING } from '#/constants/animations';

export const TAB_BAR_HEIGHT = 65;

/**
 * Tab bar is only visible on these main screens.
 * Single source of truth — no per-screen tabBarStyle needed in HomeTabs.
 */
const MAIN_SCREENS = new Set([
  'PantryMain',
  'ShoppingListMain',
  'RecipeMain',
  'MealPlanMain',
]);

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {
    onAddPress,
    showAddButton,
    addButtonConfig,
    isAddButtonDisabled,
    addButtonDisabledMessage,
    isOverlayOpen,
  } = useTabBarState();
  const { setActiveTab, setAddButtonRect, scrollTabBarHidden } =
    useTabBarSetters();

  // Ref for measuring add button position (for tutorial spotlight)
  const addButtonRef = useRef<View>(null);

  // Navigation labels preference
  const showNavigationLabels = useShowNavigationLabels();

  // Handle add button press - show toast if disabled
  const handleAddPress = () => {
    if (isAddButtonDisabled) {
      toastService.info(
        addButtonDisabledMessage ||
          "You don't have permission to perform this action",
      );
      return;
    }
    onAddPress?.();
  };
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Memoize tab bar width calculation
  const tabBarWidth = screenWidth * 0.95;

  // Shared value for immediate tab icon feedback (UI thread)
  const activeTabIndex = useSharedValue(state.index);

  // Sync shared value with React Navigation state
  useLayoutEffect(() => {
    activeTabIndex.set(state.index);
  }, [state.index, activeTabIndex]);

  // Animated values for smooth hide/show
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Tracks whether navigation/overlay is actively hiding the tab bar.
  // Used to prevent the scroll reaction from overriding the navigation hide.
  const navHidden = useSharedValue(false);

  // Track active tab for scanner visibility
  useEffect(() => {
    const activeRoute = state.routes[state.index];
    setActiveTab(activeRoute.name);
  }, [state.index, state.routes, setActiveTab]);

  // Hide tab bar on any screen that is not a main tab screen.
  // getFocusedRouteNameFromRoute returns the nested stack's focused route name;
  // null/undefined means no nested state yet → initial main screen is focused.
  const focusedRoute = state.routes[state.index];
  const nestedRouteName = getFocusedRouteNameFromRoute(
    focusedRoute as Parameters<typeof getFocusedRouteNameFromRoute>[0],
  );
  const shouldHideFromNavigation =
    nestedRouteName != null && !MAIN_SCREENS.has(nestedRouteName);

  // Animate tab bar visibility (overlay/navigation-driven — React state)
  // Takes priority over scroll-driven hide.
  useLayoutEffect(() => {
    const shouldHide = isOverlayOpen || shouldHideFromNavigation;

    // Update navHidden BEFORE resetting scrollTabBarHidden so the scroll
    // reaction can check this guard and skip the show animation.
    navHidden.set(!!shouldHide);

    // Fast timing for opacity (linear, no spring)
    opacity.set(withTiming(shouldHide ? 0 : 1, { duration: TIMING.FAST }));

    // Snappy spring with subtle bounce (higher damping = less bounce)
    translateY.set(withSpring(shouldHide ? 150 : 0, SPRING.HEAVY));

    // Reset scroll state when overlay/nav takes priority — prevents stale
    // scroll-hidden state from persisting when the user returns.
    if (shouldHide) {
      scrollTabBarHidden.set(false);
    }
  }, [
    isOverlayOpen,
    shouldHideFromNavigation,
    translateY,
    opacity,
    scrollTabBarHidden,
    navHidden,
  ]);

  // Scroll-driven tab bar hide (SharedValue from screen scroll handlers).
  // Skips when navigation/overlay is hiding the bar to prevent race conditions.
  useAnimatedReaction(
    () => scrollTabBarHidden.value,
    (hidden, prevHidden) => {
      if (hidden === prevHidden) return;
      if (navHidden.value) return;
      translateY.set(withSpring(hidden ? 150 : 0, SPRING.HEAVY));
      opacity.set(withTiming(hidden ? 0 : 1, { duration: TIMING.FAST }));
    },
  );

  // Animated style for smooth transitions
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Memoize container style
  const containerStyle = {
    width: tabBarWidth,
    bottom:
      Platform.OS === 'ios'
        ? Math.max(safeBottom * 0.5, 16)
        : Math.max(safeBottom, 16),
  };

  // Split tabs: first half before add button, second half after
  const middleIndex = Math.floor(state.routes.length / 2);

  // Create press handler for each tab
  const handleTabPress = (
    route: { key: string; name: string; params?: object },
    isFocused: boolean,
    targetIndex: number,
  ) => {
    // Set shared value immediately for instant UI-thread icon feedback
    activeTabIndex.set(targetIndex);
    HapticService.selection();

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      // Map tab names to their main screens for stack reset
      const mainScreenMap: Record<string, string> = {
        Pantry: 'PantryMain',
        ShoppingList: 'ShoppingListMain',
        Recipe: 'RecipeMain',
        MealPlan: 'MealPlanMain',
      };

      const mainScreen = mainScreenMap[route.name];

      // Wrap in startTransition so React treats the navigation as a non-urgent
      // update — the current screen stays visible while the target mounts,
      // allowing skeleton fallbacks to paint instead of freezing the UI.
      startTransition(() => {
        if (!isFocused) {
          // Switching tabs: just focus the tab, preserve paused stack state.
          // With inactiveBehavior: 'pause', the paused tree resumes instantly
          // instead of unmounting/remounting the entire screen.
          navigation.navigate(route.name);
        } else if (mainScreen) {
          // Re-tapping the active tab: reset stack to root (standard iOS/Android pattern)
          navigation.navigate(route.name, {
            screen: mainScreen,
            initial: false,
          });
        }
      });
    }
  };

  return (
    <Animated.View
      style={[containerStyle, styles.container, animatedStyle]}
      testID="tab-bar"
    >
      <View style={styles.tabsRow}>
        {/* First half of tabs (Pantry, ShoppingList) */}
        {state.routes.slice(0, middleIndex).map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={() => handleTabPress(route, isFocused, index)}
              showLabel={showNavigationLabels}
              activeTabIndex={activeTabIndex}
              tabIndex={index}
            />
          );
        })}

        {/* Center Add Button - always visible on allowed tabs */}
        {showAddButton ? (
          <View
            ref={addButtonRef}
            collapsable={false}
            style={styles.addButtonContainer}
            onLayout={() => {
              requestAnimationFrame(() => {
                addButtonRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
                  if (w > 0 && h > 0) {
                    setAddButtonRect({
                      x: pageX,
                      y: pageY,
                      width: w,
                      height: h,
                    });
                  }
                });
              });
            }}
          >
            <AddButton
              onPress={handleAddPress}
              icon={addButtonConfig.icon}
              iconLibrary={addButtonConfig.iconLibrary}
              disabled={isAddButtonDisabled}
            />
          </View>
        ) : (
          <View style={styles.addButtonPlaceholder} />
        )}

        {/* Second half of tabs (Recipe, Profile) */}
        {state.routes.slice(middleIndex).map((route, index) => {
          const actualIndex = middleIndex + index;
          const { options } = descriptors[route.key];
          const isFocused = state.index === actualIndex;
          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={() => handleTabPress(route, isFocused, actualIndex)}
              showLabel={showNavigationLabels}
              activeTabIndex={activeTabIndex}
              tabIndex={actualIndex}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.secondaryDark,
    height: TAB_BAR_HEIGHT,
    alignSelf: 'center',
    borderRadius: theme.radii['2xl'],
    position: 'absolute',
    paddingHorizontal: '5%',
    boxShadow: [
      {
        offsetX: 0,
        offsetY: theme.spacing.sm,
        blurRadius: theme.spacing.md,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.15)',
      },
    ],
    zIndex: theme.zIndex.overlay,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  addButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  addButtonPlaceholder: {
    width: theme.sizes.fab.md + theme.spacing.md, // Same width as addButtonContainer to maintain layout
  },
}));
