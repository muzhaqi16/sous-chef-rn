import { ValidationError } from 'yup';
import {
  macroTargetUpdates,
  macroTargetsDefaults,
  macroTargetsSchema,
} from '../macroTargetsFormConfig';
import { DIETARY_LIMITS } from '#domain/dietary';

/**
 * A field the person can fix is reported ON the field. All four targets are
 * checked against their own range and the message lands on that input, so a
 * rejected number says which of the four it is about.
 */
describe('the macro-targets schema', () => {
  const blank = macroTargetsDefaults();

  it('accepts an entirely blank form — every target is optional', async () => {
    await expect(macroTargetsSchema.validate(blank)).resolves.toBeTruthy();
    expect(macroTargetUpdates(blank)).toEqual({});
  });

  it.each([
    ['calories', DIETARY_LIMITS.calories.max + 1],
    ['protein', DIETARY_LIMITS.protein.max + 1],
    ['carbs', DIETARY_LIMITS.carbs.max + 1],
    ['fat', DIETARY_LIMITS.fat.max + 1],
  ])('reports an over-range %s on that field', async (macro, value) => {
    const error = await macroTargetsSchema
      .validate({ ...blank, [macro]: String(value) })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe(macro);
  });

  it('refuses a negative target', async () => {
    const error = await macroTargetsSchema
      .validate({ ...blank, protein: '-1' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('protein');
  });

  it('refuses an unreadable entry', async () => {
    const error = await macroTargetsSchema
      .validate({ ...blank, carbs: 'lots' })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe('carbs');
  });

  // A blank field must not reach the mutation, or saving one target would clear
  // the other three.
  it('sends only the targets that were filled in', () => {
    expect(
      macroTargetUpdates({ ...blank, calories: '2200', fat: '70' }),
    ).toEqual({ calorieTarget: 2200, fatTarget: 70 });
  });
});
