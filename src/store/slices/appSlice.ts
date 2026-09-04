import { StateCreator } from 'zustand';
import type { RootState } from '../index';
import type {
  CategorySuggestion,
  ItemSuggestion,
} from '#/graphql/generated/schemaTypes';
import { dedupeById } from '#features/catalog/utils/arrayUtils';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

// Reference data cached while online (see useDataPreloading) so the
// autocomplete hooks can serve suggestions locally when offline.
export interface CachedBrand {
  id: string;
  name: string;
}

export interface CachedStore {
  id: string;
  name: string;
  address?: string | null;
}

/**
 * Max catalog item suggestions kept in the local-first LRU. The catalog itself
 * is far too large to cache, so we keep only items the user has actually seen
 * (most-recently-seen first), bounded so persisted state stays small.
 */
const MAX_CACHED_ITEM_SUGGESTIONS = 150;

// Navigation state machine for explicit flow control
export type NavigationState =
  | 'loading' // App is loading/hydrating
  | 'auth' // User needs to authenticate
  | 'verification' // Email verification needed
  | 'biometric_setup' // Post-login biometric setup
  | 'onboarding' // User onboarding flow
  | 'main_app'; // Fully authenticated main app

export interface AppState {
  isHydrated: boolean;
  // NOTE: isLoading, isError, isFetching are owned by uiSlice — do NOT duplicate here
  isLoggingOut: boolean; // Global logout state

  // Navigation state machine
  navigationState: NavigationState;
  showBiometricSetup: boolean; // Controls biometric setup modal

  // Who the post-login biometric offer is for. The password is deliberately
  // absent: enrolment authorises off the live session, so nothing downstream
  // needs it and holding it would be the only copy in app memory.
  postLoginCredentials: { email: string } | null;

  cachedUnits: Unit[];
  lastUnitsFetchedAt: number | null;

  // Reference data warmed while online for offline-first autocomplete.
  cachedCategories: CategorySuggestion[];
  lastCategoriesFetchedAt: number | null;
  cachedBrands: CachedBrand[];
  lastBrandsFetchedAt: number | null;
  cachedStores: CachedStore[];
  lastStoresFetchedAt: number | null;
  // Catalog items the user has seen, kept as a bounded LRU (no TTL — it grows
  // and self-evicts as the user browses).
  cachedItemSuggestions: ItemSuggestion[];

  setHydrated: (flag: boolean) => void;
  setLoggingOut: (flag: boolean) => void;

  // Navigation state actions
  setNavigationState: (state: NavigationState) => void;
  setShowBiometricSetup: (flag: boolean) => void;
  setPostLoginCredentials: (credentials: { email: string } | null) => void;

  setCachedUnits: (units: Unit[]) => void;
  setLastUnitsFetchedAt: (timestamp: number) => void;

  setCachedCategories: (categories: CategorySuggestion[]) => void;
  setLastCategoriesFetchedAt: (timestamp: number) => void;
  setCachedBrands: (brands: CachedBrand[]) => void;
  setLastBrandsFetchedAt: (timestamp: number) => void;
  setCachedStores: (stores: CachedStore[]) => void;
  setLastStoresFetchedAt: (timestamp: number) => void;
  /** Merge newly-seen catalog items into the LRU (most-recent first, capped). */
  addCachedItemSuggestions: (items: ItemSuggestion[]) => void;
}

export const initialAppState = {
  isHydrated: false,
  isLoggingOut: false,

  // Navigation state machine
  navigationState: 'loading' as NavigationState,
  showBiometricSetup: false,
  postLoginCredentials: null,

  cachedUnits: [],
  lastUnitsFetchedAt: null,

  cachedCategories: [],
  lastCategoriesFetchedAt: null,
  cachedBrands: [],
  lastBrandsFetchedAt: null,
  cachedStores: [],
  lastStoresFetchedAt: null,
  cachedItemSuggestions: [],
};

export const createAppSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AppState
> = set => ({
  ...initialAppState,

  setHydrated: flag => set({ isHydrated: flag }),
  setLoggingOut: flag => set({ isLoggingOut: flag }),

  // Navigation state actions
  setNavigationState: (state: NavigationState) => {
    set({ navigationState: state });
  },
  setShowBiometricSetup: flag => {
    set({ showBiometricSetup: flag });
  },
  setPostLoginCredentials: credentials => {
    set({ postLoginCredentials: credentials });
  },

  setCachedUnits: units => set({ cachedUnits: units }),
  setLastUnitsFetchedAt: timestamp => set({ lastUnitsFetchedAt: timestamp }),

  setCachedCategories: categories => set({ cachedCategories: categories }),
  setLastCategoriesFetchedAt: timestamp =>
    set({ lastCategoriesFetchedAt: timestamp }),
  setCachedBrands: brands => set({ cachedBrands: brands }),
  setLastBrandsFetchedAt: timestamp => set({ lastBrandsFetchedAt: timestamp }),
  setCachedStores: stores => set({ cachedStores: stores }),
  setLastStoresFetchedAt: timestamp => set({ lastStoresFetchedAt: timestamp }),

  addCachedItemSuggestions: items =>
    set(state => {
      // Prepend the newly-seen items, dedupe by id keeping the first (most
      // recent) occurrence, and cap the list so persisted state stays small.
      state.cachedItemSuggestions = dedupeById(
        [...items, ...state.cachedItemSuggestions],
        MAX_CACHED_ITEM_SUGGESTIONS,
      );
    }),
});
