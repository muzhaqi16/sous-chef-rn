import { act, waitFor } from '@testing-library/react-native';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import { InMemoryCache } from '@apollo/client';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { CreateShoppingListItemFromRecipeIngredientDocument } from '#features/recipes/graphql/recipe.generated';
import {
  AddItemsToShoppingListFromRecipeDocument,
  GetShoppingListsLiteForRecipeDocument,
} from '../useRecipeDetail.generated';
import type { RecipeIngredient as ExternalRecipeIngredient } from '#/services/spoonacular/types';
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
const shoppingListsMock = (): MockedResponse => ({
  request: {
    query: GetShoppingListsLiteForRecipeDocument,
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

const externalIngredient = (
  overrides: Partial<ExternalRecipeIngredient> = {},
): ExternalRecipeIngredient => ({
  id: 1,
  aisle: 'Baking',
  image: 'flour.png',
  consistency: 'solid',
  name: 'Flour',
  nameClean: 'flour',
  original: '2 cups flour',
  originalName: 'flour',
  amount: 2,
  unit: 'cup',
  meta: [],
  measures: {
    us: { amount: 2, unitShort: 'cup', unitLong: 'cups' },
    metric: { amount: 250, unitShort: 'g', unitLong: 'grams' },
  },
  ...overrides,
});

/** Renders the hook against `externalRecipe` and waits for the list to load. */
async function renderForSingleAdd({
  isBackendRecipe,
  operationMocks,
  cache,
}: {
  isBackendRecipe: boolean;
  operationMocks: MockedResponse[];
  cache?: InMemoryCache;
}) {
  const rendered = renderHookWithApollo(
    () =>
      useRecipeShoppingList({
        recipeId: 'recipe-1',
        isBackendRecipe,
        backendRecipe: null,
        externalRecipe: null,
      }),
    { operationMocks: [shoppingListsMock(), ...operationMocks], cache },
  );
  await waitFor(() =>
    expect(rendered.result.current.shoppingLists).toHaveLength(1),
  );
  return rendered;
}

// --- external (Spoonacular) single-ingredient branch ------------------------

const addItemsMock = (
  member: { kind: 'success' } | { kind: 'error-union' } | { kind: 'transport' },
): MockedResponse => {
  if (member.kind === 'transport') {
    return {
      request: {
        query: AddItemsToShoppingListFromRecipeDocument,
        variables: () => true,
      },
      error: new Error('network down'),
    };
  }
  return {
    request: {
      query: AddItemsToShoppingListFromRecipeDocument,
      variables: () => true,
    },
    result: {
      data: {
        addItemsToShoppingList:
          member.kind === 'success'
            ? {
                __typename: 'AddItemsToShoppingListPayload',
                results: [],
                summary: {
                  __typename: 'BatchOperationSummary',
                  succeeded: 1,
                  failed: 0,
                  skipped: 0,
                },
              }
            : {
                __typename: 'ValidationError',
                code: ErrorCode.ValidationFailed,
                message: 'bad',
              },
      },
    },
  };
};

describe('useRecipeShoppingList — handleAddSingleIngredient (external branch)', () => {
  it('does not toast success or mark added on a resolved error-union payload', async () => {
    const { result } = await renderForSingleAdd({
      isBackendRecipe: false,
      operationMocks: [addItemsMock({ kind: 'error-union' })],
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient());
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('does not toast success or mark added on a transport error', async () => {
    const { result } = await renderForSingleAdd({
      isBackendRecipe: false,
      operationMocks: [addItemsMock({ kind: 'transport' })],
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient());
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('toasts success and marks the ingredient added on a success payload', async () => {
    const { result } = await renderForSingleAdd({
      isBackendRecipe: false,
      operationMocks: [addItemsMock({ kind: 'success' })],
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient({ id: 7 }));
    });

    // Wait on the rendered state, not on the toast mock: the toast is called
    // synchronously right after setAddedIngredients, so it can be observed a
    // render before `result.current` reflects the new set.
    await waitFor(() =>
      expect(result.current.addedIngredients.has(7)).toBe(true),
    );
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('writes the row into the cache when the create is queued offline', async () => {
    // The `update:` callback only runs with a server payload, so offline it
    // never fired: the recipe confirmed success and marked its checkmark while
    // the shopping list stayed empty until reconnect. The row is now written
    // before the mutation fires, keyed by the client-minted id so the eventual
    // replay merges onto it rather than duplicating.
    const cache = makeCache();

    const { result } = await renderForSingleAdd({
      isBackendRecipe: true,
      operationMocks: [addRecipeIngredientMock({ kind: 'queued' })],
      cache,
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient({ id: 9 }));
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has(9)).toBe(true),
    );

    expect(cache.extract()).toHaveProperty('ShoppingListItem:gen-id-1');
  });
});

// --- backend recipe-ingredient branch ---------------------------------------

const addRecipeIngredientMock = (
  member: { kind: 'error-union' } | { kind: 'queued' },
): MockedResponse => ({
  request: {
    query: CreateShoppingListItemFromRecipeIngredientDocument,
    variables: () => true,
  },
  result: {
    data: {
      createShoppingListItemFromRecipeIngredient:
        member.kind === 'error-union'
          ? {
              // `resource`/`resourceId` are selected on `NotFoundError`, not on
              // this member — a ValidationError response cannot carry them.
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'bad',
            }
          : // No payload + no error → the offline queue emits the field as null.
            null,
    },
  },
});

describe('useRecipeShoppingList — handleAddSingleIngredient (backend branch)', () => {
  it('does not toast success or mark added on a resolved error-union payload', async () => {
    const { result } = await renderForSingleAdd({
      isBackendRecipe: true,
      operationMocks: [addRecipeIngredientMock({ kind: 'error-union' })],
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient());
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('treats an offline-queued result (null payload, no error) as success', async () => {
    const { result } = await renderForSingleAdd({
      isBackendRecipe: true,
      operationMocks: [addRecipeIngredientMock({ kind: 'queued' })],
    });

    await act(async () => {
      result.current.handleAddSingleIngredient(externalIngredient({ id: 9 }));
    });

    await waitFor(() =>
      expect(result.current.addedIngredients.has(9)).toBe(true),
    );
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
