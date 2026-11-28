import { boolean, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';
import type { ListSettingsValues } from '#features/shoppingList/hooks/listSettings/useListDetailsSection';

// The name's length is capped on the input (LIST_NAME_MAX_LENGTH).
export const listSettingsSchema: ObjectSchema<ListSettingsValues> = object({
  name: string().trim().required(lazyMessage('errors.listNameEmpty')),
  isDefault: boolean().defined(),
  homeId: string().nullable().defined(),
  templateId: string().nullable().defined(),
});

export const EMPTY_LIST_SETTINGS: ListSettingsValues = {
  name: '',
  isDefault: false,
  homeId: null,
  templateId: null,
};
