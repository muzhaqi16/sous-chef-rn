import { pantryItemSearch, shoppingListItemSearch } from '../searchUtils';

describe('pantryItemSearch', () => {
  it('matches by itemName', () => {
    expect(pantryItemSearch({ itemName: 'Apple' }, 'app')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(pantryItemSearch({ itemName: 'apple' }, 'APPLE')).toBe(true);
  });

  it('matches a one-character typo', () => {
    expect(pantryItemSearch({ itemName: 'Tomato' }, 'tomatoe')).toBe(true);
  });

  it('returns false for no match', () => {
    expect(pantryItemSearch({ itemName: 'Apple' }, 'banana')).toBe(false);
  });

  it('returns false for a null itemName', () => {
    expect(pantryItemSearch({ itemName: null }, 'apple')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(pantryItemSearch({ itemName: 'Apple' }, '')).toBe(true);
  });

  it('returns true for whitespace-only query', () => {
    expect(pantryItemSearch({ itemName: 'Apple' }, '  ')).toBe(true);
  });
});

describe('shoppingListItemSearch', () => {
  it('matches by itemName', () => {
    expect(
      shoppingListItemSearch({ itemName: 'Milk', category: 'Dairy' }, 'milk'),
    ).toBe(true);
  });

  it('matches by category', () => {
    expect(
      shoppingListItemSearch({ itemName: 'Milk', category: 'Dairy' }, 'dairy'),
    ).toBe(true);
  });
});
