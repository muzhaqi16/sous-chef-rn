/**
 * The floating tab bar's height, and the single definition of it: the bar
 * renders at this height and every list's bottom padding is derived from it.
 */
export const TAB_BAR_HEIGHT = 65;

/**
 * The action button floats above the bar's right edge, so a list has to scroll
 * clear of the button, not just the bar. This is trailing slack after the last
 * row — it adds scroll distance at the end and takes no visible space.
 */
const FLOATING_ACTION_CLEARANCE = 68;

/** Bottom padding that clears the floating tab bar, its button, and the safe area. */
export const getTabBarBottomPadding = (safeBottom: number): number =>
  TAB_BAR_HEIGHT + safeBottom + 16 + FLOATING_ACTION_CLEARANCE;
