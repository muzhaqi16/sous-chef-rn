import React, { startTransition, useEffect, useLayoutEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useTabBarState, useTabBarSetters } from '#context/TabBarActionsContext';
import { toastService } from '#/services/toastService';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';
import { TabItem } from './TabItem';
import { useShowNavigationLabels } from '#hooks/settings/useSettings';
import { HapticService } from '#services/haptic/HapticService';
import { SPRING, TIMING } from '#/constants/animations';

export const TAB_BAR_HEIGHT = 65;

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({ state, descriptors, navigation }) => {
    const {
      onAddPress,
      showAddButton,
      addButtonConfig,
      isAddButtonDisabled,
      addButtonDisabledMessage,
      isOverlayOpen } = useTabBarState();
    const { setActiveTab } = useTabBarSetters();

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
    useLayoutEffect(() => {
      const shouldHide = isOverlayOpen || shouldHideFromNavigation;

      // Fast timing for opacity (linear, no spring)
      opacity.set(withTiming(shouldHide ? 0 : 1, { duration: TIMING.FAST }));

      // Snappy spring with subtle bounce (higher damping = less bounce)
      translateY.set(withSpring(shouldHide ? 150 : 0, SPRING.HEAVY));
    }, [isOverlayOpen, shouldHideFromNavigation, translateY, opacity]);

    // Animated style for smooth transitions
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value }));

    // Memoize container style
    const containerStyle = ({
        width: tabBarWidth,
        bottom:
          Platform.OS === 'ios'
            ? Math.max(safeBottom * 0.5, 16)
            : Math.max(safeBottom, 16) });

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
          canPreventDefault: true });

        if (!event.defaultPrevented) {
          // Map tab names to their main screens for stack reset
          const mainScreenMap: Record<string, string> = {
            Pantry: 'PantryMain',
            ShoppingList: 'ShoppingListMain',
            Recipe: 'RecipeMain',
            MealPlan: 'MealPlanMain' };

          const mainScreen = mainScreenMap[route.name];

          // Wrap in startTransition so React treats the navigation as a non-urgent
          // update — the current screen stays visible while the target mounts,
          // allowing skeleton fallbacks to paint instead of freezing the UI.
          startTransition(() => {
            if (mainScreen) {
              // Navigate to tab AND reset stack to main screen
              navigation.navigate(route.name, {
                screen: mainScreen,
                initial: false, // Forces stack reset
              });
            } else {
              // Profile or other tabs without nested stacks
              if (!isFocused) {
                navigation.navigate(route.name, route.params);
              }
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
            <View style={styles.addButtonContainer}>
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
    boxShadow: [{ offsetX: 0, offsetY: theme.spacing.sm, blurRadius: theme.spacing.md, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.15)' }],
    zIndex: theme.zIndex.overlay },
  tabsRow: {
    flex: 1,
    flexDirection: 'row' },
  addButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm },
  addButtonPlaceholder: {
    width: theme.sizes.fab.md + theme.spacing.md, // Same width as addButtonContainer to maintain layout
  } }));
