import { boolean, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

// The API's bounds (createPantrySchema, updatePantrySchema): a name of 1-255
// characters and a description of at most 500, both trimmed.
const MAX_PANTRY_NAME_LENGTH = 255;
export const MAX_PANTRY_DESCRIPTION_LENGTH = 500;

export interface PantrySettingsFormValues {
  name: string;
  description: string;
  isDefault: boolean;
}

export const pantrySettingsSchema: ObjectSchema<PantrySettingsFormValues> =
  object({
    name: string()
      .trim()
      .required(lazyMessage('pantrySettings.nameEmptyError'))
      .max(
        MAX_PANTRY_NAME_LENGTH,
        lazyMessage('errors.nameTooLong', { max: MAX_PANTRY_NAME_LENGTH }),
      ),
    description: string().trim().defined(),
    isDefault: boolean().defined(),
  });

export const EMPTY_PANTRY_SETTINGS: PantrySettingsFormValues = {
  name: '',
  description: '',
  isDefault: false,
};
