import { boolean, date, mixed, object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: string) => (): string => t(key);

export interface MoveToPantryFormValues {
  pantryId: string | null;
  quantityInput: string;
  unitValue: string;
  unitId: string | null;
  storageState: StorageState;
  expirationDate?: Date;
  removeFromList: boolean;
  actualPriceInput: string;
  notes: string;
}

export const moveToPantrySchema: ObjectSchema<MoveToPantryFormValues> = object({
  pantryId: string().nullable().required(msg('moveToPantry.selectPantryError')),
  quantityInput: string()
    .defined()
    .test('positive', msg('errors.invalidQuantity'), value => {
      const parsed = parseFractionalInput(value ?? '');
      return parsed !== null && !Number.isNaN(parsed) && parsed > 0;
    }),
  // A unit is chosen from the catalog OR typed; either satisfies the field, so
  // the rule lives on the one the person sees.
  unitValue: string()
    .defined()
    .when('unitId', {
      is: (id: string | null) => !id,
      then: schema =>
        schema.trim().required(msg('moveToPantry.selectUnitError')),
    }),
  unitId: string().nullable().defined(),
  storageState: mixed<StorageState>()
    .oneOf(Object.values(StorageState))
    .required(),
  expirationDate: date().optional(),
  removeFromList: boolean().defined(),
  actualPriceInput: string().defined(),
  notes: string().defined(),
});

export const moveToPantryDefaults = (
  storageState: StorageState,
): MoveToPantryFormValues => ({
  pantryId: null,
  quantityInput: '',
  unitValue: '',
  unitId: null,
  storageState,
  expirationDate: undefined,
  removeFromList: true,
  actualPriceInput: '',
  notes: '',
});
