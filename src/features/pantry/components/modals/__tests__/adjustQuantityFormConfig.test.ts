import { ValidationError } from 'yup';
import {
  adjustQuantityDefaults,
  adjustQuantitySchema,
  parseQuantity,
  parseRemainingWeight,
} from '../adjustQuantityFormConfig';

/**
 * A field the person can fix is reported ON the field: an alert covers the sheet
 * and, once dismissed, does not say which input it meant. These cases pin what
 * the schema refuses and where it attaches the message.
 */
describe('the adjust-quantity schema', () => {
  const filled = {
    ...adjustQuantityDefaults(),
    quantityInput: '3',
    reason: 'Recount after a shop',
  };

  it('accepts a quantity and a reason', async () => {
    await expect(adjustQuantitySchema.validate(filled)).resolves.toBeTruthy();
  });

  // Zero is a real adjustment — the item ran out — so only a negative or an
  // unreadable entry is refused.
  it('accepts zero', async () => {
    await expect(
      adjustQuantitySchema.validate({ ...filled, quantityInput: '0' }),
    ).resolves.toBeTruthy();
  });

  it.each([
    ['quantityInput', { quantityInput: '-1' }],
    ['quantityInput', { quantityInput: 'abc' }],
    ['quantityInput', { quantityInput: '' }],
    ['reason', { reason: '   ' }],
  ])('reports a bad %s on that field', async (path, override) => {
    const error = await adjustQuantitySchema
      .validate({ ...filled, ...override })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe(path);
  });

  // The field takes a fraction, and the rule and the submitted value have to
  // read it the same way.
  it('reads a fraction the way the submitted value does', async () => {
    const values = { ...filled, quantityInput: '1 1/4' };
    await expect(adjustQuantitySchema.validate(values)).resolves.toBeTruthy();
    expect(parseQuantity(values)).toBe(1.25);
  });

  it('leaves the remaining weight optional', async () => {
    await expect(adjustQuantitySchema.validate(filled)).resolves.toBeTruthy();
    expect(parseRemainingWeight(filled)).toBeUndefined();
  });

  it('submits a remaining weight when one is typed', () => {
    expect(
      parseRemainingWeight({ ...filled, remainingWeightInput: '120' }),
    ).toBe(120);
  });
});
