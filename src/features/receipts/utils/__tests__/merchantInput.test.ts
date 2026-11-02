import { merchantInputOf } from '../merchantInput';

describe('merchantInputOf', () => {
  it('sends what the receipt names, trimmed', () => {
    expect(
      merchantInputOf({
        name: ' Kroger ',
        address: '412 Main St',
        storeNumber: '412',
      }),
    ).toEqual({ name: 'Kroger', address: '412 Main St', storeNumber: '412' });
  });

  // A longer value would refuse the whole check-in: it goes as unread.
  it('leaves out a value past the API cap, as a blank one', () => {
    expect(
      merchantInputOf({
        name: 'Kroger',
        address: 'x'.repeat(256),
        storeNumber: '9'.repeat(33),
      }),
    ).toEqual({ name: 'Kroger' });
    expect(merchantInputOf({ name: ' ', address: '' })).toBeNull();
  });

  it('is nothing without a receipt store', () => {
    expect(merchantInputOf(undefined)).toBeNull();
  });
});
