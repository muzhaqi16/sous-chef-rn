/** How the platform's on-device model labels a receipt's lines. */

export type StructuringAvailability =
  | 'available'
  | 'downloading'
  | 'unavailable';

export type ReceiptLineLabel =
  | 'item'
  | 'itemDetail'
  | 'discount'
  | 'tax'
  | 'subtotal'
  | 'total'
  | 'payment'
  | 'header'
  | 'other';

export interface LabeledLine {
  /** Index into the lines passed in. */
  line: number;
  label: ReceiptLineLabel;
  /** An item line's product words as printed. */
  product?: string;
}

export interface ReceiptLineLabels {
  storeName?: string;
  lines: LabeledLine[];
}
