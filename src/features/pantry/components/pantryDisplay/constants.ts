import { Dimensions } from 'react-native';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';

// Screen-relative draw distance: 2× viewport gives ~17 items of buffer at
// ~95px/item. useDeferredValue on FlashList data makes pagination non-blocking,
// so the extra buffer is affordable. Previous testing showed 1.5× had too few
// pre-rendered cells (12.2% sustained blanks) while 3×+ was excessive.
export const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 2);

// Minimum height for structural empty states (no home / no home selected)
// so EmptyState's justifyContent:'center' works inside FlashList footer
export const EMPTY_STATE_MIN_HEIGHT = Math.round(
  Dimensions.get('window').height * 0.45,
);

// Module-level constant — avoids creating a new object reference per render
export const MVCP_DISABLED = { disabled: true };

// Default filter tabs for pantry (fallback if none provided)
export const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
  { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
  { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
];
