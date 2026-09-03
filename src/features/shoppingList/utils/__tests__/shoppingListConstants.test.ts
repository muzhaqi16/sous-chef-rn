import { PAGINATION } from '../shoppingListConstants';

describe('shopping list constants', () => {
  it('exports PAGINATION', () => {
    expect(PAGINATION.ITEMS_PAGE_SIZE).toBe(25);
  });
});
