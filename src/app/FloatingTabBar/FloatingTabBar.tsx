import React, { useEffect, useLayoutEffect, useRef } from 'react';
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
import { useTranslation } from '#/i18n';
import type { FloatingTabBarProps } from './types';
import { AddButton } from './AddButton';
import { TabItem } from './TabItem';
import { useShowNavigationLabels } from '#store/useAppStore';
import { HapticService } from '#services/haptic/HapticService';
import { SHEET, TAB_BAR } from '#/constants/animations';
import { GlassSurface, supportsGlass } from '#components/atoms/GlassSurface';
import { motion } from '#/theme/foundations/motion';

export const TAB_BAR_HEIGHT = 65;

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { t } = useTranslation();
  const {
    onAddPress,
    showAddButton,
    addButtonConfig,
    isAddButtonDisabled,
    addButtonDisabledMessage,
  } = useTabBarState();

  // True for every backdrop claim, sheets and selectors alike, from the global
  // backdrop's slot count — broader than the selector-only `isOverlayOpen`.
  const overlayPresent = useOverlayBackdropPresence();
  const { setActiveTab, setAddButtonRect, scrollTabBarHidden } =
    useTabBarSetters();

  const addButtonRef = useRef<View>(null);

  const showNavigationLabels = useShowNavigationLabels();

  const handleAddPress = () => {
    if (isAddButtonDisabled) {
      toastService.info(
        addButtonDisabledMessage || t('errors.codes.forbidden'),
      );
      return;
    }
    onAddPress?.();
  };
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const tabBarWidth = screenWidth * 0.95;

  const activeTabIndex = useSharedValue(state.index);

  useLayoutEffect(() => {
    activeTabIndex.set(state.index);
  }, [state.index, activeTabIndex]);

  // Visibility is the max of two 0…1 hide sources: overlay coverage (the global
  // dim opacity, so the bar moves in lockstep with the sheet's own
  // `animatedIndex` rather than waiting on a settled-closed callback) and the
  // scroll-hide spring. Detail screens are siblings of the tab navigator, so they
  // cover the bar outright and never factor in.
  const overlayOpacity = useOverlayBackdropOpacity();
  const scrollHide = useSharedValue(0);

  useEffect(() => {
    const activeRoute = state.routes[state.index];
    setActiveTab(activeRoute.name);
  }, [state.index, state.routes, setActiveTab]);

  // Clear scroll-hidden state on overlay open, so the bar returns visible.
  useLayoutEffect(() => {
    if (overlayPresent) {
      scrollTabBarHidden.set(false);
    }
  }, [overlayPresent, scrollTabBarHidden]);

  useAnimatedReaction(
    () => scrollTabBarHidden.get(),
    (hidden, prevHidden) => {
      if (hidden === prevHidden) return;
      scrollHide.set(withSpring(hidden ? 1 : 0, motion.spring.HEAVY));
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    // Sheets contribute dim opacity scaled by BACKDROP_OPACITY; dividing inverts
    // it back to coverage, 0 (closed) → 1 (fully open).
    const overlayHide = overlayOpacity
      ? Math.min(1, overlayOpacity.get() / SHEET.BACKDROP_OPACITY)
      : 0;
    const hide = Math.max(overlayHide, scrollHide.get());
    return {
      transform: [{ translateY: hide * TAB_BAR.HIDDEN_TRANSLATE_Y }],
      opacity: 1 - hide,
    };
  });

  const containerStyle = {
    width: tabBarWidth,
    bottom:
      Platform.OS === 'ios'
        ? Math.max(safeBottom * 0.5, 16)
        : Math.max(safeBottom, 16),
  };

  const middleIndex = Math.floor(state.routes.length / 2);

  const handleTabPress = (
    route: { key: string; name: string; params?: object },
    isFocused: boolean,
    targetIndex: number,
  ) => {
    activeTabIndex.set(targetIndex);
    HapticService.selection();

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      const mainScreen = tabs[route.name]?.mainScreen;

      // A NORMAL update, never a transition: with no scheduling deadline a stream
      // of Immediate-priority renders elsewhere can starve it for seconds, leaving
      // the icon flipped while the screen stays on the old route.
      if (!isFocused) {
        // HomeTabs runs `inactiveBehavior: 'none'`, so the blurred tab's tree is
        // still mounted and focusing it is all that's needed.
        navigation.navigate(route.name);
      } else if (mainScreen) {
        navigation.navigate(route.name, {
          screen: mainScreen,
          initial: false,
        });
      }
    }
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        styles.container,
        supportsGlass && styles.containerGlass,
        animatedStyle,
      ]}
      testID="tab-bar"
    >
      <GlassSurface style={styles.glassFill} />
      <View style={styles.tabsRow}>
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
              icon={tabs[route.name]?.icon}
              showLabel={showNavigationLabels}
              activeTabIndex={activeTabIndex}
              tabIndex={index}
            />
          );
        })}

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
              icon={tabs[route.name]?.icon}
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
    backgroundColor: theme.colors.surface,
    height: TAB_BAR_HEIGHT,
    alignSelf: 'center',
    borderRadius: theme.radii['2xl'],
    borderCurve: 'continuous',
    position: 'absolute',
    paddingHorizontal: '5%',
    ...theme.shadows.lg,
    zIndex: theme.zIndex.overlay,
  },
  // iOS 26 Liquid Glass drops the solid fill; Android / iOS < 26 keep it.
  containerGlass: {
    backgroundColor: 'transparent',
  },
  // Self-clips to the bar radius and ignores touches so taps reach the buttons.
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
