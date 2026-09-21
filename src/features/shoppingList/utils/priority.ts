// Priority is an API `Int` validated server-side as 0 (low) / 1 (medium) /
// 2 (high). The option list is the single source: an option's index IS its
// API value, so the add screen, the in-sheet step and the detail cannot drift.

import type { TranslationKey } from '#/i18n';

const optionIds = <T extends string>(...ids: T[]): readonly T[] => ids;

/** SegmentedControl option ids, low → high. Option ids, not i18n keys. */
export const PRIORITY_OPTIONS = optionIds('low', 'medium', 'high');

type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

export const priorityValueOf = (option: PriorityOption): number =>
  PRIORITY_OPTIONS.indexOf(option);

/** `undefined` for an integer outside the option list. */
export const priorityOptionOf = (value: number): PriorityOption | undefined =>
  PRIORITY_OPTIONS[value];

const PRIORITY_LABEL_KEYS: Record<PriorityOption, TranslationKey> = {
  low: 'shoppingListScreens.priorityLow',
  medium: 'shoppingListScreens.priorityMedium',
  high: 'shoppingListScreens.priorityHigh',
};

export const priorityLabelKey = (option: PriorityOption): TranslationKey =>
  PRIORITY_LABEL_KEYS[option];
