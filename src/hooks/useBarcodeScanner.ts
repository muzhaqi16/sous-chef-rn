import {useStore} from '../store';
import {useMemo} from 'react';

export const useBarcodeScanner = () => {
  const scannedBarcode = useStore(s => s.scannedBarcode);
  const isScanning = useStore(s => s.isScanning);
  const setScannedBarcode = useStore(s => s.setScannedBarcode);
  const setScanning = useStore(s => s.setScanning);
  const resetScanner = useStore(s => s.resetScanner);
  const searchResults = useStore(s => s.searchResults);
  const setSearching = useStore(s => s.setSearching);
  const setSearchResults = useStore(s => s.setSearchResults);
  const addToRecentlyScanned = useStore(s => s.addToRecentlyScanned);
  const clearSearch = useStore(s => s.clearSearch);
  const hideBottomSheet = useStore(s => s.hideBottomSheet);

  return useMemo(
    () => ({
      scannedBarcode,
      isScanning,
      searchResults,
      setSearching,
      setSearchResults,
      setScannedBarcode,
      setScanning,
      hideBottomSheet,
      resetScanner,
      addToRecentlyScanned,
      clearSearch,
    }),
    [
      scannedBarcode,
      isScanning,
      setScannedBarcode,
      setScanning,
      resetScanner,
      searchResults,
      setSearching,
      hideBottomSheet,
      setSearchResults,
      clearSearch,
      addToRecentlyScanned,
    ],
  );
};
