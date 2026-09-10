import { ValidationError } from 'yup';
import {
  templateDefaults,
  templateItemDefaults,
  templateItemSchema,
  templateSchema,
} from '../mealTemplateBuilderFormConfig';
import { MealType, TemplateCategory } from '#/graphql/generated/schemaTypes';

/**
 * A field the person can fix is reported ON the field: an alert covers the form
 * and, once dismissed, does not say which field it meant. Two forms share this
 * screen, so each refusal has to name its own.
 */
describe('the meal-template builder schemas', () => {
  const template = {
    ...templateDefaults(TemplateCategory.Weekly),
    name: 'Weeknights',
  };
  const item = {
    ...templateItemDefaults(MealType.Breakfast),
    itemName: 'Porridge',
  };

  it('accepts a named template and a named item', async () => {
    await expect(templateSchema.validate(template)).resolves.toBeTruthy();
    await expect(templateItemSchema.validate(item)).resolves.toBeTruthy();
  });

  it('reports a blank template name on the template name field', async () => {
    const error = await templateSchema
      .validate({ ...template, name: '  ' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('name');
  });

  it('reports a blank meal name on the ITEM name field', async () => {
    const error = await templateItemSchema
      .validate({ ...item, itemName: '' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('itemName');
  });

  it('starts an item on day zero, which the control shows as day one', () => {
    expect(templateItemDefaults(MealType.Lunch).itemDay).toBe('0');
  });
});
