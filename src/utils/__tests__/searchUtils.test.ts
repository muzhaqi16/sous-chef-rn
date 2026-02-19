import {
  createItemNameSearch,
  createNestedItemNameSearch,
  createCategorySearch,
  createNameSearch,
  createDescriptionSearch,
  createNotesSearch,
  createBrandSearch,
  createTagsSearch,
  combineSearchPredicates,
  combineSearchPredicatesAnd,
  pantryItemSearch,
  recipeSearch,
  shoppingListItemSearch,
  homeSearch,
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

describe('createNestedItemNameSearch', () => {
  it('searches in nested item.name', () => {
    expect(createNestedItemNameSearch({ item: { name: 'Apple' } }, 'apple')).toBe(true);
  });

  it('returns false for null item', () => {
    expect(createNestedItemNameSearch({ item: null }, 'apple')).toBe(false);
  });
});

describe('createCategorySearch', () => {
  it('matches category case-insensitively', () => {
    expect(createCategorySearch({ category: 'Fruits' }, 'fruit')).toBe(true);
  });
});

describe('createNameSearch', () => {
  it('matches name field', () => {
    expect(createNameSearch({ name: 'Italian Pasta' }, 'pasta')).toBe(true);
  });
});

describe('createDescriptionSearch', () => {
  it('matches description field', () => {
    expect(createDescriptionSearch({ description: 'A delicious recipe' }, 'delicious')).toBe(true);
  });
});

describe('createNotesSearch', () => {
  it('matches notes field', () => {
    expect(createNotesSearch({ notes: 'Buy organic' }, 'organic')).toBe(true);
  });
});

describe('createBrandSearch', () => {
  it('matches brand field', () => {
    expect(createBrandSearch({ brand: 'Heinz' }, 'heinz')).toBe(true);
  });
});

describe('createTagsSearch', () => {
  it('matches any tag in array', () => {
    expect(createTagsSearch({ tags: ['vegan', 'organic', 'local'] }, 'organ')).toBe(true);
  });

  it('returns false when no tags match', () => {
    expect(createTagsSearch({ tags: ['vegan'] }, 'organic')).toBe(false);
  });

  it('returns false for null tags', () => {
    expect(createTagsSearch({ tags: null }, 'test')).toBe(false);
  });

  it('returns false for empty query', () => {
    expect(createTagsSearch({ tags: ['test'] }, '')).toBe(false);
  });
});

describe('combineSearchPredicates', () => {
  const searchFn = combineSearchPredicates<{ itemName?: string | null; category?: string | null }>(createItemNameSearch, createCategorySearch);

  it('matches if any predicate matches (OR logic)', () => {
    expect(searchFn({ itemName: 'Apple', category: 'Dairy' }, 'apple')).toBe(true);
    expect(searchFn({ itemName: 'Milk', category: 'Dairy' }, 'dairy')).toBe(true);
  });

  it('returns false if no predicates match', () => {
    expect(searchFn({ itemName: 'Apple', category: 'Fruit' }, 'banana')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(searchFn({ itemName: 'Apple' }, '')).toBe(true);
  });

  it('returns true for whitespace-only query', () => {
    expect(searchFn({ itemName: 'Apple' }, '   ')).toBe(true);
  });
});

describe('combineSearchPredicatesAnd', () => {
  const searchFn = combineSearchPredicatesAnd<{ itemName?: string | null; category?: string | null }>(createItemNameSearch, createCategorySearch);

  it('requires all predicates to match (AND logic)', () => {
    // Only itemName matches, not category
    expect(searchFn({ itemName: 'Apple', category: 'Fruit' }, 'apple')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(searchFn({ itemName: 'Apple', category: 'Fruit' }, '')).toBe(true);
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

describe('recipeSearch', () => {
  it('matches by name', () => {
    expect(recipeSearch({ name: 'Pasta', description: 'Italian' }, 'pasta')).toBe(true);
  });

  it('matches by description', () => {
    expect(recipeSearch({ name: 'Pasta', description: 'Italian dish' }, 'italian')).toBe(true);
  });

  it('returns false when neither matches', () => {
    expect(recipeSearch({ name: 'Pasta', description: 'Italian' }, 'sushi')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(recipeSearch({ name: 'Pasta' }, '')).toBe(true);
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

describe('homeSearch', () => {
  it('matches by name', () => {
    expect(homeSearch({ name: 'My Home' }, 'home')).toBe(true);
  });
});
