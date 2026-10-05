import { isRecord } from '#/utils/isRecord';
import { nativeMethod, parseList } from './nativeModule';

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

// A record so a label added to the union must be added here too.
const LABELS: Record<ReceiptLineLabel, true> = {
  item: true,
  itemDetail: true,
  discount: true,
  tax: true,
  subtotal: true,
  total: true,
  payment: true,
  header: true,
  other: true,
};

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

const MODULE = 'ReceiptStructuringModule';

const isLabel = (value: unknown): value is ReceiptLineLabel =>
  typeof value === 'string' && Object.hasOwn(LABELS, value);

const toLabeledLine = (value: unknown): LabeledLine | null => {
  if (!isRecord(value)) return null;
  const { line, kind, product } = value;
  if (typeof line !== 'number' || !Number.isInteger(line) || !isLabel(kind)) {
    return null;
  }
  return typeof product === 'string' && product.trim() !== ''
    ? { line, label: kind, product: product.trim() }
    : { line, label: kind };
};

/**
 * The platform's on-device model, which labels receipt lines: Foundation
 * Models on iOS 26+, Gemini Nano on AICore Android devices.
 */
export const ReceiptStructuring = {
  /** A build without the module reads as unavailable. */
  async availability(): Promise<StructuringAvailability> {
    const availability = nativeMethod(MODULE, 'availability');
    if (!availability) return 'unavailable';
    const status = await availability();
    return status === 'available' || status === 'downloading'
      ? status
      : 'unavailable';
  },

  /** One label per line the model could place; a line it skipped has none. */
  async labelLines(lines: readonly string[]): Promise<ReceiptLineLabels> {
    const labelLines = nativeMethod(MODULE, 'labelLines');
    if (!labelLines) throw new Error(`${MODULE} is not linked`);
    const result = await labelLines([...lines]);
    if (!isRecord(result)) return { lines: [] };
    const { lines: labeled, storeName } = result;
    const parsed = parseList(labeled, toLabeledLine);
    return typeof storeName === 'string' && storeName.trim() !== ''
      ? { storeName: storeName.trim(), lines: parsed }
      : { lines: parsed };
  },
};
