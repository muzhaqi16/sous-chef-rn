import { object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatQuantityForInput } from '#/utils/formatQuantity';
import { formatNumberForInput } from '#/utils/formatters/number';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import type { ReceiptReviewLine } from '../utils/receiptReviewLines';

// Messages resolve LAZILY: the schema is built once at module scope.
const msg = (key: TranslationKey) => (): string => t(key);

export interface ReceiptLineFormValues {
  itemName: string;
  /** Set only while the name is a picked suggestion's. */
  itemId: string | null;
  quantityInput: string;
  unitValue: string;
  unitId: string | null;
  /** The total paid for the line; blank when unknown. */
  priceInput: string;
}

const parsedQuantity = (value: string) => {
  const parsed = parseFractionalInput(value);
  return parsed !== null && !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
};

const parsedPrice = (value: string) => {
  if (!value.trim()) return null;
  const parsed = parseDecimalInput(value);
  return Number.isNaN(parsed) || parsed < 0 ? undefined : parsed;
};

export const receiptLineSchema: ObjectSchema<ReceiptLineFormValues> = object({
  itemName: string().trim().required(msg('errors.itemNameRequired')),
  itemId: string().nullable().defined(),
  quantityInput: string()
    .defined()
    .test(
      'positive',
      msg('errors.invalidQuantity'),
      value => parsedQuantity(value) !== null,
    ),
  unitValue: string().defined(),
  unitId: string().nullable().defined(),
  priceInput: string()
    .defined()
    .test(
      'price',
      msg('receipts.review.invalidPrice'),
      value => parsedPrice(value) !== undefined,
    ),
});

/** The form for a line: its saved choice, else what the receipt printed. */
export const receiptLineDefaults = (
  line: ReceiptReviewLine,
  choice: ReceiptLineChoice | undefined,
): ReceiptLineFormValues =>
  choice
    ? {
        itemName: choice.itemName,
        itemId: choice.itemId,
        quantityInput: formatQuantityForInput(choice.quantity),
        unitValue: choice.unitText,
        unitId: choice.unitId,
        priceInput: formatNumberForInput(choice.price),
      }
    : {
        itemName: '',
        itemId: null,
        quantityInput: formatQuantityForInput(line.quantity ?? 1),
        unitValue: line.unit ?? '',
        unitId: null,
        priceInput: formatNumberForInput(line.price),
      };

/** A valid form as the choice the draft keeps. */
export const toLineChoice = (
  values: ReceiptLineFormValues,
): ReceiptLineChoice => ({
  itemId: values.itemId,
  itemName: values.itemName.trim(),
  quantity: parsedQuantity(values.quantityInput) ?? 1,
  unitId: values.unitId,
  unitText: values.unitValue.trim(),
  price: parsedPrice(values.priceInput) ?? null,
});
