import { useBarcodeScannerStore } from '#features/barcode/store/barcodeScannerStore';

export const useBarcodeScanner = () => {
  const isScanning = useBarcodeScannerStore(s => s.isScanning);
  const setScanning = useBarcodeScannerStore(s => s.setScanning);
  const resetScanner = useBarcodeScannerStore(s => s.resetScanner);

  return {
    isScanning,
    setScanning,
    resetScanner,
  };
};
