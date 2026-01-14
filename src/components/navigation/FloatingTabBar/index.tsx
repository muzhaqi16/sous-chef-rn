import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTabBarActions } from '#context/TabBarActionsContext';
import { toastService } from '#/services/toastService';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';

export const TAB_BAR_HEIGHT = 65;

export const FloatingTabBar: React.FC<FloatingTabBarProps> = React.memo(({
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
    setActiveTab,
    isOverlayOpen,
  } = useTabBarActions();

  // Handle add button press - show toast if disabled
  const handleAddPress = useCallback(() => {
    if (isAddButtonDisabled) {
      toastService.info(
        addButtonDisabledMessage ||
          "You don't have permission to perform this action",
      );
      return;
    }
    onAddPress?.();
  }, [isAddButtonDisabled, addButtonDisabledMessage, onAddPress]);
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
      damping: 40,
      stiffness: 250,
    });
    opacity.value = withSpring(shouldHide ? 0 : 1, {
      damping: 40,
      stiffness: 250,
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

  // Split tabs: first half before add button, second half after
  const middleIndex = Math.floor(state.routes.length / 2);

  const renderTabItem = (route: typeof state.routes[0], index: number) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const iconScale = useSharedValue(isFocused ? 1.2 : 1);

    // Update scale when focus changes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      iconScale.value = withSpring(isFocused ? 1.2 : 1, {
        damping: 35,
        stiffness: 250,
      });
    }, [isFocused, iconScale]);

    const onPress = () => {
      // Animate icon scale on press (squeeze then expand)
      iconScale.value = withSequence(
        withSpring(0.85, { damping: 15, stiffness: 300 }),
        withSpring(isFocused ? 1.2 : 1, { damping: 15, stiffness: 300 })
      );

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
        };

        const mainScreen = mainScreenMap[route.name];

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
      }
    };

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const animatedIconStyle = useAnimatedStyle(() => ({
      transform: [{ scale: iconScale.value }],
    }));

    const label = options.title || route.name;

    return (
      <TouchableOpacity
        key={route.key}
        testID={`tab-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        onPress={onPress}
        style={styles.tabItem}
        activeOpacity={0.7}
      >
        <Animated.View style={animatedIconStyle}>
          {options.tabBarIcon && (
            <options.tabBarIcon
              focused={isFocused}
              color={isFocused ? theme.colors.primary : theme.colors.textTertiary}
              size={24}
            />
          )}
        </Animated.View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[containerStyle, styles.container, animatedStyle]} testID="tab-bar">
      <View style={styles.tabsRow}>
        {/* First half of tabs (Pantry, ShoppingList) */}
        {state.routes.slice(0, middleIndex).map((route, index) => renderTabItem(route, index))}

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
        {state.routes.slice(middleIndex).map((route, index) => renderTabItem(route, middleIndex + index))}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.secondaryDark,
    height: TAB_BAR_HEIGHT,
    alignSelf: 'center',
    borderRadius: theme.radii['2xl'],
    position: 'absolute',
    paddingHorizontal: '5%',
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: theme.spacing.sm,
    },
    shadowOpacity: 0.15,
    shadowRadius: theme.spacing.md,
    elevation: 12,
    zIndex: theme.zIndex.overlay,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
  },
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
  addButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  addButtonPlaceholder: {
    width: theme.sizes.fab.md + theme.spacing.md, // Same width as addButtonContainer to maintain layout
  },
}));
