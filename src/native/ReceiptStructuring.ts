import { NativeModules } from 'react-native';

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

interface ReceiptStructuringNativeModule {
  availability: () => Promise<unknown>;
  labelLines: (lines: string[]) => Promise<unknown>;
}

const isStructuringModule = (
  value: unknown,
): value is ReceiptStructuringNativeModule =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'availability') === 'function' &&
  typeof Reflect.get(value, 'labelLines') === 'function';

// Resolved per call, like `StartupMark`, so a module registered after this
// file loads is still found. Android has none yet: it reads as unavailable.
const nativeModule = (): ReceiptStructuringNativeModule | null => {
  const candidate: unknown = NativeModules.ReceiptStructuringModule;
  return isStructuringModule(candidate) ? candidate : null;
};

const isLabel = (value: unknown): value is ReceiptLineLabel =>
  typeof value === 'string' && Object.hasOwn(LABELS, value);

const toLabeledLine = (value: unknown): LabeledLine | null => {
  if (typeof value !== 'object' || value === null) return null;
  const line: unknown = Reflect.get(value, 'line');
  const kind: unknown = Reflect.get(value, 'kind');
  const product: unknown = Reflect.get(value, 'product');
  if (typeof line !== 'number' || !Number.isInteger(line) || !isLabel(kind)) {
    return null;
  }
  return typeof product === 'string' && product.trim() !== ''
    ? { line, label: kind, product: product.trim() }
    : { line, label: kind };
};

/** The platform's on-device model, which labels receipt lines; iOS 26+ only. */
export const ReceiptStructuring = {
  async availability(): Promise<StructuringAvailability> {
    const module = nativeModule();
    if (!module) return 'unavailable';
    const status: unknown = await module.availability();
    return status === 'available' || status === 'downloading'
      ? status
      : 'unavailable';
  },

  /** One label per line the model could place; a line it skipped has none. */
  async labelLines(lines: readonly string[]): Promise<ReceiptLineLabels> {
    const module = nativeModule();
    if (!module) throw new Error('ReceiptStructuringModule is not linked');
    const result: unknown = await module.labelLines([...lines]);
    if (typeof result !== 'object' || result === null) return { lines: [] };
    const labeled: unknown = Reflect.get(result, 'lines');
    const storeName: unknown = Reflect.get(result, 'storeName');
    const parsed = Array.isArray(labeled)
      ? labeled.flatMap(line => toLabeledLine(line) ?? [])
      : [];
    return typeof storeName === 'string' && storeName.trim() !== ''
      ? { storeName: storeName.trim(), lines: parsed }
      : { lines: parsed };
  },
};
