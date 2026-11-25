import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface JoinHomeFormValues {
  code: string;
}

export const joinHomeSchema: ObjectSchema<JoinHomeFormValues> = object({
  code: string().trim().required(lazyMessage('labels.pleaseEnterAJoinCode')),
});
