import {useStore} from '../store';
import {useMemo} from 'react';

export const useBarcodeScanner = () => {
  const scannedBarcode = useStore(s => s.scannedBarcode);
  const isScanning = useStore(s => s.isScanning);
  const setScannedBarcode = useStore(s => s.setScannedBarcode);
  const setScanning = useStore(s => s.setScanning);
  const resetScanner = useStore(s => s.resetScanner);

  return useMemo(
    () => ({
      scannedBarcode,
      isScanning,
      setScannedBarcode,
      setScanning,
      resetScanner,
    }),
    [scannedBarcode, isScanning, setScannedBarcode, setScanning, resetScanner],
  );
};
