import { object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: TranslationKey) => (): string => t(key);

export interface PackSizeFormValues {
  sizeInput: string;
  unitDisplay: string;
  unitId: string | null;
}

export const packSizeSchema: ObjectSchema<PackSizeFormValues> = object({
  // A localized decimal string, so the rule runs on the parsed number.
  sizeInput: string()
    .defined()
    .test('is-positive-size', msg('barcode.packSize.invalid'), value => {
      const parsed = parseDecimalInput(value);
      return !isNaN(parsed) && parsed > 0;
    }),
  unitDisplay: string().defined(),
  // Picked from the list, not typed: the size is stored in that unit's id.
  unitId: string()
    .nullable()
    .defined()
    .test(
      'unit-picked',
      msg('barcode.packSize.unitRequired'),
      value => !!value,
    ),
});

export const packSizeDefaults = (): PackSizeFormValues => ({
  sizeInput: '',
  unitDisplay: '',
  unitId: null,
});

export const parsePackSize = (values: PackSizeFormValues): number =>
  parseDecimalInput(values.sizeInput);
