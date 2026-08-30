import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/** One row of the scanner's result list and its recent-scan history. */
export interface ScannedItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  /** Labels the edit action ("Suggest Edit" vs "Edit"). Cosmetic only — the
   *  submit path re-reads canEdit from the authoritative item snapshot. */
  canEdit?: boolean;
  /** Whether the item can take an edit suggestion. With canEdit, decides
   *  whether the edit action is offered: both explicitly false means read-only.
   *  Undefined on a cached scan, which is why the sheet re-checks the
   *  authoritative snapshot rather than trusting this. */
  canSuggest?: boolean;
  upc: string;
  unitId?: string;
  netWeight?: number;
  displayUnit?: {
    id: string;
    name: string;
    symbol: string;
  };
  brandName?: string;
  brandId?: string;
  type?: string;
  storageState?: string;
  shelfLifeDays?: number;
  shelfLifeOpenedDays?: number;
  tags?: string[];
  categories?: Array<{ id: string; name: string; isPrimary?: boolean }>;
}

export interface BarcodeScannerState {
  // Current scan state
  scannedBarcode: string | null;
  isScanning: boolean;

  // Search state
  searchResults: ScannedItem[];
  isSearching: boolean;
  searchError: string | null;

  // UI state
  scannerSheetVisible: boolean;
  scannerSheetIndex: number;

  /** The last 10 scans, kept across app launches. The only persisted field. */
  recentlyScanned: ScannedItem[];

  // Actions
  setScannedBarcode: (barcode: string) => void;
  setScanning: (isScanning: boolean) => void;
  setSearchResults: (results: ScannedItem[]) => void;
  setSearching: (isSearching: boolean) => void;
  setSearchError: (error: string | null) => void;
  showBottomSheet: (index?: number) => void;
  hideBottomSheet: () => void;
  addToRecentlyScanned: (item: ScannedItem) => void;
  clearSearch: () => void;
  resetScanner: () => void;
}

/**
 * Everything empty, `recentlyScanned` included — `resetScanner` deliberately
 * keeps the history, a session end must not. Exported so the session reset
 * clears the whole store rather than a hand-copied subset.
 */
export const initialBarcodeScannerState = {
  scannedBarcode: null,
  isScanning: false,
  searchResults: [] as ScannedItem[],
  isSearching: false,
  searchError: null as string | null,
  scannerSheetVisible: false,
  scannerSheetIndex: 0,
  recentlyScanned: [] as ScannedItem[],
};

const PERSIST_KEY = 'sous-chef-barcode';

export const useBarcodeScannerStore = create<BarcodeScannerState>()(
  persist(
    immer(set => ({
      ...initialBarcodeScannerState,

      setScannedBarcode: barcode =>
        set(state => {
          state.scannedBarcode = barcode;
          state.searchError = null; // Clear any previous errors
        }),

      setScanning: isScanning =>
        set(state => {
          state.isScanning = isScanning;
        }),

      setSearchResults: results =>
        set(state => {
          state.searchResults = results;
          state.isSearching = false;
          state.searchError = null;
        }),

      setSearching: isSearching =>
        set(state => {
          state.isSearching = isSearching;
          if (isSearching) {
            state.searchError = null;
          }
        }),

      setSearchError: error =>
        set(state => {
          state.searchError = error;
          state.isSearching = false;
        }),

      showBottomSheet: (index = 1) =>
        set(state => {
          state.scannerSheetVisible = true;
          state.scannerSheetIndex = index;
        }),

      hideBottomSheet: () =>
        set(state => {
          state.scannerSheetVisible = false;
          state.scannerSheetIndex = 0;
        }),

      addToRecentlyScanned: item =>
        set(state => {
          // Remove if already exists to avoid duplicates
          const existingIndex = state.recentlyScanned.findIndex(
            existing => existing.upc === item.upc,
          );
          if (existingIndex !== -1) {
            state.recentlyScanned.splice(existingIndex, 1);
          }

          // Add to beginning of array
          state.recentlyScanned.unshift(item);

          // Keep only last 10 items
          if (state.recentlyScanned.length > 10) {
            state.recentlyScanned = state.recentlyScanned.slice(0, 10);
          }
        }),

      clearSearch: () =>
        set(state => {
          state.searchResults = [];
          state.searchError = null;
          state.isSearching = false;
        }),

      // Deliberately does NOT clear `recentlyScanned`: closing the scanner
      // keeps the history, only a session end empties it.
      resetScanner: () =>
        set(state => {
          state.scannedBarcode = null;
          state.isScanning = false;
          state.searchResults = [];
          state.isSearching = false;
          state.searchError = null;
          state.scannerSheetVisible = false;
          state.scannerSheetIndex = 0;
        }),
    })),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
      // Only the history persists. The scan/search/sheet fields are all
      // in-flight state; restoring `isScanning: true` would open the app onto a
      // camera that is not running.
      partialize: state => ({ recentlyScanned: state.recentlyScanned }),
    },
  ),
);

// The history is persisted, so a sign-out on a shared device must clear it —
// and this store is outside the root's `SESSION_SCOPED_STATE` by construction.
registerSessionScopedStore('barcodeScanner', () =>
  useBarcodeScannerStore.setState(() => ({ ...initialBarcodeScannerState })),
);

/*
 * Grouped selectors. `useShallow` because each returns a fresh object —
 * without it every store write re-renders every consumer, which on the scanner
 * is every frame the camera produces a candidate.
 */

/** Search results and the actions that write them. */
export const useSearchState = () =>
  useBarcodeScannerStore(
    useShallow(state => ({
      searchResults: state.searchResults,
      isSearching: state.isSearching,
      searchError: state.searchError,
      setSearchResults: state.setSearchResults,
      setSearching: state.setSearching,
      setSearchError: state.setSearchError,
      clearSearch: state.clearSearch,
      addToRecentlyScanned: state.addToRecentlyScanned,
    })),
  );

/** The scanner result sheet's visibility and position. */
export const useBottomSheetState = () =>
  useBarcodeScannerStore(
    useShallow(state => ({
      scannerSheetVisible: state.scannerSheetVisible,
      searchError: state.searchError,
      scannerSheetIndex: state.scannerSheetIndex,
      isSearching: state.isSearching,
      hideBottomSheet: state.hideBottomSheet,
      showBottomSheet: state.showBottomSheet,
    })),
  );
