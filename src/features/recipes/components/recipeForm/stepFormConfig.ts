import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface StepFormValues {
  instruction: string;
}

export const stepSchema: ObjectSchema<StepFormValues> = object({
  instruction: string()
    .trim()
    .required(lazyMessage('recipes.instructionRequired')),
});
