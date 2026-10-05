import type { ValidationError } from 'yup';
import { packSizeDefaults, packSizeSchema } from '../packSizeFormConfig';

/**
 * The size a scanned product is missing is reported on the field the user can
 * fix, so these pin what the schema refuses and where the message lands.
 */
describe('the pack-size schema', () => {
  const filled = {
    ...packSizeDefaults(),
    sizeInput: '32',
    unitDisplay: 'oz',
    unitId: 'unit-oz',
  };

  it('accepts a positive size in a picked unit', async () => {
    await expect(packSizeSchema.validate(filled)).resolves.toBeTruthy();
  });

  it.each([
    ['sizeInput', { sizeInput: '0' }],
    ['sizeInput', { sizeInput: '-2' }],
    ['sizeInput', { sizeInput: 'abc' }],
    ['sizeInput', { sizeInput: '' }],
    ['unitId', { unitId: null }],
    ['unitId', { unitId: '' }],
  ])('reports a bad %s on that field', async (path, override) => {
    const error = await packSizeSchema
      .validate({ ...filled, ...override })
      .catch((e: ValidationError) => e);

    expect((error as ValidationError).path).toBe(path);
  });
});
