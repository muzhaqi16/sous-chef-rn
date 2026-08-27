import { Dimensions } from 'react-native';
import { t } from '#/i18n';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';

// Screen-relative draw distance. Since the local render window was removed this
// is the ONLY thing bounding how many cells FlashList mounts, and on device the
// SUSTAINED frame cost is Yoga layout + RenderThread draw over the mounted view
// tree — roughly 43 views per row — so mounted-cell count sets the frame time.
//
// Measured on an SM-S908U1 (96 Hz panel, 10.4 ms budget), 92 items, thermal 0,
// warmed, 2 trials each, identical 12-swipe gesture:
//
//   2x + render window (old): 9.63% janky, 99th 34 ms, 11 frames >=32 ms
//   1x                      : 9.7-10.1%,   99th 30-31 ms, 6-9 frames
//   0.5x  (this)            : 7.9%,        99th 27-28 ms, 3-6 frames
//
// 0.5x also survives six hard flings with no blank cells. Note the median frame
// only moves 17 -> 16 ms: it stays above the 10.4 ms budget at every setting,
// because that floor is per-row view count, not this constant.
export const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 0.5);

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
// How many leading items get their images warmed. A bound on preload work
// only — it does NOT limit what the list renders (that is DRAW_DISTANCE's job).
// Replaces the old INITIAL_RENDER_WINDOW/RENDER_WINDOW_STEP pair, which was a
// second virtualization layered on FlashList's own.
export const IMAGE_PRELOAD_COUNT = 24;

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
