import { boolean, object, string, type ObjectSchema } from 'yup';
import {
  lazyMessage,
  parseMoneyInput,
  quantityRule,
} from '#/utils/validation/common';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantityForInput } from '#/utils/formatQuantity';
import { formatNumberForInput } from '#/utils/formatters/number';
import { isRecord } from '#/utils/isRecord';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import {
  seedChoice,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';

export interface ReceiptLineFormValues {
  itemName: string;
  /** Set only while the name is a picked suggestion's. */
  itemId: string | null;
  quantityInput: string;
  unitValue: string;
  unitId: string | null;
  /** The total paid for the line; blank when unknown. */
  priceInput: string;
  /** Leave the shopping list line it matches open and add it on its own. */
  offList: boolean;
  /** Record what was paid without adding it to the pantry. */
  notStocked: boolean;
}

/** What the schema reads from the line beyond the form (`useForm`'s `context`). */
export interface ReceiptLineFormContext {
  /** The receipt's discounts cover the whole line, so it may be paid 0. */
  free: boolean;
}

const parsedQuantity = (value: string) => {
  const parsed = parseFractionalInput(value);
  return parsed !== null && !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
};

export const receiptLineSchema: ObjectSchema<ReceiptLineFormValues> = object({
  itemName: string().trim().required(lazyMessage('errors.itemNameRequired')),
  itemId: string().nullable().defined(),
  quantityInput: quantityRule('errors.invalidQuantity'),
  unitValue: string().defined(),
  unitId: string().nullable().defined(),
  priceInput: string()
    .defined()
    .test(
      'paid',
      lazyMessage('receipts.review.totalNeeded'),
      (value, { options }) => {
        const paid = parseMoneyInput(value);
        const free = isRecord(options.context) && options.context.free === true;
        return paid != null && (paid > 0 || free);
      },
    ),
  offList: boolean().defined(),
  notStocked: boolean().defined(),
});

/** The form for a line: its saved choice, else what the receipt printed. */
export const receiptLineDefaults = (
  line: ReceiptReviewLine,
  choice: ReceiptLineChoice | undefined,
): ReceiptLineFormValues => {
  const {
    itemName,
    itemId,
    quantity,
    unitText,
    unitId,
    price,
    offList,
    notStocked,
  } = choice ?? seedChoice(line);
  return {
    itemName,
    itemId,
    quantityInput: formatQuantityForInput(quantity),
    unitValue: unitText,
    unitId,
    priceInput: formatNumberForInput(price),
    offList: offList ?? false,
    notStocked: notStocked ?? false,
  };
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
  price: parseMoneyInput(values.priceInput) ?? null,
  ...(values.offList ? { offList: true } : {}),
  ...(values.notStocked ? { notStocked: true } : {}),
});
