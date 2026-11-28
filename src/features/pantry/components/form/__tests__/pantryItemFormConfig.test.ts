import { t } from '#i18n';
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

  it('refuses an amount changed to nothing left', async () => {
    await expect(
      editItemSchema.validateAt(
        'quantityInput',
        { quantityInput: '0' },
        { context: { quantitySeed: '2' } },
      ),
    ).rejects.toThrow(t('errors.invalidQuantity'));
  });

  it('lets an empty stack keep its 0, so its other fields stay editable', async () => {
    await expect(
      editItemSchema.validateAt(
        'quantityInput',
        { quantityInput: '0' },
        { context: { quantitySeed: '0' } },
      ),
    ).resolves.toBe('0');
  });
});
