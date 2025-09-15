import {StateCreator} from 'zustand';
import {RootState} from '../index';

// Types for your barcode scanner feature
export interface ScannedItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  upc: string;
  unitId?: string;
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
  bottomSheetVisible: boolean;
  bottomSheetIndex: number;

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

const initialBarcodeScannerState = {
  scannedBarcode: null,
  isScanning: false,
  searchResults: [],
  isSearching: false,
  searchError: null,
  bottomSheetVisible: false,
  bottomSheetIndex: 0,
  recentlyScanned: [],
};

export const createBarcodeScannerSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  BarcodeScannerState
> = (set, get) => ({
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
      state.bottomSheetVisible = true;
      state.bottomSheetIndex = index;
    }),

  hideBottomSheet: () =>
    set(state => {
      state.bottomSheetVisible = false;
      state.bottomSheetIndex = 0;
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
      state.bottomSheetVisible = false;
      state.bottomSheetIndex = 0;
    }),
});
