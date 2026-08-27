import { useBarcodeScannerStore } from '#features/barcode/store/barcodeScannerStore';

export const useBarcodeScanner = () => {
  const scannedBarcode = useBarcodeScannerStore(s => s.scannedBarcode);
  const isScanning = useBarcodeScannerStore(s => s.isScanning);
  const setScannedBarcode = useBarcodeScannerStore(s => s.setScannedBarcode);
  const setScanning = useBarcodeScannerStore(s => s.setScanning);
  const resetScanner = useBarcodeScannerStore(s => s.resetScanner);

  return {
    scannedBarcode,
    isScanning,
    setScannedBarcode,
    setScanning,
    resetScanner,
  };
};
