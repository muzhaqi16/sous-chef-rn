import { mixed, string } from 'yup';
import { takesContents } from '#domain/stockAmount';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { positiveDecimalRule } from '#/utils/validation/common';

const statesSize = (unitType: UnitType | null, sizeInput: string) =>
  takesContents(unitType) && !!sizeInput.trim();

/** A count with something stated inside is whole packages: 1.5 bags of 5 lb is no amount. */
export const isWholeWhenSized = (
  quantityInput: string | undefined,
  unitType: UnitType | null,
  sizeInput: string,
): boolean =>
  !statesSize(unitType, sizeInput) ||
  Number.isInteger(parseFractionalInput(quantityInput ?? ''));

/** Only a stated size asks for its unit. */
export const isPickedWhenSized = (
  sizeUnitId: string | null | undefined,
  unitType: UnitType | null,
  sizeInput: string,
): boolean => !statesSize(unitType, sizeInput) || !!sizeUnitId;

/** The fields of a form's yup object that read no sibling. */
export const packageContentsFields = {
  sizeInput: positiveDecimalRule('packageSize.sizeInvalid', { optional: true }),
  sizeUnitDisplay: string().defined(),
  sizeUnitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
};
