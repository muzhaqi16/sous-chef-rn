import { Dimensions } from 'react-native';
import type { Translate } from '#/i18n/types';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';

// The ONLY bound on how many cells FlashList mounts, and the mounted count sets
// the sustained frame time. 0.5x is the least janky on device that still
// survives hard flings without blanks.
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

// A function of the caller's `t`, not a const: a const would keep the language
// the module loaded in, and the module's own `t` the one a caller first
// rendered in.
export const getDefaultPantryTabs = (
  translate: Translate,
): FilterTabConfig<LocationFilter>[] => [
  { id: 'all', label: translate('pantryTabs.all') },
  {
    id: 'fridge',
    label: translate('labels.storageRefrigerated'),
    icon: 'thermometer-outline',
  },
  {
    id: 'freezer',
    label: translate('labels.storageFrozen'),
    icon: 'snow-outline',
  },
  {
    id: 'pantry',
    label: translate('labels.storageAmbient'),
    icon: 'cube-outline',
  },
];
