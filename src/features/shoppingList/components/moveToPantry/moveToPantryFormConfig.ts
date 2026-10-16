import { boolean, date, mixed, object, string, type ObjectSchema } from 'yup';
import {
  lazyMessage,
  optionalMoneyRule,
  positiveDecimalRule,
  quantityRule,
} from '#/utils/validation/common';
import { StorageState, UnitType } from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface MoveToPantryFormValues {
  pantryId: string | null;
  quantityInput: string;
  unitValue: string;
  unitId: string | null;
  /** The chosen unit's kind; null for a typed one the catalog has not named. */
  unitType: UnitType | null;
  storageState: StorageState;
  expirationDate?: Date;
  removeFromList: boolean;
  actualPriceInput: string;
  notes: string;
  /** This package's own size, when it differs from the usual. Optional. */
  packageSizeInput: string;
  packageSizeUnitValue: string;
  packageSizeUnitId: string | null;
  /** The size unit's kind; null for a typed one the catalog has not named. */
  packageSizeUnitType: UnitType | null;
}

type PackageAmounts = Pick<
  MoveToPantryFormValues,
  'quantityInput' | 'unitType' | 'packageSizeInput' | 'packageSizeUnitType'
>;

/**
 * Whether the amount and the size are stated the other way round: an amount
 * bought (64 fl oz) and a whole count of packages in a counted unit (1 box) in
 * the size's place. It is the same purchase as 1 box of 64 fl oz.
 */
export function statesPackagesAsSize({
  quantityInput,
  unitType,
  packageSizeInput,
  packageSizeUnitType,
}: Partial<PackageAmounts>): boolean {
  const count = parseDecimalInput(packageSizeInput ?? '');
  return (
    !!unitType &&
    unitType !== UnitType.Count &&
    packageSizeUnitType === UnitType.Count &&
    parseFractionalInput(quantityInput ?? '') !== null &&
    Number.isInteger(count) &&
    count > 0
  );
}

export const moveToPantrySchema: ObjectSchema<MoveToPantryFormValues> = object({
  pantryId: string()
    .nullable()
    .required(lazyMessage('moveToPantry.selectPantryError')),
  quantityInput: quantityRule('errors.invalidQuantity'),
  // A unit is chosen from the catalog OR typed; either satisfies the field, so
  // the rule lives on the one the person sees.
  unitValue: string()
    .defined()
    .when('unitId', {
      is: (id: string | null) => !id,
      then: schema =>
        schema.trim().required(lazyMessage('moveToPantry.selectUnitError')),
    }),
  unitId: string().nullable().defined(),
  unitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
  storageState: mixed<StorageState>()
    .oneOf(Object.values(StorageState))
    .required(),
  expirationDate: date().optional(),
  removeFromList: boolean().defined(),
  actualPriceInput: optionalMoneyRule('errors.invalidAmountPaid'),
  notes: string().defined(),
  // Both or neither: a size needs the unit it is measured in.
  packageSizeInput: positiveDecimalRule('errors.field.netWeight', {
    optional: true,
  })
    // A size is one package's: it goes with a whole count in a counted unit
    // (2 jars), never with an amount, where 500 g would read as 500 packages.
    .test(
      'package-count',
      lazyMessage('moveToPantry.packageSizeNeedsCount'),
      (value, context: { parent: Partial<MoveToPantryFormValues> }) => {
        if (!value.trim()) return true;
        if (statesPackagesAsSize(context.parent)) return true;
        const count = parseFractionalInput(context.parent.quantityInput ?? '');
        return (
          context.parent.unitType === UnitType.Count &&
          count !== null &&
          Number.isInteger(count)
        );
      },
    ),
  packageSizeUnitValue: string()
    .defined()
    .test(
      'package-size-unit',
      lazyMessage('errors.field.netWeight'),
      (value, context: { parent: Partial<MoveToPantryFormValues> }) => {
        const size = (context.parent.packageSizeInput ?? '').trim();
        const unitId = context.parent.packageSizeUnitId;
        return size ? !!unitId : !unitId && !value.trim();
      },
    ),
  packageSizeUnitId: string().nullable().defined(),
  packageSizeUnitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
});

export const moveToPantryDefaults = (
  storageState: StorageState,
): MoveToPantryFormValues => ({
  pantryId: null,
  quantityInput: '',
  unitValue: '',
  unitId: null,
  unitType: null,
  storageState,
  expirationDate: undefined,
  removeFromList: true,
  actualPriceInput: '',
  notes: '',
  packageSizeInput: '',
  packageSizeUnitValue: '',
  packageSizeUnitId: null,
  packageSizeUnitType: null,
});
