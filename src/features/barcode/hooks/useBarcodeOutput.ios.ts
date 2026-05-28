import { useObjectOutput } from 'react-native-vision-camera';
import type {
  CameraObjectOutput,
  ScannedCode,
  ScannedObject,
  ScannedObjectType,
} from 'react-native-vision-camera';

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

/**
 * Module-level try-catch wrapper for the onObjectsScanned callback.
 * Keeps try-catch out of the hook body so the React Compiler doesn't bail out.
 * iOS's useObjectOutput has no onError option, so we catch here and forward.
 */
function processScannedObjects(
  objects: ScannedObject[],
  requested: Set<NormalizedBarcodeFormat>,
  onBarcodeScanned: (barcode: ScannedBarcode) => void,
  onError?: (error: unknown) => void,
): void {
  try {
    for (const obj of objects) {
      const code = obj as ScannedCode;
      if (!code.value) continue;
      const format = emitFormat(code.type, code.value, requested);
      if (!format) continue;
      onBarcodeScanned({ value: code.value, format });
      return;
    }
  } catch (error) {
    onError?.(error);
  }
}

// Map our normalized format names → vision-camera's ScannedObjectType.
// iOS AVCaptureMetadataOutput has no separate UPC-A type; UPC-A is reported
// as EAN-13 with a leading zero. We request 'ean-13' for both and translate
// back at callback time (see emitFormat below).
const toNativeTypes = (
  formats: NormalizedBarcodeFormat[],
): ScannedObjectType[] => {
  const types = new Set<ScannedObjectType>();
  for (const format of formats) {
    switch (format) {
      case 'qr':
        types.add('qr');
        break;
      case 'ean-13':
      case 'upc-a':
        types.add('ean-13');
        break;
      case 'ean-8':
        types.add('ean-8');
        break;
      case 'upc-e':
        types.add('upc-e');
        break;
    }
  }
  return Array.from(types);
};

const emitFormat = (
  scannedType: ScannedObjectType,
  rawValue: string,
  requested: Set<NormalizedBarcodeFormat>,
): NormalizedBarcodeFormat | null => {
  if (scannedType === 'qr' && requested.has('qr')) return 'qr';
  if (scannedType === 'ean-8' && requested.has('ean-8')) return 'ean-8';
  if (scannedType === 'upc-e' && requested.has('upc-e')) return 'upc-e';
  if (scannedType === 'ean-13') {
    // iOS encodes UPC-A as a 13-digit EAN-13 starting with '0'. Surface as
    // 'upc-a' when the caller requested it so the downstream UpcFormat
    // mapping in useSearchResults stays correct.
    if (
      requested.has('upc-a') &&
      rawValue.length === 13 &&
      rawValue.startsWith('0')
    ) {
      return 'upc-a';
    }
    if (requested.has('ean-13')) return 'ean-13';
  }
  return null;
};

export function useBarcodeOutput(
  options: UseBarcodeOutputOptions,
): CameraObjectOutput {
  const requested = new Set(options.formats);
  return useObjectOutput({
    types: toNativeTypes(options.formats),
    onObjectsScanned: objects => {
      processScannedObjects(
        objects,
        requested,
        options.onBarcodeScanned,
        options.onError,
      );
    },
  });
}
