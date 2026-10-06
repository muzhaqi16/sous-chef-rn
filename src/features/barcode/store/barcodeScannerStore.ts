import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import type { NetWeightKind } from '#/graphql/generated/schemaTypes';
import type { PhotoCreditValue } from '#features/catalog/ui/PhotoCredit';
import type { DataAttributionValue } from '#components/molecules/DataAttributionNotices';

/** One row of the scanner's result list. */
export interface ScannedItem {
  id: string;
  name: string;
  description?: string;
  /** The primary photo's thumbnail, which an edit form starts from. */
  imageUrl?: string;
  /**
   * The card's full-width image: the primary photo's original, else
   * `imageUrl`, with the licence credit it needs.
   */
  image?: { url: string; credit?: PhotoCreditValue };
  /** The notices the item's catalog data asks a reader to see. */
  dataAttributions?: DataAttributionValue[];
  /** Labels the edit action ("Suggest Edit" vs "Edit"). Cosmetic only — the
   *  submit path re-reads canEdit from the authoritative item snapshot. */
  canEdit?: boolean;
  /** Whether the item can take an edit suggestion. With canEdit, decides
   *  whether the edit action is offered: both explicitly false means read-only.
   *  Undefined on a cached scan, which is why the sheet re-checks the
   *  authoritative snapshot rather than trusting this. */
  canSuggest?: boolean;
  /** The code that was scanned, which is what the card shows. */
  upc: string;
  /**
   * The scanned barcode's product record. An add naming it stores the pack the
   * scan reported: its size, brand and barcode.
   */
  variationId?: string;
  /** Where that record's facts came from, e.g. `OPENFOODFACTS`. */
  source?: string;
  unitId?: string;
  /** The scanned barcode's own figure, in `displayUnit`. */
  netWeight?: number;
  /** What `netWeight` measures; only a PACKAGE figure is a package size. */
  netWeightKind?: NetWeightKind;
  displayUnit?: {
    id: string;
    name: string;
    symbol: string;
  };
  /** The unit an add naming no unit counts the row in. */
  trackingUnit?: {
    id: string;
    name: string;
    symbol: string;
  };
  /** The scanned barcode's own brand; never one picked from the item's list. */
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
  isScanning: boolean;

  // Search state
  searchResults: ScannedItem[];
  isSearching: boolean;
  searchError: string | null;

  // UI state
  scannerSheetVisible: boolean;
  scannerSheetIndex: number;

  // Actions
  setScanning: (isScanning: boolean) => void;
  setSearchResults: (results: ScannedItem[]) => void;
  setSearching: (isSearching: boolean) => void;
  setSearchError: (error: string | null) => void;
  showBottomSheet: (index?: number) => void;
  hideBottomSheet: () => void;
  clearSearch: () => void;
  resetScanner: () => void;
}

/**
 * Everything empty. Exported so the session reset clears the whole store rather
 * than a hand-copied subset.
 */
export const initialBarcodeScannerState = {
  isScanning: false,
  searchResults: [] as ScannedItem[],
  isSearching: false,
  searchError: null as string | null,
  scannerSheetVisible: false,
  scannerSheetIndex: 0,
};

export const useBarcodeScannerStore = create<BarcodeScannerState>()(
  immer(set => ({
    ...initialBarcodeScannerState,

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

    clearSearch: () =>
      set(state => {
        state.searchResults = [];
        state.searchError = null;
        state.isSearching = false;
      }),

    resetScanner: () => set(() => ({ ...initialBarcodeScannerState })),
  })),
);

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
