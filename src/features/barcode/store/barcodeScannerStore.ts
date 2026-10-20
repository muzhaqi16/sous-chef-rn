import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

export interface BarcodeScannerState {
  isScanning: boolean;
  /** The result screen's item sheet; its position comes from its snap points. */
  scannerSheetVisible: boolean;

  setScanning: (isScanning: boolean) => void;
  showBottomSheet: () => void;
  hideBottomSheet: () => void;
  resetScanner: () => void;
}

/**
 * Everything empty. Exported so the session reset clears the whole store rather
 * than a hand-copied subset.
 */
export const initialBarcodeScannerState = {
  isScanning: false,
  scannerSheetVisible: false,
};

export const useBarcodeScannerStore = create<BarcodeScannerState>()(
  immer(set => ({
    ...initialBarcodeScannerState,

    setScanning: isScanning =>
      set(state => {
        state.isScanning = isScanning;
      }),

    showBottomSheet: () =>
      set(state => {
        state.scannerSheetVisible = true;
      }),

    hideBottomSheet: () =>
      set(state => {
        state.scannerSheetVisible = false;
      }),

    resetScanner: () => set(() => ({ ...initialBarcodeScannerState })),
  })),
);

registerSessionScopedStore('barcodeScanner', () =>
  useBarcodeScannerStore.setState(() => ({ ...initialBarcodeScannerState })),
);

/*
 * Grouped selector. `useShallow` because it returns a fresh object — without it
 * every store write re-renders every consumer, which on the scanner is every
 * frame the camera produces a candidate.
 */

/** The scanner result sheet's visibility and the actions that move it. */
export const useBottomSheetState = () =>
  useBarcodeScannerStore(
    useShallow(state => ({
      scannerSheetVisible: state.scannerSheetVisible,
      hideBottomSheet: state.hideBottomSheet,
      showBottomSheet: state.showBottomSheet,
    })),
  );
