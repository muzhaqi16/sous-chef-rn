import React, { useEffect, useLayoutEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
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
import { AddMenu } from './AddMenu';
import { TabItem } from './TabItem';
import {
  useShowNavigationLabels,
  useThemePreferences,
} from '#store/useAppStore';
import { FONT_SCALE_META } from '#/theme/foundations/appearanceConfig';
import { HapticService } from '#services/haptic/HapticService';
import { SHEET, TAB_BAR } from '#/constants/animations';
import { GlassSurface, supportsGlass } from '#components/atoms/GlassSurface';
import { motion } from '#/theme/motion';
import {
  TAB_BAR_HEIGHT,
  FLOATING_BUTTON_GAP,
  getTabBarBottomOffset,
} from '#constants/layout';
import { kitTestIDs } from '#components/testIDs';
import { sizes } from '#/theme/foundations/sizes';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { showAddButton, addButtonConfig, addMenu, isAddMenuOpen } =
    useTabBarState();
  const {
    width: windowWidth,
    height: windowHeight,
    fontScale,
  } = useWindowDimensions();
  const isNarrow = windowWidth < NARROW_WIDTH;
  // A label can outgrow its tab on a narrow screen or with text enlarged by the
  // OS or the app's own font size.
  const { fontScalePreference } = useThemePreferences();
  const fitLabels =
    isNarrow ||
    fontScale > 1 ||
    FONT_SCALE_META[fontScalePreference].multiplier > 1;
  // Landscape keeps the chrome to one row: a capped, centred bar with the `+`
  // beside it, inside the side insets a cutout or rounded corner takes.
  const isLandscape = windowWidth > windowHeight;

  // True for every backdrop claim, sheets and selectors alike, from the global
  // backdrop's slot count — broader than the selector-only `isOverlayOpen`.
  const overlayPresent = useOverlayBackdropPresence();
  const { setActiveTab, setAddButtonRect, setAddMenuOpen, scrollTabBarHidden } =
    useTabBarSetters();

  const { ref: addButtonRef, measure: measureAddButton } =
    useMeasuredRect(setAddButtonRect);

  const showNavigationLabels = useShowNavigationLabels();

  // A menu of one is its action; of two or more, the `+` opens it.
  const [onlyAction] = addMenu ?? [];
  const hasMenu = !!addMenu && addMenu.length > 1;
  const menuProgress = useSharedValue(0);
  // The scrim fades on its own: the `+`'s under-damped spring would swing its
  // opacity past open and back several times before it settles.
  const menuFade = useSharedValue(0);
  useEffect(() => {
    const opening = hasMenu && isAddMenuOpen;
    menuProgress.set(withSpring(opening ? 1 : 0, motion.spring.SNAPPY));
    menuFade.set(
      withTiming(opening ? 1 : 0, {
        duration: opening ? SHEET.BACKDROP_FADE_IN : SHEET.BACKDROP_FADE_OUT,
      }),
    );
  }, [hasMenu, isAddMenuOpen, menuProgress, menuFade]);
  const closeAddMenu = () => setAddMenuOpen(false);

  const handleAddPress = () => {
    if (hasMenu) {
      setAddMenuOpen(!isAddMenuOpen);
    } else if (onlyAction?.disabledReason) {
      toastService.info(onlyAction.disabledReason);
    } else {
      onlyAction?.onPress();
    }
  };
  const {
    bottom: safeBottom,
    left: safeLeft,
    right: safeRight,
  } = useSafeAreaInsets();

  const activeTabIndex = useSharedValue(state.index);

  useLayoutEffect(() => {
    activeTabIndex.set(state.index);
  }, [state.index, activeTabIndex]);

  // Hidden by the max of the global dim opacity, which moves the bar in
  // lockstep with a sheet's `animatedIndex`, and the scroll-hide spring.
  // Detail screens cover the bar outright as the tab navigator's siblings.
  const overlayOpacity = useOverlayBackdropOpacity();
  const scrollHide = useSharedValue(0);

  useEffect(() => {
    const activeRoute = state.routes[state.index];
    if (activeRoute) setActiveTab(activeRoute.name);
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

  const animatedTheme = useAnimatedTheme();
  const overlayLayerStyle = useAnimatedStyle(() => ({
    zIndex: animatedTheme.get().zIndex.overlay,
  }));
  const barSurfaceStyle = useAnimatedStyle(() => {
    const theme = animatedTheme.get();
    const row = isLandscape
      ? landscapeRow(
          windowWidth,
          safeLeft,
          safeRight,
          theme.layout.pageGutter,
          showAddButton,
        )
      : null;
    return {
      left: row ? row.barLeft : theme.layout.pageGutter,
      right: row ? row.barRight : theme.layout.pageGutter,
      borderRadius: theme.radii.full,
      ...theme.shadows.lg,
      // iOS 26 Liquid Glass drops the solid fill; Android / iOS < 26 keep it.
      ...(supportsGlass
        ? {}
        : { backgroundColor: theme.colors.navigationSurface }),
    };
  });
  // Flush with the bar's right edge, or beside it in landscape.
  const addButtonOffsetStyle = useAnimatedStyle(() => {
    const gutter = animatedTheme.get().layout.pageGutter;
    return {
      right: isLandscape
        ? landscapeRow(windowWidth, safeLeft, safeRight, gutter, true)
            .buttonRight
        : gutter,
    };
  });

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

  const barBottom = getTabBarBottomOffset(safeBottom);

  const containerStyle = { bottom: barBottom };

  const floatingButtonStyle = {
    bottom: isLandscape
      ? barBottom + (TAB_BAR_HEIGHT - sizes.fab.md) / 2
      : barBottom + TAB_BAR_HEIGHT + FLOATING_BUTTON_GAP,
  };

  const handleTabPress = (
    route: { key: string; name: string; params?: object },
    isFocused: boolean,
    targetIndex: number,
  ) => {
    activeTabIndex.set(targetIndex);
    HapticService.selection();

    // The library tab bar's rule: a press on the focused tab is a repeat, which
    // native-stack answers by popping that tab's stack to its first screen.
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
      data: { behavior: { scrollToTop: isFocused, popToTop: isFocused } },
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

  const bar = (
    <Animated.View
      style={[
        containerStyle,
        styles.container,
        isNarrow && styles.containerNarrow,
        overlayLayerStyle,
        barSurfaceStyle,
        animatedStyle,
      ]}
      testID={kitTestIDs.tabBar}
    >
      <GlassSurface style={styles.glassFill} />
      <View style={styles.edge} />
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options ?? {};
          const isFocused = state.index === index;
          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={() => handleTabPress(route, isFocused, index)}
              icon={tabs[route.name]?.icon}
              titleKey={tabs[route.name]?.titleKey}
              showLabel={showNavigationLabels}
              fitLabel={fitLabels}
              activeTabIndex={activeTabIndex}
              tabIndex={index}
            />
          );
        })}
      </View>
    </Animated.View>
  );

  const floatingAddButton = showAddButton ? (
    <Animated.View
      ref={addButtonRef}
      collapsable={false}
      style={[
        floatingButtonStyle,
        styles.floatingAddButton,
        overlayLayerStyle,
        addButtonOffsetStyle,
        animatedStyle,
      ]}
      onLayout={measureAddButton}
    >
      <AddButton
        onPress={handleAddPress}
        icon={addButtonConfig.icon}
        iconLibrary={addButtonConfig.iconLibrary}
        disabled={!hasMenu && !!onlyAction?.disabledReason}
        {...(hasMenu && { menuOpen: isAddMenuOpen, menuProgress })}
      />
    </Animated.View>
  ) : null;

  // Between the bar and the `+`, so the `+` stays above its own scrim.
  const addMenuLayer =
    showAddButton && hasMenu ? (
      <AddMenu
        actions={addMenu}
        open={isAddMenuOpen}
        fade={menuFade}
        buttonBottom={floatingButtonStyle.bottom}
        onClose={closeAddMenu}
      />
    ) : null;

  return (
    <>
      {bar}
      {addMenuLayer}
      {floatingAddButton}
    </>
  );
};

/** Below this width (dp) the bar trims its side padding. */
const NARROW_WIDTH = 400;
/** The widest the bar grows in landscape (dp): five tabs need no more. */
const LANDSCAPE_BAR_MAX_WIDTH = 520;

/**
 * Landscape's one row, centred between the side insets: the bar, then the `+`
 * a gap to its right. Offsets are from each screen edge.
 */
function landscapeRow(
  windowWidth: number,
  safeLeft: number,
  safeRight: number,
  gutter: number,
  withButton: boolean,
) {
  'worklet';
  const leftEdge = safeLeft + gutter;
  const rightEdge = safeRight + gutter;
  const button = withButton ? sizes.fab.md + FLOATING_BUTTON_GAP : 0;
  const available = windowWidth - leftEdge - rightEdge;
  const barWidth = Math.min(available - button, LANDSCAPE_BAR_MAX_WIDTH);
  const offset = (available - barWidth - button) / 2;
  const barLeft = leftEdge + offset;
  return {
    barLeft,
    barRight: windowWidth - barLeft - barWidth,
    buttonRight: rightEdge + offset,
  };
}

const styles = StyleSheet.create(theme => ({
  // Themed values are in `barSurfaceStyle` and `overlayLayerStyle`.
  container: {
    height: TAB_BAR_HEIGHT,
    borderCurve: 'continuous',
    position: 'absolute',
    paddingHorizontal: '5%',
  },
  // A 360 dp phone gives each tab too little for "Meal Plan" at 5%.
  containerNarrow: {
    paddingHorizontal: '2%',
  },
  // Self-clips to the bar radius and ignores touches so taps reach the buttons.
  glassFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
  },
  // Over the glass, not the bar's own border: a border insets the glass by its
  // width, and the glass's lighter rim then shows inside the line.
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    // Matches the add button's fill.
    borderColor: theme.colors.primary,
    pointerEvents: 'none',
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  floatingAddButton: {
    position: 'absolute',
  },
}));
