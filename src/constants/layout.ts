/**
 * The floating tab bar's height, and the single definition of it: the bar
 * renders at this height and every list's bottom padding is derived from it.
 */
export const TAB_BAR_HEIGHT = 65;

/**
 * Calculate bottom padding that accounts for the floating tab bar + safe area.
 * Replaces the repeated `TAB_BAR_HEIGHT + safeBottom + 16` pattern.
 */
export const getTabBarBottomPadding = (safeBottom: number): number =>
  TAB_BAR_HEIGHT + safeBottom + 16;
