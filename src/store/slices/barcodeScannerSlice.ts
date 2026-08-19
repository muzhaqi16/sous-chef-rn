import { StateCreator } from 'zustand';
import { RootState } from '../index';

// Types for your barcode scanner feature
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

  // UI state (namespaced to avoid collision with uiSlice)
  scannerSheetVisible: boolean;
  scannerSheetIndex: number;

  // Recently scanned items cache
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
 * The slice with nothing in it, including `recentlyScanned` — which
 * `resetScanner` deliberately keeps (it survives closing the scanner) but a
 * session end must not. Exported so `resetManager` clears the whole slice
 * rather than a hand-copied subset of it.
 */
export const initialBarcodeScannerState = {
  scannedBarcode: null,
  isScanning: false,
  searchResults: [],
  isSearching: false,
  searchError: null,
  scannerSheetVisible: false,
  scannerSheetIndex: 0,
  recentlyScanned: [],
};

export const createBarcodeScannerSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  BarcodeScannerState
> = set => ({
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
});
