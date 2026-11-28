import { mixed, object, string, type ObjectSchema } from 'yup';
import { UsagePurpose } from '#graphql/generated/schemaTypes';
import { heldToStock } from '#features/pantry/utils/judgeDeduction';
import { formatQuantityForInput } from '#utils/formatQuantity';
import type { PantryActionSharedState } from '#features/pantry/types';

export interface ConsumeFormValues {
  /**
   * Null until typed: the amount then reads the default unit's step, which can
   * land after the sheet opens.
   */
  quantityInput: string | null;
  purpose: UsagePurpose;
  notes: string;
}

export const consumeDefaults: ConsumeFormValues = {
  quantityInput: null,
  purpose: UsagePurpose.General,
  notes: '',
};

/** The amount before one is typed. */
export const untypedQuantity = ({
  defaultUnitIncrement,
}: PantryActionSharedState) =>
  defaultUnitIncrement ? formatQuantityForInput(defaultUnitIncrement) : '1';

// The amount is held to the stock in `useForm`'s `context`.
export const consumeSchema: ObjectSchema<ConsumeFormValues> = object({
  quantityInput: heldToStock('consume', untypedQuantity),
  purpose: mixed<UsagePurpose>().oneOf(Object.values(UsagePurpose)).defined(),
  notes: string().defined(),
});
