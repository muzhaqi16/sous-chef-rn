import { Dimensions } from 'react-native';
import { t } from '#/i18n';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';

// Screen-relative draw distance: 2× viewport gives ~17 items of buffer at
// ~95px/item. Previous testing showed 1.5× had too few pre-rendered cells
// (12.2% sustained blanks) while 3×+ was excessive. Two caveats on that
// number: it was taken with the FlashList data behind `useDeferredValue`,
// since removed (docs/flashlist-layout-index-race.md), and the blank-cell
// metric it came from mostly measures scroll velocity
// (docs/flashlist-performance-analysis.md, "Reading the instrumentation").
// If pagination ever feels heavier, judge by long frames, not blank %.
export const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 2);

// Minimum height for structural empty states (no home / no home selected)
// so EmptyState's justifyContent:'center' works inside FlashList footer
export const EMPTY_STATE_MIN_HEIGHT = Math.round(
  Dimensions.get('window').height * 0.45,
);

// Module-level constant — avoids creating a new object reference per render
export const MVCP_DISABLED = { disabled: true };

// Client-side render windowing. With load-all, the full item set (up to the
// API page max) lives in memory so sort/filter/search are instant — but we hand
// FlashList only a growing slice so it never has to mount ~100 cells at once.
// The window starts at INITIAL_RENDER_WINDOW and grows by RENDER_WINDOW_STEP
// each time the user scrolls to the end (until the loaded set is exhausted).
export const INITIAL_RENDER_WINDOW = 24;
export const RENDER_WINDOW_STEP = 24;

/**
 * Default filter tabs (fallback when a host passes none).
 *
 * A function, not a const: evaluated at import time these labels would freeze
 * whatever language was active when the module first loaded, and a later
 * language change would never reach them.
 */
export const getDefaultPantryTabs = (): FilterTabConfig<LocationFilter>[] => [
  { id: 'all', label: t('pantryTabs.all') },
  { id: 'fridge', label: t('pantryTabs.fridge'), icon: 'thermometer-outline' },
  { id: 'freezer', label: t('pantryTabs.freezer'), icon: 'snow-outline' },
  { id: 'pantry', label: t('pantryTabs.pantry'), icon: 'cube-outline' },
];
