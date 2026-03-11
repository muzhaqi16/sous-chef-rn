import {
  createItemNameSearch,
  createCategorySearch,
  pantryItemSearch,
  shoppingListItemSearch,
} from '../searchUtils';

describe('createItemNameSearch', () => {
  it('matches case-insensitively', () => {
    expect(createItemNameSearch({ itemName: 'Apple' }, 'apple')).toBe(true);
    expect(createItemNameSearch({ itemName: 'apple' }, 'APPLE')).toBe(true);
  });

  it('matches partial strings', () => {
    expect(createItemNameSearch({ itemName: 'Green Apple' }, 'app')).toBe(true);
  });

  it('returns false for no match', () => {
    expect(createItemNameSearch({ itemName: 'Apple' }, 'banana')).toBe(false);
  });

  it('returns false for null itemName', () => {
    expect(createItemNameSearch({ itemName: null }, 'apple')).toBe(false);
  });

  it('returns false for empty query', () => {
    expect(createItemNameSearch({ itemName: 'Apple' }, '')).toBe(false);
  });
});

describe('createCategorySearch', () => {
  it('matches category case-insensitively', () => {
    expect(createCategorySearch({ category: 'Fruits' }, 'fruit')).toBe(true);
  });
});

describe('pantryItemSearch', () => {
  it('matches by itemName', () => {
    expect(pantryItemSearch({ itemName: 'Apple' }, 'app')).toBe(true);
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
    expect(shoppingListItemSearch({ itemName: 'Milk', category: 'Dairy' }, 'milk')).toBe(true);
  });

  it('matches by category', () => {
    expect(shoppingListItemSearch({ itemName: 'Milk', category: 'Dairy' }, 'dairy')).toBe(true);
  });
});
