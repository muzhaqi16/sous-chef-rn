import { ValidationError } from 'yup';
import {
  createMealPlanDefaults,
  createMealPlanSchema,
  PERSONAL_VALUE,
} from '../createMealPlanFormConfig';
import { MealPlanType } from '#/graphql/generated/schemaTypes';

/**
 * A field the person can fix is reported ON the field: an alert covers the form
 * and, once dismissed, does not say which field it meant. These cases pin what
 * the schema refuses and where it attaches the message.
 */
describe('the create-meal-plan schema', () => {
  const valid = createMealPlanDefaults(null);

  it('accepts the defaults once a name is typed', async () => {
    await expect(
      createMealPlanSchema.validate({ ...valid, name: 'Week one' }),
    ).resolves.toBeTruthy();
  });

  it('refuses a blank name, on the name field', async () => {
    await expect(
      createMealPlanSchema.validate({ ...valid, name: '   ' }),
    ).rejects.toThrow(ValidationError);

    const error = await createMealPlanSchema
      .validate({ ...valid, name: '' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('name');
  });

  it('refuses a missing start date, on the start-date field', async () => {
    const error = await createMealPlanSchema
      .validate({ ...valid, name: 'Week one', startDate: null })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('startDate');
  });

  it('defaults to the selected home, and to personal without one', () => {
    expect(createMealPlanDefaults('home-1').homeSelection).toBe('home-1');
    expect(createMealPlanDefaults(null).homeSelection).toBe(PERSONAL_VALUE);
    expect(createMealPlanDefaults(null).planType).toBe(MealPlanType.Weekly);
  });
});
