import { date, object, string, type ObjectSchema } from 'yup';
import { UnitType } from '#graphql/generated/schemaTypes';
import type { PackageContentsValues } from '#domain/stockAmount';
import {
  isPickedWhenSized,
  isWholeWhenSized,
  packageContentsFields,
} from '#features/pantry/ui/packageContentsRules';
import {
  lazyMessage,
  optionalMoneyRule,
  quantityRule,
} from '#utils/validation/common';

export interface RestockFormValues
  extends Omit<PackageContentsValues, 'unitType'> {
  quantityInput: string;
  costPerUnitInput: string;
  totalCostInput: string;
  expiresAt: Date | null;
  notes: string;
}

/** What the schema reads beyond the form (`useForm`'s `context`). */
export interface RestockFormContext {
  /** The restock counts the stack's own packages, so it may state their size. */
  countsPackages: boolean;
}

export const restockDefaults: RestockFormValues = {
  quantityInput: '1',
  costPerUnitInput: '',
  totalCostInput: '',
  expiresAt: null,
  notes: '',
  sizeInput: '',
  sizeUnitDisplay: '',
  sizeUnitId: null,
  sizeUnitType: null,
};

// A size is read only while the stack's own packages are counted: another
// unit hides its fields, and what they hold is neither checked nor sent.
export const restockSchema: ObjectSchema<RestockFormValues> = object({
  quantityInput: quantityRule('errors.invalidQuantity').when(
    '$countsPackages',
    ([countsPackages], schema) =>
      countsPackages === true
        ? schema.test(
            'whole-packages',
            lazyMessage('packageSize.wholePackages'),
            (value, context: { parent: RestockFormValues }) =>
              isWholeWhenSized(value, UnitType.Count, context.parent.sizeInput),
          )
        : schema,
  ),
  // Hidden with budget & prices off, so left blank: they never block.
  costPerUnitInput: optionalMoneyRule('errors.invalidAmountPaid'),
  totalCostInput: optionalMoneyRule('errors.invalidAmountPaid'),
  expiresAt: date().nullable().defined(),
  notes: string().defined(),
  ...packageContentsFields,
  sizeInput: string()
    .defined()
    .when('$countsPackages', ([countsPackages], schema) =>
      countsPackages === true ? packageContentsFields.sizeInput : schema,
    ),
  sizeUnitId: string()
    .nullable()
    .defined()
    .when('$countsPackages', ([countsPackages], schema) =>
      countsPackages === true
        ? schema.test(
            'size-unit-picked',
            lazyMessage('packageSize.unitRequired'),
            (value, context: { parent: RestockFormValues }) =>
              isPickedWhenSized(
                value,
                UnitType.Count,
                context.parent.sizeInput,
              ),
          )
        : schema,
    ),
});
