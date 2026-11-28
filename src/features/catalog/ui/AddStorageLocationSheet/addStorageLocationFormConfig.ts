import { object, type ObjectSchema } from 'yup';
import { storageLocationNameRule } from '#features/catalog/components/storageLocationFormConfig';

export interface AddStorageLocationFormValues {
  name: string;
}

export const addStorageLocationSchema: ObjectSchema<AddStorageLocationFormValues> =
  object({
    name: storageLocationNameRule,
  });
