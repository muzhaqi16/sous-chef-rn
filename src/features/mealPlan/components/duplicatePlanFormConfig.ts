import { number, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface DuplicatePlanFormValues {
  name: string;
  /** Days the copy moves on from the day after the plan ends, a week a step. */
  startDateOffset: number;
}

export const duplicatePlanSchema: ObjectSchema<DuplicatePlanFormValues> =
  object({
    name: string().trim().required(lazyMessage('mealPlan.nameRequiredMessage')),
    startDateOffset: number().defined(),
  });
