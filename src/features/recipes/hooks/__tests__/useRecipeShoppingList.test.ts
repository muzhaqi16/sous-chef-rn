import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  AddedContext,
  CreateOutcome,
  ErrorCode,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import type { InMemoryCache } from '@apollo/client';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  AddItemsToShoppingListFromRecipeDocument,
  CreateShoppingListForRecipeDocument,
} from '../useRecipeDetail.generated';
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

// `gen-id-1`, `gen-id-2`, … in the order they are minted: a batch mints one id
// per row, and a constant would fold every row onto one cache record.
let mockMinted = 0;
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => {
    mockMinted += 1;
    return `gen-id-${mockMinted}`;
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockMinted = 0;
});

/** The lists query's answer; one default list unless a test states otherwise. */
const shoppingListsMock = (
  listIds: string[] = ['sl-1'],
): MockFor<typeof GetShoppingListsLiteDocument> => ({
  request: {
    query: GetShoppingListsLiteDocument,
    variables: () => true,
  },
  result: {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: listIds.map(id => ({
          __typename: 'ShoppingListEdge',
          cursor: id,
          node: {
            __typename: 'ShoppingList',
            id,
            name: 'My List',
            isDefault: true,
            totalItems: 0,
            completedItems: 0,
            homeId: 'home-1',
            home: { __typename: 'Home', id: 'home-1', name: 'Home' },
            ownerships: [],
          },
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: listIds.length,
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
  originalText: null,
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

// Add-all reads only the recipe's ingredients, and `hasNextPage`, which marks
// a recipe over the ingredient limit.
const recipeWith = (
  ingredients: DisplayIngredient[],
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
): MaterializedRecipe =>
  ({
    id: 'recipe-1',
    ingredientsConnection: {
      __typename: 'RecipeIngredientConnection',
      edges: ingredients.map(node => ({
        __typename: 'RecipeIngredientEdge',
        node,
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage,
        endCursor: hasNextPage ? 'cursor-next' : null,
      },
      totalCount: ingredients.length,
    },
  } as Partial<MaterializedRecipe> as MaterializedRecipe);

/** Renders the hook and waits for the lists query's answer to land. */
async function renderShopping({
  operationMocks,
  cache = makeCache(),
  backendRecipe = null,
  withoutRecipeId = false,
  listIds = ['sl-1'],
}: {
  operationMocks: MockedResponse[];
  cache?: InMemoryCache;
  backendRecipe?: MaterializedRecipe | null;
  /** A recipe still loading: the screen has no id to hand the hook. */
  withoutRecipeId?: boolean;
  listIds?: string[];
}) {
  const recipeId = withoutRecipeId ? undefined : 'recipe-1';
  // The recipe is a prop, so a test can hand the hook a later read of it.
  const rendered = renderHookWithApollo(
    (recipe: MaterializedRecipe | null) =>
      useRecipeShoppingList({ recipeId, backendRecipe: recipe }),
    {
      operationMocks: [shoppingListsMock(listIds), ...operationMocks],
      cache,
      initialProps: backendRecipe,
    },
  );
  // Read off the cache, not the hook: no lists yet and no lists at all both
  // read as an empty array.
  await waitFor(() =>
    expect(
      Object.keys(cache.extract().ROOT_QUERY ?? {}).some(key =>
        key.startsWith('shoppingLists'),
      ),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(rendered.result.current.shoppingLists).toHaveLength(listIds.length),
  );
  return rendered;
}

// --- the batch add both flows send -----------------------------------------

type AddData = MockDataFor<typeof AddItemsToShoppingListFromRecipeDocument>;
type AddPayload = Extract<
  NonNullable<AddData['addItemsToShoppingList']>,
  { __typename?: 'AddItemsToShoppingListPayload' | null }
>;
type AddResult = NonNullable<NonNullable<AddPayload['results']>[number]>;

/**
 * The id the `n`th ingredient with no catalog item is added under: each mints
 * its row's id, then the id its typed name is sent under.
 */
const rowId = (n: number) => `gen-id-${2 * n - 1}`;
const typedItemId = (n: number) => `gen-id-${2 * n}`;

/** The `n`th row as the batch input carries it, for an ingredient with no catalog item. */
const sentRow = (n: number, recipeIngredientId: string) => ({
  id: rowId(n),
  item: { inline: { id: typedItemId(n), name: 'Flour' } },
  quantity: 2,
  unit: { id: 'unit-cup' },
  recipeContext: {
    recipeId: 'recipe-1',
    recipeIngredientId,
    addedContext: AddedContext.FromRecipe,
  },
});

/** One accepted entry: the line it landed on, still to buy. */
const accepted = (
  index: number,
  itemId: string,
  outcome: CreateOutcome = CreateOutcome.Created,
): AddResult => ({
  __typename: 'BatchAddShoppingListItemResult',
  index,
  success: true,
  outcome,
  failure: null,
  item: {
    __typename: 'ShoppingListItem',
    id: itemId,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    },
  },
});

/** One entry the service refused inside a batch it otherwise applied. */
const refusedEntry = (index: number): AddResult => ({
  __typename: 'BatchAddShoppingListItemResult',
  index,
  success: false,
  outcome: null,
  item: null,
  failure: {
    __typename: 'BatchElementFailure',
    code: ErrorCode.ValidationFailed,
    reason: 'Quantity must be greater than 0',
    errorId: null,
  },
});

const appliedAdd = (results: AddResult[], list?: AddPayload['shoppingList']) =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results,
        ...(list && { shoppingList: list }),
      },
    },
  });

/** No payload and no error: the offline queue took the write. */
const queuedAdd = () =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, {
    data: { addItemsToShoppingList: null },
  });

/** The whole batch refused, as a member of the result union. */
const refusedAdd = () =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'Quantity must be greater than 0',
        field: 'quantity',
      },
    },
  });

// The app's own copy for `field: 'quantity'`; the server's sentence is never shown.
const QUANTITY_COPY =
  "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.";

const cachedRow = (cache: InMemoryCache, id: string) =>
  cache.extract()[`ShoppingListItem:${id}`];

const cachedTotal = (cache: InMemoryCache) =>
  (cache.extract()['ShoppingList:sl-1'] as { totalItems: number }).totalItems;

// --- one ingredient ---------------------------------------------------------

describe('useRecipeShoppingList — handleAddSingleIngredient', () => {
  it('sends the ingredient as a batch of one, under a minted id', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping({ operationMocks: [add.mock] });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-7' }),
      );
    });

    expect(add.fired).toEqual([
      {
        input: {
          shoppingListId: 'sl-1',
          items: [sentRow(1, 'ing-7')],
        },
      },
    ]);
  });

  it('names a catalog ingredient by its item, and adds an optional one the user picked', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping({ operationMocks: [add.mock] });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({
          id: 'ing-salt',
          name: 'Salt',
          isOptional: true,
          quantity: 0,
          unit: null,
          item: {
            __typename: 'Item',
            id: 'item-salt',
            name: 'Salt',
            imageUrl: null,
          },
        }),
      );
    });

    expect(add.fired).toEqual([
      {
        input: {
          shoppingListId: 'sl-1',
          items: [
            {
              id: 'gen-id-1',
              item: { itemId: 'item-salt' },
              recipeContext: {
                recipeId: 'recipe-1',
                recipeIngredientId: 'ing-salt',
                addedContext: AddedContext.FromRecipe,
              },
            },
          ],
        },
      },
    ]);
  });

  it('writes the row into the cache when the add is queued offline', async () => {
    // `update:` only runs with a server payload, so offline the row has to be
    // written before the mutation fires, under the client-minted id the replay
    // merges onto.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [queuedAdd().mock],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-9', name: 'Flour', quantity: 2 }),
      );
    });

    expect(cachedRow(cache, rowId(1))).toEqual(
      expect.objectContaining({
        itemName: 'Flour',
        quantity: 2,
        unitName: 'cup',
        // The item the request sends the typed name under.
        item: { __ref: `Item:${typedItemId(1)}` },
      }),
    );
    expect(cachedTotal(cache)).toBe(1);
    expect(result.current.addedIngredients.has('ing-9')).toBe(true);
    expect(mockToastSuccess).toHaveBeenCalledWith('Added to "My List"');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('counts an added row ONCE in the list stats', async () => {
    // The optimistic add counts the row; the reconcile only re-wires the edge.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [appliedAdd([accepted(0, rowId(1))]).mock],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-11' }),
      );
    });

    expect(result.current.addedIngredients.has('ing-11')).toBe(true);
    expect(cachedRow(cache, rowId(1))).toBeDefined();
    expect(cachedTotal(cache)).toBe(1);
  });

  it('withdraws the optimistic row and its count when the server merges it', async () => {
    // A merge answers with the EXISTING line's id: the optimistic line never
    // became a row of its own, so its count goes back with it.
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        appliedAdd([accepted(0, 'sli-server', CreateOutcome.Merged)]).mock,
      ],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-12' }),
      );
    });

    expect(result.current.addedIngredients.has('ing-12')).toBe(true);
    expect(cachedRow(cache, rowId(1))).toBeUndefined();
    expect(cachedRow(cache, 'sli-server')).toBeDefined();
    expect(cachedTotal(cache)).toBe(0);
  });

  it('takes the row back and says why when the add is refused as data', async () => {
    const cache = makeCache();
    const add = refusedAdd();
    const { result } = await renderShopping({
      operationMocks: [add.mock],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(add.fired).toHaveLength(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(QUANTITY_COPY);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
    expect(cachedRow(cache, rowId(1))).toBeUndefined();
    expect(cachedTotal(cache)).toBe(0);
  });

  // The batch applied; its one entry did not.
  it('takes back the row of an entry the service refused', async () => {
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [appliedAdd([refusedEntry(0)]).mock],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(cachedRow(cache, rowId(1))).toBeUndefined();
    expect(cachedTotal(cache)).toBe(0);
  });

  it('does not call an entry the service refused added', async () => {
    const { result } = await renderShopping({
      operationMocks: [appliedAdd([refusedEntry(0)]).mock],
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('says so once, in the app’s own words, on a transport error', async () => {
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        recordMock(AddItemsToShoppingListFromRecipeDocument, {
          error: new Error('network down'),
        }).mock,
      ],
      cache,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to add ingredient to shopping list.',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
    expect(cachedRow(cache, rowId(1))).toBeUndefined();
  });

  it('asks for a list first when there is none to add to', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping({
      operationMocks: [add.mock],
      listIds: [],
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Please create a shopping list first.',
    );
    expect(add.fired).toEqual([]);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('sends nothing for a recipe that has no id yet', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping({
      operationMocks: [add.mock],
      withoutRecipeId: true,
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(ingredient());
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'No ingredients available to add.',
    );
    expect(add.fired).toEqual([]);
    expect(result.current.addedIngredients.size).toBe(0);
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

const LINES = gql`
  fragment RecipeAddLines on ShoppingList {
    id
    active: itemsConnection(filters: { isPurchased: false }) {
      totalCount
      edges {
        cursor
        node {
          id
          purchaseInfo {
            isPurchased
          }
        }
      }
    }
    bought: itemsConnection(filters: { isPurchased: true }) {
      totalCount
      edges {
        cursor
        node {
          id
          purchaseInfo {
            isPurchased
          }
        }
      }
    }
  }
`;

/** A list already holding one line to buy and one bought. */
function seedListedLines(cache: InMemoryCache) {
  const lines = (ids: string[], isPurchased: boolean) => ({
    __typename: 'ShoppingListItemConnection',
    totalCount: ids.length,
    edges: ids.map(id => ({
      __typename: 'ShoppingListItemEdge',
      cursor: id,
      node: {
        __typename: 'ShoppingListItem',
        id,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased,
        },
      },
    })),
  });
  cache.writeFragment({
    id: 'ShoppingList:sl-1',
    fragment: LINES,
    data: {
      __typename: 'ShoppingList',
      id: 'sl-1',
      active: lines(['sli-live'], false),
      bought: lines(['sli-bought'], true),
    },
  });
}

const listedIds = (cache: InMemoryCache) => {
  const held = cache.readFragment<{
    active: { edges: { node: { id: string } }[] };
    bought: { edges: { node: { id: string } }[] };
  }>({ id: 'ShoppingList:sl-1', fragment: LINES });
  return {
    active: held?.active.edges.map(edge => edge.node.id).sort(),
    bought: held?.bought.edges.map(edge => edge.node.id).sort(),
  };
};

describe('useRecipeShoppingList — Add All', () => {
  it('sends every ingredient but an optional one, each under its own minted id', async () => {
    const addAll = queuedAdd();
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
    expect(addAll.fired).toEqual([
      {
        input: {
          shoppingListId: 'sl-1',
          items: [sentRow(1, 'ing-1'), sentRow(2, 'ing-3')],
        },
      },
    ]);
    expect([...result.current.addedIngredients]).toEqual(['ing-1', 'ing-3']);
  });

  it('reports a line the list already showed as updated, beside the ones it added', async () => {
    const cache = makeCache();
    seedListedLines(cache);
    const { result } = await renderShopping({
      operationMocks: [
        appliedAdd([
          accepted(0, rowId(1)),
          accepted(1, 'sli-live', CreateOutcome.Merged),
          accepted(2, rowId(3)),
        ]).mock,
      ],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
        ingredient({ id: 'ing-3' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Added 2 items to "My List", updated 1',
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect([...result.current.addedIngredients]).toEqual([
      'ing-1',
      'ing-2',
      'ing-3',
    ]);
  });

  /** One created, one merged onto a listed line, one onto a bought line. */
  const mixedOutcomes = () =>
    appliedAdd([
      accepted(0, rowId(1)),
      accepted(1, 'sli-live', CreateOutcome.Merged),
      accepted(2, 'sli-bought', CreateOutcome.Merged),
    ]);
  const threeIngredients = () =>
    recipeWith([
      ingredient({ id: 'ing-1' }),
      ingredient({ id: 'ing-2' }),
      ingredient({ id: 'ing-3' }),
    ]);

  it('folds each merged row onto the line the server names', async () => {
    const cache = makeCache();
    seedListedLines(cache);
    const { result } = await renderShopping({
      operationMocks: [mixedOutcomes().mock],
      cache,
      backendRecipe: threeIngredients(),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    // The two merged rows never came to exist under their minted ids.
    expect(cachedRow(cache, rowId(1))).toBeDefined();
    expect(cachedRow(cache, rowId(2))).toBeUndefined();
    expect(cachedRow(cache, rowId(3))).toBeUndefined();
    // The bought line the server reused is back among the lines to buy.
    expect(listedIds(cache)).toEqual({
      active: [rowId(1), 'sli-bought', 'sli-live'],
      bought: [],
    });
  });

  it('counts a reused bought line as added, and a line still on the list as updated', async () => {
    // The server answers MERGED for both, each line now to buy: a bought line
    // it reuses reappears on the list, so only the line the list already
    // showed took an update.
    const cache = makeCache();
    seedListedLines(cache);
    const { result } = await renderShopping({
      operationMocks: [mixedOutcomes().mock],
      cache,
      backendRecipe: threeIngredients(),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Added 2 items to "My List", updated 1',
    );
  });

  it('reports the plain count when nothing the list showed was updated', async () => {
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        appliedAdd([accepted(0, rowId(1)), accepted(1, rowId(2))]).mock,
      ],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Added 2 items to "My List"',
      ),
    );
    expect(cachedTotal(cache)).toBe(2);
  });

  it("takes the list's count from the response, once", async () => {
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [
        appliedAdd([accepted(0, rowId(1)), accepted(1, rowId(2))], {
          __typename: 'ShoppingList',
          id: 'sl-1',
          totalItems: 7,
        }).mock,
      ],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(cachedTotal(cache)).toBe(7);
  });

  it('keeps every row and counts the rows sent when the add is queued', async () => {
    const cache = makeCache();
    const addAll = queuedAdd();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1', name: 'Flour' }),
        ingredient({ id: 'ing-2', name: 'Sugar' }),
        ingredient({ id: 'ing-3', name: 'Butter' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    // No response to count: every row sent replays on reconnect.
    expect(mockToastSuccess).toHaveBeenCalledWith('Added 3 items to "My List"');
    expect(mockToastError).not.toHaveBeenCalled();
    expect(
      [1, 2, 3].map(
        n => (cachedRow(cache, rowId(n)) as { itemName: string }).itemName,
      ),
    ).toEqual(['Flour', 'Sugar', 'Butter']);
    expect(cachedTotal(cache)).toBe(3);
    expect([...result.current.addedIngredients]).toEqual([
      'ing-1',
      'ing-2',
      'ing-3',
    ]);
  });

  it('sends a recipe of 51 ingredients read whole as two requests, 50 and 1', async () => {
    const itemsOf = (vars: Record<string, unknown>) =>
      inputOf(vars).items as { id: string }[];
    // Each request is answered for the rows IT carried, so the toast's count
    // is the two answers added together.
    const answered = (vars: Record<string, unknown>): AddData => ({
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: itemsOf(vars).map((row, index) => accepted(index, row.id)),
      },
    });
    const addAll = recordMock(AddItemsToShoppingListFromRecipeDocument, {
      dataFor: answered,
    });
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith(
        Array.from({ length: 51 }, (_, index) =>
          ingredient({ id: `ing-${index + 1}` }),
        ),
      ),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(addAll.fired.map(vars => itemsOf(vars).length)).toEqual([50, 1]);
    expect(itemsOf(addAll.fired[0]!)[0]!.id).toBe(rowId(1));
    expect(itemsOf(addAll.fired[0]!)[49]!.id).toBe(rowId(50));
    expect(itemsOf(addAll.fired[1]!)).toEqual([sentRow(51, 'ing-51')]);
    expect(addAll.fired.map(vars => inputOf(vars).shoppingListId)).toEqual([
      'sl-1',
      'sl-1',
    ]);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Added 51 items to "My List"',
    );
    expect(cachedTotal(cache)).toBe(51);
    expect(result.current.addedIngredients.size).toBe(51);
  });

  // The device holds one page of a recipe over the limit, and the rows are
  // derived on the device: that page alone would add a short list.
  it('sends nothing for a recipe over the ingredient limit, and says why', async () => {
    const addAll = queuedAdd();
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith(
        [ingredient({ id: 'ing-1' }), ingredient({ id: 'ing-2' })],
        { hasNextPage: true },
      ),
    });

    await addAllTo(result);

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      "This recipe has more than 100 ingredients, so it can't be added or copied in full.",
    );
    // Refused before the picker: no list is picked or created for nothing.
    expect(result.current.listPickerVisible).toBe(false);
    expect(addAll.fired).toHaveLength(0);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
    expect(cachedRow(cache, rowId(1))).toBeUndefined();
    expect(cachedTotal(cache)).toBe(0);
  });

  it('sends nothing when a refresh finds the recipe over the limit while the picker is open', async () => {
    const addAll = queuedAdd();
    const ingredients = [
      ingredient({ id: 'ing-1' }),
      ingredient({ id: 'ing-2' }),
    ];
    const { result, rerender } = await renderShopping({
      operationMocks: [addAll.mock],
      backendRecipe: recipeWith(ingredients),
    });

    act(() => {
      result.current.handleAddAll();
    });
    expect(result.current.listPickerVisible).toBe(true);
    // The recipe grew past the limit elsewhere, and a refresh restated its
    // one page.
    rerender(recipeWith(ingredients, { hasNextPage: true }));
    await act(async () => {
      result.current.handleListSelected('sl-1');
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(addAll.fired).toHaveLength(0);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('adds one ingredient of a recipe over the ingredient limit', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping({
      operationMocks: [add.mock],
      backendRecipe: recipeWith([ingredient({ id: 'ing-1' })], {
        hasNextPage: true,
      }),
    });

    await act(async () => {
      await result.current.handleAddSingleIngredient(
        ingredient({ id: 'ing-1' }),
      );
    });

    expect(add.fired).toEqual([
      {
        input: {
          shoppingListId: 'sl-1',
          items: [sentRow(1, 'ing-1')],
        },
      },
    ]);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('marks the rows of the request that landed when the next one is refused', async () => {
    const itemsOf = (vars: Record<string, unknown>) =>
      inputOf(vars).items as { id: string }[];
    // The first 50 rows are accepted; the request carrying the 51st is refused
    // whole, as a member of the result union.
    const answered = (vars: Record<string, unknown>): AddData =>
      itemsOf(vars).length === 50
        ? {
            addItemsToShoppingList: {
              __typename: 'AddItemsToShoppingListPayload',
              results: itemsOf(vars).map((row, index) =>
                accepted(index, row.id),
              ),
            },
          }
        : {
            addItemsToShoppingList: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'Quantity must be greater than 0',
              field: 'quantity',
            },
          };
    const addAll = recordMock(AddItemsToShoppingListFromRecipeDocument, {
      dataFor: answered,
    });
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      cache,
      backendRecipe: recipeWith(
        Array.from({ length: 51 }, (_, index) =>
          ingredient({ id: `ing-${index + 1}` }),
        ),
      ),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError).toHaveBeenCalledWith(QUANTITY_COPY);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // The 50 that landed are on the list and marked; the refused one is neither.
    expect(cachedTotal(cache)).toBe(50);
    expect(cachedRow(cache, rowId(51))).toBeUndefined();
    expect(result.current.addedIngredients.size).toBe(50);
    expect(result.current.addedIngredients.has('ing-51')).toBe(false);
  });

  /** A batch the service applied in part: its second entry was refused. */
  const renderPartlyRefused = (cache?: InMemoryCache) =>
    renderShopping({
      operationMocks: [
        appliedAdd([accepted(0, rowId(1)), refusedEntry(1)]).mock,
      ],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
      ]),
    });

  it('leaves an entry the service refused out of the count and the list', async () => {
    const cache = makeCache();
    const { result } = await renderPartlyRefused(cache);

    await addAllTo(result);

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Added 1 items to "My List"',
      ),
    );
    expect(cachedRow(cache, rowId(1))).toBeDefined();
    expect(cachedRow(cache, rowId(2))).toBeUndefined();
    expect(cachedTotal(cache)).toBe(1);
  });

  it('leaves an entry the service refused unmarked, so it can be added on its own', async () => {
    const { result } = await renderPartlyRefused();

    await addAllTo(result);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect([...result.current.addedIngredients]).toEqual(['ing-1']);
  });

  it('reports a refused add as a failure, takes its rows back and marks nothing', async () => {
    const cache = makeCache();
    const { result } = await renderShopping({
      operationMocks: [refusedAdd().mock],
      cache,
      backendRecipe: recipeWith([
        ingredient({ id: 'ing-1' }),
        ingredient({ id: 'ing-2' }),
      ]),
    });

    await addAllTo(result);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError).toHaveBeenCalledWith(QUANTITY_COPY);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.addedIngredients.size).toBe(0);
    expect(cachedRow(cache, rowId(1))).toBeUndefined();
    expect(cachedRow(cache, rowId(2))).toBeUndefined();
    expect(cachedTotal(cache)).toBe(0);
  });

  it('adds nothing while there is no recipe yet', async () => {
    const addAll = queuedAdd();
    const { result } = await renderShopping({ operationMocks: [addAll.mock] });

    await addAllTo(result);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError).toHaveBeenCalledWith(
      'No ingredients available to add.',
    );
    expect(addAll.fired).toHaveLength(0);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('adds nothing for a recipe whose every ingredient is optional', async () => {
    const addAll = queuedAdd();
    const { result } = await renderShopping({
      operationMocks: [addAll.mock],
      backendRecipe: recipeWith([ingredient({ isOptional: true })]),
    });

    await addAllTo(result);

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'No ingredients available to add.',
      ),
    );
    expect(addAll.fired).toHaveLength(0);
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
