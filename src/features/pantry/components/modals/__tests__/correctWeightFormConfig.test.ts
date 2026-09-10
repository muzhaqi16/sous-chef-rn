import { ValidationError } from 'yup';
import {
  correctWeightDefaults,
  correctWeightSchema,
  parseWeight,
} from '../correctWeightFormConfig';

/**
 * A field the person can fix is reported ON the field: an alert covers the sheet
 * and, once dismissed, does not say which input it meant. These cases pin what
 * the schema refuses and where it attaches the message.
 */
describe('the correct-weight schema', () => {
  const filled = {
    ...correctWeightDefaults(),
    weightInput: '145',
    reason: 'Scale was mis-tared',
  };

  it('accepts a positive weight and a reason', async () => {
    await expect(correctWeightSchema.validate(filled)).resolves.toBeTruthy();
  });

  it.each([
    ['weightInput', { weightInput: '0' }],
    ['weightInput', { weightInput: '-3' }],
    ['weightInput', { weightInput: 'abc' }],
    ['weightInput', { weightInput: '' }],
    ['reason', { reason: '   ' }],
  ])('reports a bad %s on that field', async (path, override) => {
    const error = await correctWeightSchema
      .validate({ ...filled, ...override })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe(path);
  });

  // The field holds a localized decimal string, so the rule and the value the
  // caller submits have to read it the same way.
  it('reads a decimal comma the way the submitted value does', async () => {
    const values = { ...filled, weightInput: '1,5' };
    await expect(correctWeightSchema.validate(values)).resolves.toBeTruthy();
    expect(parseWeight(values)).toBe(1.5);
  });

  it('leaves the unit optional — a weight can keep the one it had', async () => {
    await expect(
      correctWeightSchema.validate({
        ...filled,
        unitDisplay: '',
        selectedUnitId: null,
      }),
    ).resolves.toBeTruthy();
  });
});
