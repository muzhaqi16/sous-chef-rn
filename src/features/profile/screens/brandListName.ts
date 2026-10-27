import { object, string } from 'yup';
import { lazyMessage } from '#/utils/validation/common';

/** A brand list's name, as the API takes it: 1 to 100 characters. */
export const brandListNameSchema = object({
  name: string()
    .trim()
    .required(lazyMessage('brandLists.nameRequired'))
    .max(100, lazyMessage('brandLists.nameTooLong')),
});
