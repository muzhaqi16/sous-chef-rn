import type { TranslationKey } from '#/i18n';
import { resolveIntakeDraft, type IntakeField } from '#domain/intakeDraft';
import { contentsOf } from '#domain/stockAmount';
import type { MoveToPantryInput } from '#features/shoppingList/hooks/useMoveToPantry';
import { toDateKey } from '#/utils/dateUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { parseMoneyInput } from '#/utils/validation/common';
import {
  statesPackagesAsSize,
  type MoveToPantryFormValues,
} from './moveToPantryFormConfig';

type AmountField = 'unitValue' | 'quantityInput' | 'packageSizeInput';

/** The move to send, or the field stating a fact the amount still lacks. */
export type MoveToPantryBuild =
  | { input: MoveToPantryInput }
  | { missing: { field: AmountField; key: TranslationKey } };

/** The field stating a fact the amount still lacks, and what it says. */
function missingFactField(
  missing: IntakeField,
  statedTheOtherWay: boolean,
): { field: AmountField; key: TranslationKey } {
  switch (missing) {
    case 'unit':
      return { field: 'unitValue', key: 'moveToPantry.selectUnitError' };
    case 'quantity':
      // Stated the other way round, the package count is in the size's field.
      return {
        field: statedTheOtherWay ? 'packageSizeInput' : 'quantityInput',
        key: 'errors.invalidQuantity',
      };
    case 'packageSize':
      return {
        field: statedTheOtherWay ? 'quantityInput' : 'packageSizeInput',
        key: 'errors.field.netWeight',
      };
  }
}

/**
 * The move a form that passed its schema states. A stated size carries its
 * unit and goes with a whole count in a counted unit: that many packages of
 * the picked unit, which the server records. Without one, the amount as typed.
 */
export function buildMoveToPantryInput(
  values: MoveToPantryFormValues,
  askPrice: boolean,
): MoveToPantryBuild {
  const quantity = parseFractionalInput(values.quantityInput);
  if (quantity === null) {
    return {
      missing: { field: 'quantityInput', key: 'errors.invalidQuantity' },
    };
  }

  const { unitId, packageSizeInput, packageSizeUnitId } = values;
  const contents =
    packageSizeInput.trim() && packageSizeUnitId
      ? {
          amount: parseDecimalInput(packageSizeInput),
          unitId: packageSizeUnitId,
          unitType: values.packageSizeUnitType,
        }
      : null;
  const statedTheOtherWay =
    contents !== null && !!unitId && statesPackagesAsSize(values);
  const { packageSize, measurementProfile } = contentsOf(
    statedTheOtherWay ? null : contents,
  );
  const { amount, unresolved } = statedTheOtherWay
    ? resolveIntakeDraft({
        purchased: {
          quantity: contents.amount,
          intent: 'packages',
          packageSize: { netWeight: quantity, netWeightUnitId: unitId },
          unitId: contents.unitId,
        },
      })
    : resolveIntakeDraft({
        purchased: {
          quantity,
          intent: contents === null ? 'measured' : 'packages',
          packageSize,
          unitId,
        },
        // A unit typed and not resolved goes as the list line's.
        unitFromRoute: true,
      });
  if (!amount) {
    const [missing = 'quantity'] = unresolved;
    return { missing: missingFactField(missing, statedTheOtherWay) };
  }

  return {
    input: {
      pantryId: values.pantryId ?? '',
      amount,
      measurementProfile,
      storageState: values.storageState,
      expiresOn: values.expirationDate
        ? toDateKey(values.expirationDate)
        : undefined,
      removeFromList: values.removeFromList,
      // The field asks for the TOTAL paid, as Mark Purchased does; the server
      // records it exactly and derives the unit price.
      totalCost: askPrice
        ? parseMoneyInput(values.actualPriceInput) ?? undefined
        : undefined,
      notes: values.notes || undefined,
    },
  };
}
