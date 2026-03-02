// NOTE: babel-plugin-react-compiler swaps the module exports in this project,
// so createOptimisticResponse functions are exported from optimisticTypes at runtime.
import {
  buildOptimisticMutationResponse,
  buildOptimisticDeleteResponse,
} from '../optimisticTypes';

describe('buildOptimisticMutationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the correct top-level structure with __typename Mutation', () => {
    const entity = { id: '1', name: 'Test' };
    const result = buildOptimisticMutationResponse(
      'updatePantryItem',
      'PantryItemPayload',
      'pantryItem',
      entity,
    );

    expect(result.__typename).toBe('Mutation');
  });

  it('creates the mutation field with correct payload typename', () => {
    const entity = { id: '1', name: 'Test' };
    const result = buildOptimisticMutationResponse(
      'updatePantryItem',
      'PantryItemPayload',
      'pantryItem',
      entity,
    );

    expect(result.updatePantryItem.__typename).toBe('PantryItemPayload');
  });

  it('sets success to true', () => {
    const result = buildOptimisticMutationResponse(
      'addItem',
      'ItemPayload',
      'item',
      { id: '1' },
    );

    expect(result.addItem.success).toBe(true);
  });

  it('sets message to empty string', () => {
    const result = buildOptimisticMutationResponse(
      'addItem',
      'ItemPayload',
      'item',
      { id: '1' },
    );

    expect(result.addItem.message).toBe('');
  });

  it('sets code to SUCCESS', () => {
    const result = buildOptimisticMutationResponse(
      'addItem',
      'ItemPayload',
      'item',
      { id: '1' },
    );

    expect(result.addItem.code).toBe('SUCCESS');
  });

  it('places the entity under the specified entity field', () => {
    const entity = { id: '42', name: 'Banana', quantity: 3 };
    const result = buildOptimisticMutationResponse(
      'createGrocery',
      'GroceryPayload',
      'grocery',
      entity,
    );

    expect(result.createGrocery.grocery).toBe(entity);
  });

  it('works with different mutation/entity field names', () => {
    const entity = { id: '1', title: 'Recipe' };
    const result = buildOptimisticMutationResponse(
      'updateRecipe',
      'RecipePayload',
      'recipe',
      entity,
    );

    expect(result.updateRecipe).toBeDefined();
    expect(result.updateRecipe.recipe).toBe(entity);
    expect(result.updateRecipe.__typename).toBe('RecipePayload');
  });

  it('preserves the full entity object reference', () => {
    const entity = {
      id: '1',
      __typename: 'ShoppingListItem',
      name: 'Eggs',
      isPurchased: false,
      version: 2,
    };

    const result = buildOptimisticMutationResponse(
      'addItemToShoppingList',
      'ShoppingListItemPayload',
      'shoppingListItem',
      entity,
    );

    expect(result.addItemToShoppingList.shoppingListItem).toBe(entity);
  });
});

describe('buildOptimisticDeleteResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the correct top-level structure with __typename Mutation', () => {
    const result = buildOptimisticDeleteResponse(
      'deletePantryItem',
      'PantryItemPayload',
      'pantryItem',
      'PantryItem',
      'item-1',
    );

    expect(result.__typename).toBe('Mutation');
  });

  it('creates the mutation field with correct payload typename', () => {
    const result = buildOptimisticDeleteResponse(
      'deletePantryItem',
      'PantryItemPayload',
      'pantryItem',
      'PantryItem',
      'item-1',
    );

    expect(result.deletePantryItem.__typename).toBe('PantryItemPayload');
  });

  it('sets success, message, and code correctly', () => {
    const result = buildOptimisticDeleteResponse(
      'removeItem',
      'ItemPayload',
      'item',
      'Item',
      'id-1',
    );

    expect(result.removeItem.success).toBe(true);
    expect(result.removeItem.message).toBe('');
    expect(result.removeItem.code).toBe('SUCCESS');
  });

  it('creates entity stub with __typename and id only', () => {
    const result = buildOptimisticDeleteResponse(
      'deletePantryItem',
      'PantryItemPayload',
      'pantryItem',
      'PantryItem',
      'item-42',
    );

    expect(result.deletePantryItem.pantryItem).toEqual({
      __typename: 'PantryItem',
      id: 'item-42',
    });
  });

  it('works with different entity type names', () => {
    const result = buildOptimisticDeleteResponse(
      'deleteRecipe',
      'RecipePayload',
      'recipe',
      'Recipe',
      'recipe-99',
    );

    expect(result.deleteRecipe.recipe).toEqual({
      __typename: 'Recipe',
      id: 'recipe-99',
    });
  });

  it('uses the correct entity field name as key', () => {
    const result = buildOptimisticDeleteResponse(
      'removeShoppingListItem',
      'ShoppingListItemPayload',
      'shoppingListItem',
      'ShoppingListItem',
      'sli-1',
    );

    expect(result.removeShoppingListItem.shoppingListItem).toBeDefined();
    expect(result.removeShoppingListItem.shoppingListItem.id).toBe('sli-1');
    expect(result.removeShoppingListItem.shoppingListItem.__typename).toBe(
      'ShoppingListItem',
    );
  });
});
