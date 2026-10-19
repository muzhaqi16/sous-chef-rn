/** A receipt as the review reads it, from the phone's labels or the server's parse. */
export type ParsedLineKind =
  | 'item'
  | 'discount'
  | 'tax'
  | 'subtotal'
  | 'total'
  | 'payment'
  | 'other';

export interface ParsedReceiptLine {
  index: number;
  rawText: string;
  kind: ParsedLineKind;
  product?: string;
  code?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  /** A discount's item, or the item a weight or count line describes. */
  appliesToIndex?: number;
}

/** What a reading's lines add up to, against the printed figure they miss. */
export interface ReceiptTotalsGap {
  counted: number;
  printed: number;
}

export interface ParsedReceipt {
  merchant?: string;
  lines: ParsedReceiptLine[];
}
