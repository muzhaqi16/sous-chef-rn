import { date, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

export interface PlanFromTemplateFormValues {
  /** Blank takes the template's name. */
  name: string;
  startDate: Date | null;
  servings: string;
}

export const planFromTemplateSchema: ObjectSchema<PlanFromTemplateFormValues> =
  object({
    name: string().trim().defined(),
    startDate: date()
      .nullable()
      .required(lazyMessage('mealPlan.startDateRequiredMessage')),
    servings: string().defined(),
  });

export interface DuplicateTemplateFormValues {
  name: string;
}

export const duplicateTemplateSchema: ObjectSchema<DuplicateTemplateFormValues> =
  object({
    name: string()
      .trim()
      .required(lazyMessage('mealTemplateBuilder.nameRequiredMessage')),
  });
