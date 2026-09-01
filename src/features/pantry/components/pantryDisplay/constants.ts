import { Dimensions } from 'react-native';
import { t } from '#/i18n';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';

// The ONLY bound on how many cells FlashList mounts, and mounted-cell count
// sets the sustained frame time (Yoga layout + draw over ~43 views per row).
// 0.5x measured least janky on device and survives hard flings without blanks;
// the residual over-budget median is per-row view count, not this constant.
export const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 0.5);

// Minimum height for structural empty states (no home / no home selected)
// so EmptyState's justifyContent:'center' works inside FlashList footer
export const EMPTY_STATE_MIN_HEIGHT = Math.round(
  Dimensions.get('window').height * 0.45,
);

// Module-level constant — avoids creating a new object reference per render
export const MVCP_DISABLED = { disabled: true };

// How many leading items get their images warmed. A bound on preload work
// only — it does NOT limit what the list renders (that is DRAW_DISTANCE's job).
export const IMAGE_PRELOAD_COUNT = 24;

// A function, not a const: at import time these labels would freeze whichever
// language was active when the module loaded, and never see a change.
export const getDefaultPantryTabs = (): FilterTabConfig<LocationFilter>[] => [
  { id: 'all', label: t('pantryTabs.all') },
  {
    id: 'fridge',
    label: t('labels.storageRefrigerated'),
    icon: 'thermometer-outline',
  },
  { id: 'freezer', label: t('labels.storageFrozen'), icon: 'snow-outline' },
  { id: 'pantry', label: t('labels.storageAmbient'), icon: 'cube-outline' },
];
