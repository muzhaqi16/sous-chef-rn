import { Platform } from 'react-native';
import { sizes } from '#/theme/foundations/sizes';

/**
 * The floating tab bar's height, labels shown or hidden: M3 Expressive's
 * floating toolbar is 64dp, and platform tab bars keep their height and centre
 * the icons when labels hide.
 */
export const TAB_BAR_HEIGHT = 64;

/** M3's floating-toolbar `ScreenOffset`, applied above the navigation-bar inset. */
const ANDROID_SCREEN_OFFSET = 16;

/** How far the bar's bottom edge sits above the screen's. */
export const getTabBarBottomOffset = (safeBottom: number): number =>
  Platform.OS === 'ios'
    ? Math.max(safeBottom * 0.7, 16)
    : safeBottom + ANDROID_SCREEN_OFFSET;

/** The gap between the bar's top edge and the action button floating above it. */
export const FLOATING_BUTTON_GAP = 12;

/** Bottom padding that clears the floating tab bar and the safe area. */
export const getTabBarBottomPadding = (safeBottom: number): number =>
  Math.max(safeBottom, getTabBarBottomOffset(safeBottom)) + TAB_BAR_HEIGHT + 16;

/**
 * Bottom padding for a SCROLLING list, which has to clear the action button
 * floating above the bar as well. This is trailing slack after the last row: it
 * adds scroll distance at the end and takes no visible space, so a surface that
 * is centred rather than scrolled takes {@link getTabBarBottomPadding} instead.
 */
export const getScrollClearancePadding = (safeBottom: number): number =>
  getTabBarBottomPadding(safeBottom) + sizes.fab.md + FLOATING_BUTTON_GAP;
