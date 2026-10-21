import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  MAX_CATALOG_INGREDIENTS,
  MAX_CATALOG_INGREDIENT_LENGTH,
  acceptedIngredientNames,
  catalogIngredientNames,
  catalogKey,
} from '#domain/catalogRecipes';

const names = (count: number, prefix = 'item'): string[] =>
  Array.from(
    { length: count },
    (_, i) => `${prefix} ${String(i).padStart(2, '0')}`,
  );

describe('acceptedIngredientNames', () => {
  it('splits each name at its commas, as the API counts it', () => {
    expect(acceptedIngredientNames(['Beans, black, canned', 'Rice'])).toEqual([
      'beans',
      'black',
      'canned',
      'rice',
    ]);
  });

  it('trims, lower-cases and collapses whitespace', () => {
    expect(acceptedIngredientNames(['  Olive \t  OIL  '])).toEqual([
      'olive oil',
    ]);
  });

  it('names a duplicate once, in first-seen order', () => {
    expect(acceptedIngredientNames(['Milk', 'eggs', 'milk', ' MILK '])).toEqual(
      ['milk', 'eggs'],
    );
  });

  it('leaves out empty parts and names the API refuses for length', () => {
    const tooLong = 'a'.repeat(MAX_CATALOG_INGREDIENT_LENGTH + 1);
    const longest = 'b'.repeat(MAX_CATALOG_INGREDIENT_LENGTH);
    expect(acceptedIngredientNames(['', ' , ', tooLong, longest])).toEqual([
      longest,
    ]);
  });

  it('does not cap the count', () => {
    expect(acceptedIngredientNames(names(30))).toHaveLength(30);
  });
});

describe('catalogIngredientNames', () => {
  it('keeps the first accepted names up to the cap', () => {
    const sent = catalogIngredientNames(['Beans, black, canned', ...names(25)]);
    expect(sent).toHaveLength(MAX_CATALOG_INGREDIENTS);
    expect(sent).toEqual(expect.arrayContaining(['beans', 'black', 'canned']));
    expect(sent).not.toContain('item 17');
  });

  it('is sorted, so the order the names came in does not change it', () => {
    expect(catalogIngredientNames(['tomato', 'Basil', 'garlic'])).toEqual([
      'basil',
      'garlic',
      'tomato',
    ]);
    expect(catalogIngredientNames(['garlic', 'tomato', 'basil'])).toEqual(
      catalogIngredientNames(['tomato', 'Basil', 'garlic']),
    );
  });

  it('is empty when no name is usable', () => {
    expect(
      catalogIngredientNames(['x'.repeat(MAX_CATALOG_INGREDIENT_LENGTH + 50)]),
    ).toEqual([]);
  });
});

describe('catalogKey', () => {
  it('names the provider, so two providers never share a key', () => {
    const id = '715538';
    expect(
      catalogKey({
        provider: ExternalSource.Spoonacular,
        providerRecipeId: id,
      }),
    ).not.toBe(
      catalogKey({ provider: ExternalSource.Tasty, providerRecipeId: id }),
    );
  });
});
