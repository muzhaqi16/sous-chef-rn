import type { UnitLabelSource } from '#utils/formatQuantity';

/** A receipt as the review reads it, from the phone's labels or the server's parse. */
export type ParsedLineKind =
  | 'item'
  | 'discount'
  | 'tax'
  | 'subtotal'
  | 'total'
  | 'payment'
  | 'other';

/** Packages a line bought, each holding `size`: "WHOLE MILK 64 FL OZ" is 1 of 64 fl oz. */
export interface ParsedPackages {
  count: number;
  size: {
    quantity: number;
    unit: string;
    /** The known unit `unit` names, where the API names one. */
    measureUnit?: UnitLabelSource;
  };
}

export interface ParsedReceiptLine {
  index: number;
  rawText: string;
  kind: ParsedLineKind;
  product?: string;
  /** The food an item bought in plain words, as the server's reading names it. */
  name?: string;
  code?: string;
  quantity?: number;
  unit?: string;
  /** The known unit the printed one names, where the API names one. */
  measureUnit?: UnitLabelSource;
  unitPrice?: number;
  lineTotal?: number;
  /** A discount's item, or the item a weight or count line describes. */
  appliesToIndex?: number;
  /** An item's packages, when its product prints a size and it was not weighed. */
  packages?: ParsedPackages;
}

/** What a reading's lines add up to, against the printed figure they miss. */
export interface ReceiptTotalsGap {
  counted: number;
  printed: number;
}

export interface ParsedReceipt {
  merchant?: string;
  /** The ISO 4217 code the receipt prints, where its reading decided one. */
  currency?: string;
  lines: ParsedReceiptLine[];
}
