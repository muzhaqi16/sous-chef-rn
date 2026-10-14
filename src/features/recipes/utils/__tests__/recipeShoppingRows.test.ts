import { AddedContext } from '#/graphql/generated/schemaTypes';
import {
  recipeShoppingRows,
  type RecipeIngredientLine,
} from '#features/recipes/utils/recipeShoppingRows';

const UNNAMED = 'Unnamed ingredient';

const line = (
  overrides: Partial<RecipeIngredientLine> = {},
): RecipeIngredientLine => ({
  id: 'ing-1',
  name: 'Flour',
  quantity: 2,
  isOptional: false,
  unit: { id: 'unit-cup', symbol: 'cup', name: 'cup' },
  item: { id: 'item-flour' },
  ...overrides,
});

/** Mints `row-1`, `row-2`, … so a row's id says which ingredient it came from. */
function sequentialIds() {
  let minted = 0;
  return () => {
    minted += 1;
    return `row-${minted}`;
  };
}

const rowsFor = (
  ingredients: RecipeIngredientLine[],
  options: { includeOptional?: boolean } = {},
) =>
  recipeShoppingRows('recipe-1', ingredients, {
    unnamed: UNNAMED,
    mintId: sequentialIds(),
    ...options,
  });

describe('recipeShoppingRows', () => {
  it('turns a catalog ingredient into a row naming its item, amount and unit', () => {
    expect(rowsFor([line()])).toEqual([
      {
        recipeIngredientId: 'ing-1',
        display: {
          itemName: 'Flour',
          quantity: 2,
          unitName: 'cup',
          itemId: 'item-flour',
        },
        input: {
          id: 'row-1',
          item: { itemId: 'item-flour' },
          quantity: 2,
          unit: { id: 'unit-cup' },
          recipeContext: {
            recipeId: 'recipe-1',
            recipeIngredientId: 'ing-1',
            addedContext: AddedContext.FromRecipe,
          },
        },
      },
    ]);
  });

  it('leaves an optional ingredient out by default', () => {
    const rows = rowsFor([
      line({ id: 'ing-1' }),
      line({ id: 'ing-salt', name: 'Salt', isOptional: true }),
      line({ id: 'ing-3' }),
    ]);

    expect(rows.map(row => row.recipeIngredientId)).toEqual(['ing-1', 'ing-3']);
    // An id is minted only for a row that is sent.
    expect(rows.map(row => row.input.id)).toEqual(['row-1', 'row-2']);
  });

  it('keeps an optional ingredient the user picked on its own', () => {
    const rows = rowsFor(
      [line({ id: 'ing-salt', name: 'Salt', isOptional: true })],
      { includeOptional: true },
    );

    expect(rows.map(row => row.recipeIngredientId)).toEqual(['ing-salt']);
  });

  it('adds an ingredient with no catalog item by its name', () => {
    const [row] = rowsFor([line({ name: 'Smoked paprika', item: null })]);

    expect(row!.input.item).toEqual({ itemName: 'Smoked paprika' });
    expect(row!.display).toMatchObject({ itemName: 'Smoked paprika' });
    expect(row!.display.itemId).toBeUndefined();
  });

  it('states no unit for an ingredient that has none', () => {
    const [row] = rowsFor([line({ unit: null })]);

    expect(row!.input).not.toHaveProperty('unit');
    expect(row!.display.unitName).toBeNull();
  });

  it('shows the unit by its name when it has no symbol', () => {
    const [row] = rowsFor([
      line({ unit: { id: 'unit-pinch', symbol: '', name: 'pinch' } }),
    ]);

    expect(row!.input.unit).toEqual({ id: 'unit-pinch' });
    expect(row!.display.unitName).toBe('pinch');
  });

  // The API refuses a quantity that is not above zero; omitted, it states none.
  it.each([
    ['states no amount', null],
    ['has a legacy zero amount', 0],
  ])('states no quantity for an ingredient that %s', (_, quantity) => {
    const [row] = rowsFor([line({ quantity })]);

    expect(row!.input).not.toHaveProperty('quantity');
    expect(row!.display.quantity).toBeNull();
  });

  it('carries the recipe and the ingredient on every row', () => {
    const rows = rowsFor([
      line({ id: 'ing-1' }),
      line({ id: 'ing-2', item: null, unit: null, quantity: 0 }),
      line({ id: 'ing-3', isOptional: true }),
    ]);

    expect(rows.map(row => row.input.recipeContext)).toEqual([
      {
        recipeId: 'recipe-1',
        recipeIngredientId: 'ing-1',
        addedContext: AddedContext.FromRecipe,
      },
      {
        recipeId: 'recipe-1',
        recipeIngredientId: 'ing-2',
        addedContext: AddedContext.FromRecipe,
      },
    ]);
  });

  it.each(['', '   '])(
    'names a line the fallback when the ingredient name is %p',
    name => {
      const [row] = rowsFor([line({ name, item: null })]);

      expect(row!.input.item).toEqual({ itemName: UNNAMED });
      expect(row!.display.itemName).toBe(UNNAMED);
    },
  );

  it('shows the fallback name on a blank-named catalog ingredient, sent by its item', () => {
    const [row] = rowsFor([line({ name: '' })]);

    expect(row!.input.item).toEqual({ itemId: 'item-flour' });
    expect(row!.display.itemName).toBe(UNNAMED);
  });
});
