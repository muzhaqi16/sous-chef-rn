import {
  catalogFetchedAt,
  catalogFetchKey,
  recordCatalogFetch,
} from '../catalogFetchTimes';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('catalogFetchKey', () => {
  it('names the same answer whatever order its arguments came in', () => {
    expect(
      catalogFetchKey('catalogRecipesByIngredients', {
        ingredients: ['basil', 'tomato'],
        first: 25,
      }),
    ).toBe(
      catalogFetchKey('catalogRecipesByIngredients', {
        first: 25,
        ingredients: ['basil', 'tomato'],
      }),
    );
  });

  it('tells fields, argument values and list order apart', () => {
    const keys = new Set([
      catalogFetchKey('catalogRecipesByIngredients', { first: 25 }),
      catalogFetchKey('randomCatalogRecipes', { first: 25 }),
      catalogFetchKey('catalogRecipesByIngredients', { first: 5 }),
      catalogFetchKey('catalogRecipesByIngredients', {
        ingredients: ['a', 'b'],
      }),
      catalogFetchKey('catalogRecipesByIngredients', {
        ingredients: ['b', 'a'],
      }),
    ]);
    expect(keys.size).toBe(5);
  });
});

describe('recordCatalogFetch', () => {
  it('drops times no catalog read would still honour', () => {
    const now = Date.now();
    recordCatalogFetch('old', now - 8 * DAY_MS);
    recordCatalogFetch('recent', now - 6 * DAY_MS);
    recordCatalogFetch('new', now);

    expect(catalogFetchedAt('old')).toBeUndefined();
    expect(catalogFetchedAt('recent')).toBe(now - 6 * DAY_MS);
    expect(catalogFetchedAt('new')).toBe(now);
  });
});
