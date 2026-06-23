/**
 * Shopping-list item priority.
 *
 * The API stores priority as an `Int`; the server's
 * `ShoppingListValidators.validatePriority` accepts 0 (low), 1 (medium), or
 * 2 (high). This module is the single source of truth for that mapping so the
 * add screen (`AddEditItem`) and the in-sheet step (`ShoppingListDetailsStep`)
 * can't drift apart.
 */

/** SegmentedControl option keys, low → high. */
export const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

/** Option key → API integer. */
export const PRIORITY_VALUES: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** API integer → option key (for displaying a stored value). */
export const PRIORITY_KEYS: Record<number, string> = {
  0: 'low',
  1: 'medium',
  2: 'high',
};

/** i18n key for an option key (`'low'` → `'shoppingListScreens.priorityLow'`). */
export const priorityLabelKey = (key: string): string =>
  `shoppingListScreens.priority${key[0].toUpperCase()}${key.slice(1)}`;
