import { boolean, number, object, string, type ObjectSchema } from 'yup';
import {
  statesContents,
  type PackageContentsValues,
} from '#domain/stockAmount';
import {
  isWholeWhenSized,
  packageContentsFields,
} from '#features/pantry/ui/packageContentsRules';
import { parseDecimalInput } from '#utils/parseDecimalInput';
import {
  itemNameText,
  lazyMessage,
  parseMoneyInput,
  quantityRule,
} from '#utils/validation/common';
import { parseFractionalInput } from '#utils/fractionUtils';
import { formatQuantityForInput } from '#utils/formatQuantity';
import { formatNumberForInput } from '#utils/formatters/number';
import { isRecord } from '#utils/isRecord';
import type { UnitType } from '#graphql/generated/schemaTypes';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import {
  seedChoice,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';

/**
 * The line's amount, and what one package holds when it counts packages:
 * `unitType` is the kind of the unit `unitValue` names, null when none.
 */
export interface ReceiptLineFormValues extends PackageContentsValues {
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
  /** The earlier purchase picked for this line to be the receipt for. */
  existingPurchaseId: string | null;
  existingPurchaseVersion: number | null;
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
  quantityInput: quantityRule('errors.invalidQuantity').test(
    'whole-packages',
    lazyMessage('packageSize.wholePackages'),
    (value, context: { parent: ReceiptLineFormValues }) =>
      isWholeWhenSized(
        value,
        context.parent.unitType,
        context.parent.sizeInput,
      ),
  ),
  unitValue: string().defined(),
  unitId: string().nullable().defined(),
  unitType: packageContentsFields.sizeUnitType,
  ...packageContentsFields,
  // A typed size unit is resolved when the line is saved, as its amount's is.
  sizeUnitDisplay: string()
    .defined()
    .test(
      'size-unit-given',
      lazyMessage('packageSize.unitRequired'),
      (value, context: { parent: ReceiptLineFormValues }) =>
        !statesContents(context.parent) || !!value.trim(),
    ),
  sizeUnitId: string().nullable().defined(),
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
  existingPurchaseId: string().nullable().defined(),
  existingPurchaseVersion: number().nullable().defined(),
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
  unitTypeOf: (unitText: string) => UnitType | null,
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
    existingPurchase,
    packageSize,
  } = asked
    ? {
        ...saved,
        quantity: asked.quantity,
        unitId: asked.unitId,
        unitText: asked.unitText,
        packageSize: undefined,
      }
    : saved;
  return {
    itemName,
    itemId,
    quantityInput: formatQuantityForInput(quantity),
    unitValue: unitText,
    unitId,
    unitType: unitTypeOf(unitText),
    sizeInput: packageSize
      ? formatQuantityForInput(packageSize.quantity, { notation: 'decimal' })
      : '',
    sizeUnitDisplay: packageSize?.unitText ?? '',
    sizeUnitId: packageSize?.unitId ?? null,
    sizeUnitType: null,
    priceInput: formatNumberForInput(price),
    offList: offList ?? false,
    notStocked: notStocked ?? false,
    existingPurchaseId: existingPurchase?.id ?? null,
    existingPurchaseVersion: existingPurchase?.version ?? null,
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
  ...(statesContents(values)
    ? {
        packageSize: {
          quantity: parseDecimalInput(values.sizeInput),
          unitId: values.sizeUnitId,
          unitText: values.sizeUnitDisplay.trim(),
        },
      }
    : {}),
  price: parseMoneyInput(values.priceInput) ?? null,
  ...(values.offList ? { offList: true } : {}),
  ...(values.notStocked ? { notStocked: true } : {}),
  // The receipt for a purchase already stocked adds nothing to the pantry.
  ...(values.existingPurchaseId !== null &&
  values.existingPurchaseVersion !== null
    ? {
        notStocked: true,
        existingPurchase: {
          id: values.existingPurchaseId,
          version: values.existingPurchaseVersion,
        },
      }
    : {}),
});
