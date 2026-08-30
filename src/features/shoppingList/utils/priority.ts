// Priority is an API `Int` validated server-side as 0 (low) / 1 (medium) /
// 2 (high). Single source for that mapping, so the add screen and the in-sheet
// step can't drift apart.

/** SegmentedControl option ids, low → high. Option ids, not i18n keys. */
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

/** `'low'` → `'shoppingListScreens.priorityLow'`. */
export const priorityLabelKey = (option: string): string =>
  `shoppingListScreens.priority${option[0].toUpperCase()}${option.slice(1)}`;
