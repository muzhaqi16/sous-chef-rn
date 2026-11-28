import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { WasteReason } from '#graphql/generated/schemaTypes';
import { heldToStock } from '#features/pantry/utils/judgeDeduction';
import { DEFAULT_WASTE_REASON } from '#features/pantry/utils/wasteReasons';
import {
  formatQuantityForInput,
  resolveQuantityNotation,
} from '#utils/formatQuantity';
import type { PantryActionSharedState } from '#features/pantry/types';

export interface WasteFormValues {
  /** Null until typed: the amount then reads all the stack holds. */
  amountInput: string | null;
  wasteReason: WasteReason;
  isComposted: boolean;
  isRecycled: boolean;
  notes: string;
}

export const wasteDefaults: WasteFormValues = {
  amountInput: null,
  wasteReason: DEFAULT_WASTE_REASON,
  isComposted: false,
  isRecycled: false,
  notes: '',
};

/** The amount before one is typed: everything the stack holds. */
export const untypedAmount = (shared: PantryActionSharedState) =>
  formatQuantityForInput(shared.trackingQuantity, {
    notation: resolveQuantityNotation(
      shared.displayAsFractionOf(shared.trackingUnitId),
    ),
  });

// The amount is held to the stock in `useForm`'s `context`.
export const wasteSchema: ObjectSchema<WasteFormValues> = object({
  amountInput: heldToStock('waste', untypedAmount),
  wasteReason: mixed<WasteReason>().oneOf(Object.values(WasteReason)).defined(),
  isComposted: boolean().defined(),
  isRecycled: boolean().defined(),
  notes: string().defined(),
});
