import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';

// Lazy, so the scanner and text recognition load only when a scan starts.
const ReceiptScanScreen = React.lazy(() =>
  import('./ReceiptScanScreen').then(m => ({ default: m.ReceiptScanScreen })),
);
const ReceiptReviewScreen = React.lazy(() =>
  import('./ReceiptReviewScreen').then(m => ({
    default: m.ReceiptReviewScreen,
  })),
);

/**
 * The receipts feature's screens, spread into `ReceiptsStack`, which keeps the
 * presentation. Must stay a literal: see `barcodeScreens`.
 */
export const receiptScreens = {
  ReceiptScan: createNativeStackScreen({
    screen: ReceiptScanScreen,
    linking: null,
  }),
  ReceiptReview: createNativeStackScreen({
    screen: ReceiptReviewScreen,
    linking: null,
    // A step of the scan, pushed rather than stacked as a second sheet.
    options: { presentation: 'card' },
  }),
};
