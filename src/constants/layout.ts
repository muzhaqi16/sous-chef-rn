import { sizes } from '#/theme/foundations/sizes';

/**
 * The floating tab bar's height, and the single definition of it: the bar
 * renders at this height and every list's bottom padding is derived from it.
 */
export const TAB_BAR_HEIGHT = 65;

/** The gap between the bar's top edge and the action button floating above it. */
export const FLOATING_BUTTON_GAP = 12;

/** Bottom padding that clears the floating tab bar and the safe area. */
export const getTabBarBottomPadding = (safeBottom: number): number =>
  TAB_BAR_HEIGHT + safeBottom + 16;

/**
 * Bottom padding for a SCROLLING list, which has to clear the action button
 * floating above the bar as well. This is trailing slack after the last row: it
 * adds scroll distance at the end and takes no visible space, so a surface that
 * is centred rather than scrolled takes {@link getTabBarBottomPadding} instead.
 */
export const getScrollClearancePadding = (safeBottom: number): number =>
  getTabBarBottomPadding(safeBottom) + sizes.fab.md + FLOATING_BUTTON_GAP;
