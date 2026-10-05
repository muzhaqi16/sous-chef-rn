import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage, positiveDecimalRule } from '#/utils/validation/common';

export interface PackSizeFormValues {
  sizeInput: string;
  unitDisplay: string;
  unitId: string | null;
}

export const packSizeSchema: ObjectSchema<PackSizeFormValues> = object({
  sizeInput: positiveDecimalRule('barcode.packSize.invalid'),
  unitDisplay: string().defined(),
  // Picked from the list, not typed: the size is stored in that unit's id.
  unitId: string()
    .nullable()
    .defined()
    .test(
      'unit-picked',
      lazyMessage('barcode.packSize.unitRequired'),
      value => !!value,
    ),
});

export const packSizeDefaults = (): PackSizeFormValues => ({
  sizeInput: '',
  unitDisplay: '',
  unitId: null,
});
