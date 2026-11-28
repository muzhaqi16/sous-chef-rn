import { object, string, type ObjectSchema } from 'yup';
import { t } from '#i18n';
import { lazyMessage } from '#utils/validation/common';

export interface FolderNameFormValues {
  name: string;
}

/** What the schema reads beyond the form (`useForm`'s `context`). */
export interface FolderNameFormContext {
  /** Names other folders already have, which this one may not take. */
  takenNames: readonly string[];
}

export const folderNameSchema: ObjectSchema<FolderNameFormValues> = object({
  name: string()
    .trim()
    .required(lazyMessage('folderPicker.nameRequired'))
    .test(
      'unique',
      ({ value }: { value: unknown }) =>
        t('folderPicker.duplicate', { name: String(value) }),
      (value, { options }) => {
        const context: Partial<FolderNameFormContext> | undefined =
          options.context;
        return !(context?.takenNames ?? []).includes(value);
      },
    ),
});
