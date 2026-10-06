import { renderHook } from '@testing-library/react-native';
import {
  useBarcodeScannerStore,
  useBottomSheetState,
  initialBarcodeScannerState,
} from '../barcodeScannerStore';

// A feature store, so neither root-store scaffolding nor auth-slice mocks are
// needed. A full reset is what starts each test clean.
const createTestStore = () => {
  useBarcodeScannerStore.setState(() => ({ ...initialBarcodeScannerState }));
  return useBarcodeScannerStore;
};

describe('barcodeScannerStore', () => {
  it('starts idle, with the sheet closed', () => {
    const state = createTestStore().getState();
    expect(state.isScanning).toBe(false);
    expect(state.scannerSheetVisible).toBe(false);
  });

  it('sets scanning state', () => {
    const store = createTestStore();
    store.getState().setScanning(true);
    expect(store.getState().isScanning).toBe(true);
  });

  it('shows and hides the result sheet', () => {
    const store = createTestStore();
    store.getState().showBottomSheet();
    expect(store.getState().scannerSheetVisible).toBe(true);
    store.getState().hideBottomSheet();
    expect(store.getState().scannerSheetVisible).toBe(false);
  });

  it('resets all scanner state', () => {
    const store = createTestStore();
    store.getState().setScanning(true);
    store.getState().showBottomSheet();
    store.getState().resetScanner();
    expect(store.getState()).toMatchObject(initialBarcodeScannerState);
  });
});

describe('useBottomSheetState', () => {
  it('exposes the sheet and the actions that move it', () => {
    const store = createTestStore();
    const { result } = renderHook(() => useBottomSheetState());

    expect(result.current.scannerSheetVisible).toBe(false);
    expect(result.current.showBottomSheet).toBe(
      store.getState().showBottomSheet,
    );
    expect(result.current.hideBottomSheet).toBe(
      store.getState().hideBottomSheet,
    );
  });
});
