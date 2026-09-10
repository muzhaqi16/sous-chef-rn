import { ValidationError } from 'yup';
import {
  moveToPantryDefaults,
  moveToPantrySchema,
} from '../moveToPantryFormConfig';
import { StorageState } from '#/graphql/generated/schemaTypes';

/**
 * A field the person can fix is reported ON the field: an alert covers the form
 * and, once dismissed, does not say which field it meant. These cases pin what
 * the schema refuses and where it attaches the message.
 */
describe('the move-to-pantry schema', () => {
  const filled = {
    ...moveToPantryDefaults(StorageState.Ambient),
    pantryId: 'pantry-1',
    quantityInput: '2',
    unitValue: 'kg',
  };

  it('accepts a pantry, a positive quantity and a unit', async () => {
    await expect(moveToPantrySchema.validate(filled)).resolves.toBeTruthy();
  });

  it.each([
    ['pantryId', { pantryId: null }],
    ['quantityInput', { quantityInput: '0' }],
    ['quantityInput', { quantityInput: 'abc' }],
    ['unitValue', { unitValue: '  ', unitId: null }],
  ])('reports a bad %s on that field', async (path, override) => {
    const error = await moveToPantrySchema
      .validate({ ...filled, ...override })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe(path);
  });

  it('takes a unit chosen from the catalog in place of a typed one', async () => {
    await expect(
      moveToPantrySchema.validate({
        ...filled,
        unitValue: '',
        unitId: 'unit-1',
      }),
    ).resolves.toBeTruthy();
  });

  it('reads a fraction as a quantity', async () => {
    await expect(
      moveToPantrySchema.validate({ ...filled, quantityInput: '1 1/2' }),
    ).resolves.toBeTruthy();
  });
});
