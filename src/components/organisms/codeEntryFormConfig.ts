import { object, string, type ObjectSchema } from 'yup';
import type { TranslationKey } from '#i18n';
import { lazyMessage } from '#utils/validation/common';

export interface CodeEntryFormValues {
  code: string;
}

export const codeEntrySchema = (
  requiredMessage: TranslationKey,
): ObjectSchema<CodeEntryFormValues> =>
  object({ code: string().trim().required(lazyMessage(requiredMessage)) });
