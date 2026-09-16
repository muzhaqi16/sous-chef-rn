import { t } from '#/i18n';
import { editItemSchema } from '../pantryItemFormConfig';

describe('editItemSchema quantityInput', () => {
  it('reports text no quantity parser can read on the field', async () => {
    await expect(
      editItemSchema.validateAt('quantityInput', { quantityInput: 'abc' }),
    ).rejects.toThrow(t('errors.invalidQuantity'));
  });

  it.each(['2', '0.5', '1 1/4', '1/3'])('accepts %s', async value => {
    await expect(
      editItemSchema.validateAt('quantityInput', { quantityInput: value }),
    ).resolves.toBe(value);
  });
});
