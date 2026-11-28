import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface NewListFormValues {
  name: string;
}

export const newListSchema: ObjectSchema<NewListFormValues> = object({
  name: string().trim().required(lazyMessage('errors.listNameEmpty')),
});
