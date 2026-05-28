import { useBarcodeScannerOutput as useMLKitBarcodeOutput } from 'react-native-vision-camera-barcode-scanner';
import type {
  BarcodeFormat,
  TargetBarcodeFormat,
} from 'react-native-vision-camera-barcode-scanner';

export type NormalizedBarcodeFormat =
  | 'qr'
  | 'ean-13'
  | 'ean-8'
  | 'upc-a'
  | 'upc-e';

export interface ScannedBarcode {
  value: string;
  format: NormalizedBarcodeFormat;
}

export interface UseBarcodeOutputOptions {
  formats: NormalizedBarcodeFormat[];
  onBarcodeScanned: (barcode: ScannedBarcode) => void;
  onError?: (error: unknown) => void;
}

const noopOnError = () => {};

const toMLKitFormat = (format: NormalizedBarcodeFormat): TargetBarcodeFormat =>
  format === 'qr' ? 'qr-code' : format;

const fromMLKitFormat = (
  format: BarcodeFormat,
): NormalizedBarcodeFormat | null => {
  switch (format) {
    case 'qr-code':
      return 'qr';
    case 'ean-13':
    case 'ean-8':
    case 'upc-a':
    case 'upc-e':
      return format;
    default:
      return null;
  }
};

export function useBarcodeOutput(options: UseBarcodeOutputOptions) {
  return useMLKitBarcodeOutput({
    barcodeFormats: options.formats.map(toMLKitFormat),
    onBarcodeScanned: barcodes => {
      for (const barcode of barcodes) {
        if (!barcode.rawValue) continue;
        const format = fromMLKitFormat(barcode.format);
        if (!format) continue;
        options.onBarcodeScanned({ value: barcode.rawValue, format });
        return;
      }
    },
    onError: options.onError ?? noopOnError,
  });
}
