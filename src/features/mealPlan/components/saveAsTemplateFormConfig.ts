import { mixed, object, string, type ObjectSchema } from 'yup';
import { TemplateCategory } from '#graphql/generated/schemaTypes';
import { commaTagsRule, lazyMessage } from '#utils/validation/common';
import { MAX_TEMPLATE_TAGS } from '#utils/validation/entryLimits';

export interface SaveAsTemplateFormValues {
  name: string;
  description: string;
  category: TemplateCategory;
  /** Comma-separated, as typed. */
  tags: string;
}

export const saveAsTemplateSchema: ObjectSchema<SaveAsTemplateFormValues> =
  object({
    name: string()
      .trim()
      .required(lazyMessage('mealTemplateBuilder.nameRequiredMessage')),
    description: string().trim().defined(),
    category: mixed<TemplateCategory>()
      .oneOf(Object.values(TemplateCategory))
      .defined(),
    tags: commaTagsRule(MAX_TEMPLATE_TAGS),
  });
