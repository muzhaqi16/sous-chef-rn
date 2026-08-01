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
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import {
  useTabBarState,
  useTabBarSetters,
} from '#context/TabBarActionsContext';
import {
  useOverlayBackdropOpacity,
  useOverlayBackdropPresence,
} from '#components/providers/OverlayBackdropProvider';
import { toastService } from '#/services/toastService';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';
import { TabItem } from './TabItem';
import { useShowNavigationLabels } from '#store/useAppStore';
import { HapticService } from '#services/haptic/HapticService';
import { SPRING, SHEET, TAB_BAR } from '#/constants/animations';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

export const TAB_BAR_HEIGHT = 65;

// Dark translucent tint layered over the liquid-glass material so the bar keeps
// its dark identity and white icons/labels stay legible while list content
// refracts softly through it. Static — the bar is dark in both themes.
const GLASS_TINT = 'rgba(28, 27, 32, 0.4)';

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
  } = useTabBarState();

  // "An overlay is dimming the screen" — true for every backdrop claim (sheets
  // and selectors alike), derived from the global backdrop's slot count. This
  // replaces the selector-only `isOverlayOpen` for the scroll-hide reset so the
  // reset now covers sheets too.
  const overlayPresent = useOverlayBackdropPresence();
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

  // Bar visibility is the max of two independent hide sources, both 0…1:
  // - Overlay coverage: the global dim opacity (driven on the UI thread by the
  //   open sheet's `animatedIndex`), normalized back to 0…1. Reading the same
  //   SharedValue as the backdrop keeps the bar in lockstep with the sheet —
  //   it slides back AS the sheet slides down, with no settled-closed callback.
  // - Scroll hide: a spring toggled by scroll direction.
  // Detail screens don't factor in here: they're siblings of the tab navigator
  // (see RootNavigator), so the bar is structurally absent on them.
  const overlayOpacity = useOverlayBackdropOpacity();
  const scrollHide = useSharedValue(0);

  // Track active tab for scanner visibility
  useEffect(() => {
    const activeRoute = state.routes[state.index];
    setActiveTab(activeRoute.name);
  }, [state.index, state.routes, setActiveTab]);

  // Clear any scroll-hidden state when an overlay opens so the bar returns to a
  // known (visible) state once the overlay closes.
  useLayoutEffect(() => {
    if (overlayPresent) {
      scrollTabBarHidden.set(false);
    }
  }, [overlayPresent, scrollTabBarHidden]);

  // Scroll hide animates with a spring (toggled by scroll direction).
  useAnimatedReaction(
    () => scrollTabBarHidden.get(),
    (hidden, prevHidden) => {
      if (hidden === prevHidden) return;
      scrollHide.set(withSpring(hidden ? 1 : 0, SPRING.HEAVY));
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    // Sheets contribute dim opacity as `interpolate(animatedIndex, [-1,0], [0,
    // BACKDROP_OPACITY])`; dividing by `BACKDROP_OPACITY` inverts that back to
    // overlay coverage, 0 (closed) → 1 (fully open).
    const overlayHide = overlayOpacity
      ? Math.min(1, overlayOpacity.get() / SHEET.BACKDROP_OPACITY)
      : 0;
    const hide = Math.max(overlayHide, scrollHide.get());
    return {
      transform: [{ translateY: hide * TAB_BAR.HIDDEN_TRANSLATE_Y }],
      opacity: 1 - hide,
    };
  });

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
      style={[
        containerStyle,
        styles.container,
        isLiquidGlassSupported && styles.containerGlass,
        animatedStyle,
      ]}
      testID="tab-bar"
    >
      {isLiquidGlassSupported ? (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor={GLASS_TINT}
          style={styles.glassFill}
          pointerEvents="none"
        />
      ) : null}
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
    borderCurve: 'continuous',
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
  // iOS 26 Liquid Glass: drop the solid fill so the glass material shows
  // through. (Android / iOS < 26 keep the solid `secondaryDark` above.)
  containerGlass: {
    backgroundColor: 'transparent',
  },
  // Glass material layer behind the tabs; self-clips to the bar radius and
  // ignores touches so taps reach the tab buttons.
  glassFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radii['2xl'],
    borderCurve: 'continuous',
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
