import type { ValidationError } from 'yup';
import {
  changedMealRef,
  mealRefOf,
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

  it('needs no meal name when the item names a saved recipe', async () => {
    await expect(
      templateItemSchema.validate({
        ...item,
        itemName: '',
        itemRecipeId: 'recipe-1',
        itemRecipeName: 'Carbonara',
      }),
    ).resolves.toBeTruthy();
  });
});

describe('the meal ref an item sends', () => {
  const recipeItem = { recipeId: 'recipe-1', customMealName: '' };
  const customItem = { recipeId: null, customMealName: 'Leftovers' };

  it('names the recipe when one is chosen, else the trimmed custom name', () => {
    expect(mealRefOf({ itemRecipeId: 'recipe-1', itemName: 'x' })).toEqual({
      recipeId: 'recipe-1',
    });
    expect(mealRefOf({ itemRecipeId: '', itemName: ' Soup ' })).toEqual({
      customMealName: 'Soup',
    });
  });

  // `meal: { customMealName }` on a recipe row replaces the recipe server-side.
  it('omits the meal when a recipe item keeps its recipe', () => {
    expect(
      changedMealRef(recipeItem, { itemRecipeId: 'recipe-1', itemName: '' }),
    ).toBeUndefined();
  });

  it('omits the meal when a custom item keeps its name', () => {
    expect(
      changedMealRef(customItem, { itemRecipeId: '', itemName: 'Leftovers ' }),
    ).toBeUndefined();
  });

  it('sends the change when the meal is swapped', () => {
    expect(
      changedMealRef(recipeItem, { itemRecipeId: 'recipe-2', itemName: '' }),
    ).toEqual({ recipeId: 'recipe-2' });
    expect(
      changedMealRef(recipeItem, { itemRecipeId: '', itemName: 'Toast' }),
    ).toEqual({ customMealName: 'Toast' });
    expect(
      changedMealRef(customItem, { itemRecipeId: 'recipe-1', itemName: '' }),
    ).toEqual({ recipeId: 'recipe-1' });
  });
});
