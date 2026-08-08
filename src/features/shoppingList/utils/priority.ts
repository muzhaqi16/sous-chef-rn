/**
 * Shopping-list item priority.
 *
 * The API stores priority as an `Int`; the server's
 * `ShoppingListValidators.validatePriority` accepts 0 (low), 1 (medium), or
 * 2 (high). This module is the single source of truth for that mapping so the
 * add screen (`AddEditItem`) and the in-sheet step (`ShoppingListDetailsStep`)
 * can't drift apart.
 */

/**
 * SegmentedControl option ids, low → high.
 *
 * These are option ids, not i18n keys — `priorityLabelKey` composes each one
 * into a whole key under `shoppingListScreens.*`.
 */
export const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

/** Option id → API integer. */
export const PRIORITY_VALUES: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** API integer → option id (for displaying a stored value). */
export const PRIORITY_OPTION_BY_VALUE: Record<number, string> = {
  0: 'low',
  1: 'medium',
  2: 'high',
};

/**
 * Composes an option id into the whole i18n key for its label, resolved under
 * `shoppingListScreens.*` — `'low'` → `'shoppingListScreens.priorityLow'`.
 */
export const priorityLabelKey = (option: string): string =>
  `shoppingListScreens.priority${option[0].toUpperCase()}${option.slice(1)}`;
