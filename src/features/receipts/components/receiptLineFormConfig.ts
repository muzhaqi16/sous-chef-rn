import { boolean, object, string, type ObjectSchema } from 'yup';
import {
  itemNameText,
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
  itemName: itemNameText(lazyMessage('errors.itemNameRequired')),
  itemId: string().nullable().defined(),
  quantityInput: quantityRule('errors.invalidQuantity'),
  unitValue: string().defined(),
  unitId: string().nullable().defined(),
  // Empty is a total the receipt left unread, recorded as unknown; a stated
  // one is a real amount, and zero only where a discount made the line free.
  priceInput: string()
    .defined()
    .test(
      'paid',
      lazyMessage('receipts.review.totalNeeded'),
      (value, { options }) => {
        if (value.trim() === '') return true;
        const paid = parseMoneyInput(value);
        const free = isRecord(options.context) && options.context.free === true;
        return paid != null && (paid > 0 || free);
      },
    ),
  offList: boolean().defined(),
  notStocked: boolean().defined(),
});

/** An amount in a unit the form opens with in place of the printed count. */
export interface ReceiptLineAmountSeed {
  quantity: number;
  unitId: string;
  unitText: string;
}

/**
 * The form for a line: its saved choice, else what the receipt printed. A line
 * whose amount is asked opens on `asked`, its list line's amount, to confirm.
 */
export const receiptLineDefaults = (
  line: ReceiptReviewLine,
  choice: ReceiptLineChoice | undefined,
  asked?: ReceiptLineAmountSeed,
): ReceiptLineFormValues => {
  const saved = choice ?? seedChoice(line);
  const {
    itemName,
    itemId,
    quantity,
    unitText,
    unitId,
    price,
    offList,
    notStocked,
  } = asked
    ? {
        ...saved,
        quantity: asked.quantity,
        unitId: asked.unitId,
        unitText: asked.unitText,
      }
    : saved;
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
