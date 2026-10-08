import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { CreateOutcome, ErrorCode } from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import type { InMemoryCache } from '@apollo/client';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  CreateShoppingListItemFromRecipeIngredientDocument,
  CreateShoppingListItemsFromRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { CreateShoppingListForRecipeDocument } from '../useRecipeDetail.generated';
import type { DisplayIngredient, MaterializedRecipe } from '../useRecipeData';
import { useRecipeShoppingList } from '../useRecipeShoppingList';

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ setSelectedShoppingListId: jest.fn() }),
  useSelectedShoppingListId: jest.fn(() => undefined),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'gen-id-1'),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/** One complete default list so `getTargetShoppingList()` resolves a target. */
const shoppingListsMock = (): MockFor<typeof GetShoppingListsLiteDocument> => ({
  request: {
    query: GetShoppingListsLiteDocument,
    variables: () => true,
  },
  result: {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: [
          {
            __typename: 'ShoppingListEdge',
            cursor: 'c1',
            node: {
              __typename: 'ShoppingList',
              id: 'sl-1',
              name: 'My List',
              isDefault: true,
              totalItems: 0,
              completedItems: 0,
              homeId: 'home-1',
              home: { __typename: 'Home', id: 'home-1', name: 'Home' },
              ownerships: [],
            },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: 1,
      },
    },
  },
});

const ingredient = (
  overrides: Partial<DisplayIngredient> = {},
): DisplayIngredient => ({
  __typename: 'RecipeIngredient',
  id: 'ing-1',
  name: 'Flour',
  quantity: 2,
  estimatedPrice: null,
  item: null,
  unit: { __typename: 'Unit', id: 'unit-cup', name: 'cup', symbol: 'cup' },
  convertedQuantity: null,
  image: null,
  isOptional: false,
  notes: null,
  preparation: null,
  sortOrder: 0,
  section: null,
  ...overrides,
});

// Add-all reads only the recipe's ingredients.
const recipeWith = (ingredients: DisplayIngredient[]): MaterializedRecipe =>
  ({
    id: 'recipe-1',
    ingredientsConnection: {
      __typename: 'RecipeIngredientConnection',
      edges: ingredients.map(node => ({
        __typename: 'RecipeIngredientEdge',
        node,
      })),
    },
  } as Partial<MaterializedRecipe> as MaterializedRecipe);

/** Renders the hook and waits for the target list to load. */
async function renderShopping({
  operationMocks,
  cache,
  backendRecipe = null,
}: {
  operationMocks: MockedResponse[];
  cache?: InMemoryCache;
  backendRecipe?: MaterializedRecipe | null;
}) {
  const rendered = renderHookWithApollo(
    () => useRecipeShoppingList({ recipeId: 'recipe-1', backendRecipe }),
    { operationMocks: [shoppingListsMock(), ...operationMocks], cache },
  );
  await waitFor(() =>
    expect(rendered.result.current.shoppingLists).toHaveLength(1),
  );
  return rendered;
}

// --- one ingredient ---------------------------------------------------------

const addIngredientMock = (
  member:
    | { kind: 'error-union' }
    | { kind: 'queued' }
    | { kind: 'transport' }
    | { kind: 'success'; itemId: string },
): MockFor<typeof CreateShoppingListItemFromRecipeIngredientDocument> => {
  const request = {
    query: CreateShoppingListItemFromRecipeIngredientDocument,
    variables: () => true,
  };
  if (member.kind === 'transport') {
    return { request, error: new Error('network down') };
  }
  return {
    request,
    result: {
      data: {
        createShoppingListItemFromRecipeIngredient:
          member.kind === 'error-union'
            ? {
                __typename: 'ValidationError',
                code: ErrorCode.ValidationFailed,
                message: 'bad',
              }
            : member.kind === 'queued'
            ? // No payload and no error: the offline queue took it.
              null
            : {
                __typename: 'CreateShoppingListItemFromRecipeIngredientPayload',
                shoppingListItem: {
                  __typename: 'ShoppingListItem',
                  id: member.itemId,
                },
              },
      },
    },
  };
};

describe('useRecipeShoppingList — handleAddSingleIngredient', () => {
  it('adds the recipe ingredient itself to the target list', async () => {
    const add = recordMock(CreateShoppingListItemFromRecipeIngredientDocument, {
      data: { createShoppingListItemFromRecipeIngredient: null },
    });
    const { result } = await renderShopping({ operationMocks: [add.mock] });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-7' }),
      );
    });

    expect(add.fired).toEqual([
      {
        input: {
          id: 'gen-id-1',
          recipeIngredientId: 'ing-7',
          shoppingListId: 'sl-1',
        },
      },
    ]);
  });

  it('does not toast success or mark added on a resolved error-union payload', async () => {
    const { result } = await renderShopping({
      operationMocks: [addIngredientMock({ kind: 'error-union' })],
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('says so once, in the app’s own words, on a transport error', async () => {
    const { result } = await renderShopping({
      operationMocks: [addIngredientMock({ kind: 'transport' })],
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining('network down'),
    );
  });

  it('treats an offline-queued result (null payload, no error) as success', async () => {
    const { result } = await renderShopping({
      operationMocks: [addIngredientMock({ kind: 'queued' })],
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-9' }),
      );
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has('ing-9')).toBe(true),
    );
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('writes the row into the cache when the create is queued offline', async () => {
    // `update:` only runs with a server payload, so offline the row has to be
    // written before the mutation fires, under the client-minted id the replay
    // merges onto.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [addIngredientMock({ kind: 'queued' })],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-9', name: 'Flour', quantity: 2 }),
      );
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has('ing-9')).toBe(true),
    );
    expect(cache.extract()['ShoppingListItem:gen-id-1']).toEqual(
      expect.objectContaining({ itemName: 'Flour', quantity: 2 }),
    );
  });

  it('counts an added row ONCE in the list stats', async () => {
    // The optimistic add counts the row; the reconcile only re-wires the edge.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        addIngredientMock({ kind: 'success', itemId: 'gen-id-1' }),
      ],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-11' }),
      );
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has('ing-11')).toBe(true),
    );
    const list = cache.extract()['ShoppingList:sl-1'] as {
      totalItems: number;
    };
    expect(list.totalItems).toBe(1);
  });

  it('withdraws the optimistic row and its count when the server merges it', async () => {
    // A merge answers with the EXISTING line's id: the optimistic line never
    // became a row of its own, so its count goes back with it.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        addIngredientMock({ kind: 'success', itemId: 'sli-server' }),
      ],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-12' }),
      );
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has('ing-12')).toBe(true),
    );
    const extracted = cache.extract();
    expect(extracted).not.toHaveProperty('ShoppingListItem:gen-id-1');
    expect(
      (extracted['ShoppingList:sl-1'] as { totalItems: number }).totalItems,
    ).toBe(0);
  });
});

// --- "Add All" ----------------------------------------------------------------

async function addAllTo(result: {
  current: ReturnType<typeof useRecipeShoppingList>;
}) {
  act(() => {
    result.current.handleAddAll();
  });
  await act(async () => {
    result.current.handleListSelected('sl-1');
  });
}

describe('useRecipeShoppingList — Add All', () => {
  it('adds the whole recipe and marks the lines it added, not an optional one it skipped', async () => {
    // The server leaves an optional line ("salt to taste") off the list, and a
    // line it could not add stays unmarked so it can be added on its own.
    const addAll = recordMock(CreateShoppingListItemsFromRecipeDocument, {
      data: {
        createShoppingListItemsFromRecipe: {
          __typename: 'CreateShoppingListItemsFromRecipePayload',
          results: [
            {
              __typename: 'RecipeIngredientAddResult',
              success: true,
              recipeIngredient: { __typename: 'RecipeIngredient', id: 'ing-1' },
              item: { __typename: 'ShoppingListItem', id: 'sli-1' },
            },
            {
              __typename: 'RecipeIngredientAddResult',
              success: false,
              outcome: null,
              recipeIngredient: { __typename: 'RecipeIngredient', id: 'ing-3' },
              item: null,
            },
          ],
        },
      },
    });
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2', isOptional: true }),
        ingredient({ id: 'ing-3' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect([...result.current.addedIngredients]).toEqual(['ing-1']);
    // No `servings`: the whole recipe is the default.
    expect(addAll.fired).toEqual([
      { input: { recipeId: 'recipe-1', shoppingListId: 'sl-1' } },
    ]);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("takes the list's count from the response, once", async () => {
    const addAll = recordMock(CreateShoppingListItemsFromRecipeDocument, {
      data: {
        createShoppingListItemsFromRecipe: {
          __typename: 'CreateShoppingListItemsFromRecipePayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'sl-1',
            totalItems: 7,
          },
          results: [
            {
              __typename: 'RecipeIngredientAddResult',
              success: true,
              item: { __typename: 'ShoppingListItem', id: 'sli-a' },
            },
            {
              __typename: 'RecipeIngredientAddResult',
              success: true,
              item: { __typename: 'ShoppingListItem', id: 'sli-b' },
            },
          ],
        },
      },
    });
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    const list = cache.extract()['ShoppingList:sl-1'] as { totalItems: number };
    expect(list.totalItems).toBe(7);
  });

  it('counts a reused bought line as added, and a line still on the list as updated', async () => {
    // The server answers MERGED for both: a bought line it reuses reappears on
    // the list, so only the line the list already showed took an update.
    const cache = makeCache();
    const lines = (ids: string[]) => ({
      __typename: 'ShoppingListItemConnection',
      totalCount: ids.length,
      edges: ids.map(id => ({
        __typename: 'ShoppingListItemEdge',
        cursor: id,
        node: { __typename: 'ShoppingListItem', id },
      })),
    });
    cache.writeFragment({
      id: 'ShoppingList:sl-1',
      fragment: gql`
        fragment SeedLines on ShoppingList {
          id
          active: itemsConnection(filters: { isPurchased: false }) {
            totalCount
            edges {
              cursor
              node {
                id
              }
            }
          }
          bought: itemsConnection(filters: { isPurchased: true }) {
            totalCount
            edges {
              cursor
              node {
                id
              }
            }
          }
        }
      `,
      data: {
        __typename: 'ShoppingList',
        id: 'sl-1',
        active: lines(['sli-live']),
        bought: lines(['sli-bought']),
      },
    });
    const addAll = recordMock(CreateShoppingListItemsFromRecipeDocument, {
      data: {
        createShoppingListItemsFromRecipe: {
          __typename: 'CreateShoppingListItemsFromRecipePayload',
          results: [
            {
              __typename: 'RecipeIngredientAddResult',
              outcome: CreateOutcome.Created,
              item: { __typename: 'ShoppingListItem', id: 'sli-new' },
            },
            {
              __typename: 'RecipeIngredientAddResult',
              outcome: CreateOutcome.Merged,
              item: { __typename: 'ShoppingListItem', id: 'sli-live' },
            },
            {
              __typename: 'RecipeIngredientAddResult',
              outcome: CreateOutcome.Merged,
              item: { __typename: 'ShoppingListItem', id: 'sli-bought' },
            },
          ],
        },
      },
    });
    const { result: hook } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
        ingredient({ id: 'ing-3' }),
      ]),
    });

    await addAllTo(hook);

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Added 2 items to "My List", updated 1',
      ),
    );
    const seeded = cache.readFragment<{
      active: { edges: { node: { id: string } }[] };
      bought: { edges: { node: { id: string } }[] };
    }>({
      id: 'ShoppingList:sl-1',
      fragment: gql`
        fragment ReadLines on ShoppingList {
          active: itemsConnection(filters: { isPurchased: false }) {
            edges {
              node {
                id
              }
            }
          }
          bought: itemsConnection(filters: { isPurchased: true }) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
    });
    expect(seeded?.bought.edges).toEqual([]);
    expect(seeded?.active.edges.map(edge => edge.node.id).sort()).toEqual([
      'sli-bought',
      'sli-live',
      'sli-new',
    ]);
  });

  it('reports a refused add as a failure and marks nothing', async () => {
    const refused: MockFor<typeof CreateShoppingListItemsFromRecipeDocument> = {
      request: {
        query: CreateShoppingListItemsFromRecipeDocument,
        variables: () => true,
      },
      result: {
        data: {
          createShoppingListItemsFromRecipe: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'bad',
          },
        },
      },
    };
    const { result } = await renderShopping({
      operationMocks: [refused],
      backendRecipe: recipeWith([ingredient({ id: 'ing-1' })]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('adds nothing while there is no recipe yet', async () => {
    const addAll = recordMock(CreateShoppingListItemsFromRecipeDocument);
    const { result } = await renderShopping({ operationMocks: [addAll.mock] });

    await addAllTo(result);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(addAll.fired).toHaveLength(0);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

// --- creating a list from the picker ----------------------------------------

describe('useRecipeShoppingList — handleCreateListAndAddIngredients', () => {
  const LISTS_QUERY = gql`
    query TestRecipeShoppingLists($homeId: ID, $filters: ShoppingListFilters) {
      shoppingLists(homeId: $homeId, filters: $filters) {
        totalCount
        edges {
          cursor
          node {
            id
          }
        }
      }
    }
  `;
  type Variant = { homeId?: string | null; filters?: { isTemplate: boolean } };
  const seed = (cache: InMemoryCache, variables: Variant) =>
    cache.writeQuery({
      query: LISTS_QUERY,
      variables,
      data: {
        shoppingLists: {
          __typename: 'ShoppingListConnection',
          totalCount: 0,
          edges: [],
        },
      },
    });
  const readIds = (cache: InMemoryCache, variables: Variant) =>
    cache
      .readQuery<{
        shoppingLists: { edges: Array<{ node: { id: string } }> };
      }>({ query: LISTS_QUERY, variables })
      ?.shoppingLists.edges.map(edge => edge.node.id);

  const createListMock: MockFor<typeof CreateShoppingListForRecipeDocument> = {
    request: {
      query: CreateShoppingListForRecipeDocument,
      variables: () => true,
    },
    result: {
      data: {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'sl-new',
            name: 'Dinner',
            homeId: 'home-a',
            home: { __typename: 'Home', id: 'home-a', name: 'Home A' },
            ownerships: [],
          },
        },
      },
    },
  };

  it("adds the new list to its own home's and the unscoped variants only", async () => {
    const cache = makeCache();
    const variants: Variant[] = [
      { homeId: 'home-a' },
      { homeId: 'home-b' },
      { homeId: null },
      { filters: { isTemplate: true } },
    ];
    variants.forEach(variables => seed(cache, variables));
    const { result } = await renderShopping({
      operationMocks: [createListMock],
      cache,
    });

    await act(async () => {
      result.current.handleCreateListAndAddIngredients('Dinner');
    });

    await waitFor(() =>
      expect(readIds(cache, { homeId: 'home-a' })).toEqual(['sl-new']),
    );
    expect(readIds(cache, { homeId: null })).toEqual(['sl-new']);
    expect(readIds(cache, { homeId: 'home-b' })).toEqual([]);
    expect(readIds(cache, { filters: { isTemplate: true } })).toEqual([]);
  });
});
