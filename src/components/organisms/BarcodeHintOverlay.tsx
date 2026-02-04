import React from 'react';
import { FeatureHintOverlay } from './FeatureHintOverlay';

interface BarcodeHintOverlayProps {
  onDismiss: () => void;
}

/**
 * Barcode scanner hint overlay
 * Shows users how to use the barcode scanner for quick entry
 *
 * @example
 * const barcodeHint = useFeatureHint({
 *   featureId: 'barcode_scanner',
 *   showOnMount: true,
 *   delay: 500,
 * });
 *
 * {barcodeHint.isVisible && (
 *   <BarcodeHintOverlay onDismiss={barcodeHint.dismiss} />
 * )}
 */
export const BarcodeHintOverlay: React.FC<BarcodeHintOverlayProps> = ({
  onDismiss,
}) => {
  return (
    <FeatureHintOverlay
      config={{
        title: 'Scan barcodes',
        subtitle: 'Point your camera at a product barcode for quick entry',
        icon: {
          name: 'barcode-scan',
          library: 'MaterialDesignIcons',
          size: 40,
        },
        onDismiss,
      }}
    />
  );
};
