import { createTestStore } from '#/test-utils/createTestStore';
import type { ScannedItem } from '../barcodeScannerSlice';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockItem: ScannedItem = {
  id: 'item-1',
  name: 'Test Item',
  upc: '123456789',
};

describe('barcodeScannerSlice', () => {
  describe('initial state', () => {
    it('starts with null barcode and empty results', () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state.scannedBarcode).toBeNull();
      expect(state.isScanning).toBe(false);
      expect(state.searchResults).toEqual([]);
      expect(state.isSearching).toBe(false);
      expect(state.searchError).toBeNull();
      expect(state.scannerSheetVisible).toBe(false);
      expect(state.recentlyScanned).toEqual([]);
    });
  });

  describe('setScannedBarcode', () => {
    it('sets barcode and clears errors', () => {
      const store = createTestStore();
      store.getState().setSearchError('old error');
      store.getState().setScannedBarcode('1234');
      expect(store.getState().scannedBarcode).toBe('1234');
      expect(store.getState().searchError).toBeNull();
    });
  });

  describe('setScanning', () => {
    it('sets scanning state', () => {
      const store = createTestStore();
      store.getState().setScanning(true);
      expect(store.getState().isScanning).toBe(true);
    });
  });

  describe('setSearchResults', () => {
    it('sets results and clears searching/errors', () => {
      const store = createTestStore();
      store.getState().setSearching(true);
      store.getState().setSearchResults([mockItem]);
      expect(store.getState().searchResults).toEqual([mockItem]);
      expect(store.getState().isSearching).toBe(false);
      expect(store.getState().searchError).toBeNull();
    });
  });

  describe('setSearching', () => {
    it('clears error when starting search', () => {
      const store = createTestStore();
      store.getState().setSearchError('old');
      store.getState().setSearching(true);
      expect(store.getState().searchError).toBeNull();
    });
  });

  describe('setSearchError', () => {
    it('sets error and clears searching', () => {
      const store = createTestStore();
      store.getState().setSearching(true);
      store.getState().setSearchError('failed');
      expect(store.getState().searchError).toBe('failed');
      expect(store.getState().isSearching).toBe(false);
    });
  });

  describe('bottom sheet', () => {
    it('shows bottom sheet at index', () => {
      const store = createTestStore();
      store.getState().showBottomSheet(2);
      expect(store.getState().scannerSheetVisible).toBe(true);
      expect(store.getState().scannerSheetIndex).toBe(2);
    });

    it('defaults to index 1', () => {
      const store = createTestStore();
      store.getState().showBottomSheet();
      expect(store.getState().scannerSheetIndex).toBe(1);
    });

    it('hides bottom sheet', () => {
      const store = createTestStore();
      store.getState().showBottomSheet();
      store.getState().hideBottomSheet();
      expect(store.getState().scannerSheetVisible).toBe(false);
      expect(store.getState().scannerSheetIndex).toBe(0);
    });
  });

  describe('addToRecentlyScanned', () => {
    it('adds item to beginning', () => {
      const store = createTestStore();
      store.getState().addToRecentlyScanned(mockItem);
      expect(store.getState().recentlyScanned[0]).toEqual(mockItem);
    });

    it('deduplicates by UPC', () => {
      const store = createTestStore();
      store.getState().addToRecentlyScanned(mockItem);
      store.getState().addToRecentlyScanned({ ...mockItem, name: 'Updated' });
      expect(store.getState().recentlyScanned).toHaveLength(1);
      expect(store.getState().recentlyScanned[0].name).toBe('Updated');
    });

    it('keeps only 10 items', () => {
      const store = createTestStore();
      for (let i = 0; i < 12; i++) {
        store.getState().addToRecentlyScanned({
          ...mockItem,
          id: `item-${i}`,
          upc: `upc-${i}`,
        });
      }
      expect(store.getState().recentlyScanned).toHaveLength(10);
    });
  });

  describe('clearSearch', () => {
    it('clears search state', () => {
      const store = createTestStore();
      store.getState().setSearchResults([mockItem]);
      store.getState().setSearchError('err');
      store.getState().clearSearch();
      expect(store.getState().searchResults).toEqual([]);
      expect(store.getState().searchError).toBeNull();
      expect(store.getState().isSearching).toBe(false);
    });
  });

  describe('resetScanner', () => {
    it('resets all scanner state', () => {
      const store = createTestStore();
      store.getState().setScannedBarcode('123');
      store.getState().setScanning(true);
      store.getState().setSearchResults([mockItem]);
      store.getState().showBottomSheet();
      store.getState().resetScanner();
      const state = store.getState();
      expect(state.scannedBarcode).toBeNull();
      expect(state.isScanning).toBe(false);
      expect(state.searchResults).toEqual([]);
      expect(state.scannerSheetVisible).toBe(false);
    });
  });
});
