/**
 * Tab bar height matches FloatingTabBar's TAB_BAR_HEIGHT (65px).
 * Inlined here to avoid circular imports while providing a single source of truth
 * for layout calculations that depend on the tab bar.
 */
export const TAB_BAR_HEIGHT = 65;

/**
 * Calculate bottom padding that accounts for the floating tab bar + safe area.
 * Replaces the repeated `TAB_BAR_HEIGHT + safeBottom + 16` pattern.
 */
export const getTabBarBottomPadding = (safeBottom: number): number =>
  TAB_BAR_HEIGHT + safeBottom + 16;
