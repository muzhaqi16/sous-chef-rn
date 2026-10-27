import { boolean, object, type ObjectSchema } from 'yup';
import { homeNameRule } from '#/utils/validation/common';

export interface CreateHomeFormValues {
  name: string;
  allowJoinCode: boolean;
}

export const createHomeSchema: ObjectSchema<CreateHomeFormValues> = object({
  name: homeNameRule,
  allowJoinCode: boolean().defined(),
});

export const CREATE_HOME_DEFAULTS: CreateHomeFormValues = {
  name: '',
  allowJoinCode: true,
};
