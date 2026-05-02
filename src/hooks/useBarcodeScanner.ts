import { useStore } from '../store';

export const useBarcodeScanner = () => {
  const scannedBarcode = useStore(s => s.scannedBarcode);
  const isScanning = useStore(s => s.isScanning);
  const setScannedBarcode = useStore(s => s.setScannedBarcode);
  const setScanning = useStore(s => s.setScanning);
  const resetScanner = useStore(s => s.resetScanner);

  return {
    scannedBarcode,
    isScanning,
    setScannedBarcode,
    setScanning,
    resetScanner,
  };
};
