import { Dimensions } from 'react-native';
import { t } from '#/i18n';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';

// Screen-relative draw distance: 2× viewport gives ~17 items of buffer at
// ~95px/item. 1× narrows the per-append mount burst but is indistinguishable on
// dropped-frame time in a release build, and noisier — the frame cost on device
// is sustained Yoga layout and RenderThread draw work proportional to the number
// of mounted views, not the size of any single append. Judge a change to this
// number on a release build; a debug build overstates the append and an emulator
// hides it behind GPU-transport wait.
// Screen-relative draw distance. Since the local render window was removed
// this is the ONLY thing bounding how many cells FlashList mounts, and every
// full-list re-render pays per mounted cell. Measured: at 2x the mounted set
// was 54 cells, at 1x it is 32 (it was 24 while the window still capped it).
//
// An earlier 2x-vs-1x A/B on COLD START read flat — consistent, because back
// then the render window capped mounts regardless, so this constant could not
// matter. It matters now. Verified on device: scroll's worst commit went from
// 597 ms to 29 ms with the window gone and this at 1x.
export const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 1);

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
