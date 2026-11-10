import { toastService } from '#/services/toastService';
import { act } from '@testing-library/react-native';
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
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  CreateShoppingListDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { RecipeMissingIngredientsDocument } from '#features/recipes/hooks/useRecipeMissingIngredients.generated';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { AddItemsToShoppingListFromRecipeDocument } from '../useRecipeShoppingList.generated';
import type { DisplayIngredient, MaterializedRecipe } from '../useRecipeData';
import { useRecipeShoppingList } from '../useRecipeShoppingList';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ setSelectedShoppingListId: jest.fn() }),
  useSelectedShoppingListId: jest.fn(() => undefined),
  useSelectedHomeId: jest.fn(() => 'home-1'),
  useUser: jest.fn(() => ({ id: 'user-1', email: 'cook@example.com' })),
}));

const mockToastSuccess = jest.mocked(toastService.success);
const mockToastError = jest.mocked(toastService.error);

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
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMinted = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const shoppingListsMock = (
  listIds: string[],
): MockFor<typeof GetShoppingListsLiteDocument> => ({
  request: { query: GetShoppingListsLiteDocument, variables: () => true },
  result: {
    data: {
      shoppingLists: {
        edges: listIds.map(id => ({
          node: { id, name: 'My List', isDefault: true, totalItems: 0 },
        })),
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
  unit: asAbbreviation({
    __typename: 'Unit',
    id: 'unit-cup',
    name: 'cup',
    symbol: 'cup',
  }),
  convertedQuantity: null,
  image: null,
  isOptional: false,
  notes: null,
  preparation: null,
  sortOrder: 0,
  section: null,
  ...overrides,
});

/** Ingredients `ing-1` … `ing-<count>`. */
const ingredients = (count: number) =>
  range(1, count).map(n => ingredient({ id: `ing-${n}` }));

// Add-all reads only the recipe's ingredients, and `hasNextPage`, which marks
// a recipe over the ingredient limit.
const recipeWith = (
  nodes: DisplayIngredient[],
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
): MaterializedRecipe =>
  ({
    id: 'recipe-1',
    ingredientsConnection: {
      __typename: 'RecipeIngredientConnection',
      edges: nodes.map(node => ({ __typename: 'RecipeIngredientEdge', node })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage,
        endCursor: hasNextPage ? 'cursor-next' : null,
      },
      totalCount: nodes.length,
    },
  } as Partial<MaterializedRecipe> as MaterializedRecipe);

type Hook = { current: ReturnType<typeof useRecipeShoppingList> };

/** Renders the hook beside `add` and waits for the lists query's answer. */
async function renderShopping(
  add: MockedResponse,
  {
    cache = makeCache(),
    recipe = null,
    withoutRecipeId = false,
    listIds = ['sl-1'],
    missing = [],
    listedItemIds = [],
  }: {
    cache?: InMemoryCache;
    /** The ingredients the server says the home's pantries lack. */
    missing?: string[];
    /** The catalog items the list's open lines name. */
    listedItemIds?: string[];
    recipe?: MaterializedRecipe | null;
    /** A recipe still loading: the screen has no id to hand the hook. */
    withoutRecipeId?: boolean;
    listIds?: string[];
  } = {},
) {
  const recipeId = withoutRecipeId ? undefined : 'recipe-1';
  // The recipe is a prop, so a test can hand the hook a later read of it.
  const rendered = renderHookWithApollo(
    (backendRecipe: MaterializedRecipe | null) =>
      useRecipeShoppingList({ recipeId, backendRecipe }),
    {
      operationMocks: [
        shoppingListsMock(listIds),
        add,
        recordMock(RecipeMissingIngredientsDocument, {
          data: {
            recipe: {
              id: 'recipe-1',
              missingIngredientsConnection: {
                edges: missing.map(id => ({ node: { id } })),
              },
            },
          },
        }).mock,
        recordMock(GetShoppingListItemsFilteredDocument, {
          data: {
            shoppingList: {
              id: 'sl-1',
              itemsConnection: {
                edges: listedItemIds.map(itemId => ({
                  node: { id: `line-${itemId}`, item: { id: itemId } },
                })),
              },
            },
          },
        }).mock,
      ],
      cache,
      initialProps: recipe,
    },
  );
  // Read off the cache, not the hook: no lists yet and no lists at all both
  // read as an empty array.
  await drainTimers();
  expect(
    Object.keys(cache.extract().ROOT_QUERY ?? {}).some(key =>
      key.startsWith('shoppingLists'),
    ),
  ).toBe(true);
  await drainTimers();
  expect(rendered.result.current.shoppingLists).toHaveLength(listIds.length);
  return { ...rendered, cache };
}

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
const sentRow = (
  n: number,
  recipeIngredientId = `ing-${n}`,
  name = 'Flour',
) => ({
  id: rowId(n),
  item: { inline: { id: typedItemId(n), name } },
  quantity: 2,
  unit: { id: 'unit-cup' },
  recipeContext: {
    recipeId: 'recipe-1',
    recipeIngredientId,
    addedContext: AddedContext.FromRecipe,
  },
});

/** The variables of one batch add to the list. */
const batchOf = (items: object[]) => ({
  input: { shoppingListId: 'sl-1', items },
});

const itemsOf = (vars: Record<string, unknown>) =>
  inputOf(vars).items as { id: string }[];

/** One accepted entry: the line it landed on, still to buy. */
const accepted = (
  index: number,
  itemId: string,
  outcome: CreateOutcome = CreateOutcome.Created,
): AddResult => ({
  index,
  success: true,
  outcome,
  failure: null,
  item: { id: itemId, purchaseInfo: { isPurchased: false } },
});

/** Every row a request carried, accepted as created. */
const acceptEach = (vars: Record<string, unknown>) =>
  itemsOf(vars).map((row, index) => accepted(index, row.id));

/** One entry the service refused inside a batch it otherwise applied. */
const refusedEntry = (index: number): AddResult => ({
  index,
  success: false,
  outcome: null,
  item: null,
  failure: { code: ErrorCode.ValidationFailed },
});

/** The list as the server states it, holding `count` rows to buy. */
const listHolding = (count: number): AddPayload['shoppingList'] => ({
  id: 'sl-1',
  totalItems: count,
  completedItems: 0,
  remainingItems: count,
  completionRate: 0,
});

/** An applied batch; by default the list holds what it added to an empty one. */
const appliedData = (
  results: AddResult[],
  list = listHolding(
    results.filter(r => r.success && r.outcome !== CreateOutcome.Merged).length,
  ),
): AddData => ({
  addItemsToShoppingList: {
    __typename: 'AddItemsToShoppingListPayload',
    results,
    shoppingList: list,
  },
});

/** The whole batch refused, as a member of the result union. */
const REFUSED: AddData = {
  addItemsToShoppingList: {
    __typename: 'ValidationError',
    code: ErrorCode.ValidationFailed,
    field: 'quantity',
  },
};

const appliedAdd = (...args: Parameters<typeof appliedData>) =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, {
    data: appliedData(...args),
  });

/** No payload and no error: the offline queue took the write. */
const queuedAdd = () =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, {
    data: { addItemsToShoppingList: null },
  });

const refusedAdd = () =>
  recordMock(AddItemsToShoppingListFromRecipeDocument, { data: REFUSED });

// The app's own copy for `field: 'quantity'`; the server's sentence is never shown.
const QUANTITY_COPY =
  "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.";
const OVER_LIMIT =
  "This recipe has more than 100 ingredients, so it can't be added or copied in full.";
const NOTHING_TO_ADD = 'No ingredients available to add.';

/** What the list shows once the writes answered have left their layers. */
const shown = (cache: InMemoryCache) => {
  pendingWritesOf(cache).rebuild();
  return cache.extract(true);
};

const cachedRow = (cache: InMemoryCache, id: string) =>
  shown(cache)[`ShoppingListItem:${id}`];

const cachedRowIds = (cache: InMemoryCache) =>
  Object.keys(shown(cache))
    .flatMap(key => /^ShoppingListItem:(.+)$/.exec(key)?.[1] ?? [])
    .sort();

const cachedTotal = (cache: InMemoryCache) =>
  (shown(cache)['ShoppingList:sl-1'] as { totalItems: number }).totalItems;

/** Every toast shown, by kind. */
const toasts = () => ({
  success: mockToastSuccess.mock.calls.flat(),
  error: mockToastError.mock.calls.flat(),
});
const succeeded = (message: string) => ({ success: [message], error: [] });
const failed = (message: string) => ({ success: [], error: [message] });

const marked = (result: Hook) => [...result.current.listedIngredients];
const missingIds = (result: Hook) => [
  ...(result.current.missingIngredients ?? []),
];

/** Adds one ingredient on its own, as its row's add button does. */
const addOne = (result: Hook, overrides: Partial<DisplayIngredient> = {}) =>
  drained(() =>
    result.current.handleAddSingleIngredient(ingredient(overrides)),
  );

/** Taps "Add All", which opens the list picker. */
const openPicker = (result: Hook) => {
  act(() => {
    result.current.handleAddAll();
  });
};

async function pickList(result: Hook) {
  await act(async () => {
    result.current.handleListSelected('sl-1');
  });
  // The add runs unawaited and marks its rows outside `act`, just before its
  // toast; it is over, with every update committed, once it stops adding.
  await drainTimers();
  expect(result.current.addingToList).toBe(false);
}

async function addAllTo(result: Hook) {
  openPicker(result);
  await pickList(result);
}

describe('useRecipeShoppingList — handleAddSingleIngredient', () => {
  it('sends the ingredient as a batch of one, and writes its row before any answer', async () => {
    const add = queuedAdd();
    const { result, cache } = await renderShopping(add.mock);

    await addOne(result, { id: 'ing-7' });

    expect(add.fired).toEqual([batchOf([sentRow(1, 'ing-7')])]);
    // `update:` only runs with a server payload, so offline the row has to be
    // written before the mutation fires, under the id the replay merges onto.
    expect(cachedRow(cache, rowId(1))).toEqual(
      expect.objectContaining({
        itemName: 'Flour',
        quantity: 2,
        unitName: 'cup',
        // The item the request sends the typed name under.
        item: { __ref: `Item:${typedItemId(1)}` },
      }),
    );
  });

  it('names a catalog ingredient by its item, and adds an optional one the user picked', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping(add.mock);

    await addOne(result, {
      id: 'ing-salt',
      name: 'Salt',
      isOptional: true,
      quantity: 0,
      unit: null,
      item: {
        __typename: 'Item',
        version: 1,
        id: 'item-salt',
        name: 'Salt',
        imageUrl: null,
      },
    });

    expect(add.fired).toEqual([
      batchOf([
        {
          id: 'gen-id-1',
          item: { itemId: 'item-salt' },
          recipeContext: {
            recipeId: 'recipe-1',
            recipeIngredientId: 'ing-salt',
            addedContext: AddedContext.FromRecipe,
          },
        },
      ]),
    ]);
  });

  const ADDED = succeeded('Added to "My List"');
  const FAILED = failed('Failed to add ingredient to shopping list.');

  it.each([
    {
      name: 'counts a row queued offline once, even from a recipe over the ingredient limit',
      add: queuedAdd,
      recipe: recipeWith(ingredients(1), { hasNextPage: true }),
      rows: [rowId(1)],
      total: 1,
      said: ADDED,
    },
    {
      // The optimistic add counts the row; the reconcile only re-wires the edge.
      name: 'counts an added row ONCE in the list stats',
      add: () => appliedAdd([accepted(0, rowId(1))]),
      rows: [rowId(1)],
      total: 1,
      said: ADDED,
    },
    {
      // A merge answers with the EXISTING line's id: the optimistic line never
      // became a row of its own, so its count goes back with it.
      name: 'withdraws the optimistic row and its count when the server merges it',
      add: () => appliedAdd([accepted(0, 'sli-server', CreateOutcome.Merged)]),
      rows: ['sli-server'],
      total: 0,
      said: ADDED,
    },
    {
      name: 'takes the row back and says why when the add is refused as data',
      add: refusedAdd,
      rows: [],
      total: 0,
      said: failed(QUANTITY_COPY),
    },
    {
      name: 'takes back the row of an entry the service refused',
      add: () => appliedAdd([refusedEntry(0)]),
      rows: [],
      total: 0,
      said: FAILED,
    },
    {
      name: 'says so once, in the app’s own words, on a transport error',
      add: () =>
        recordMock(AddItemsToShoppingListFromRecipeDocument, {
          error: new Error('network down'),
        }),
      rows: [],
      total: 0,
      said: FAILED,
    },
  ])('$name', async ({ add, recipe = null, rows, total, said }) => {
    const sent = add();
    const { result, cache } = await renderShopping(sent.mock, { recipe });

    await addOne(result);

    expect(sent.fired).toHaveLength(1);
    expect(cachedRowIds(cache)).toEqual(rows);
    expect(cachedTotal(cache)).toBe(total);
    expect(toasts()).toEqual(said);
    // Marked exactly when the add is reported.
    expect(marked(result)).toEqual(said === ADDED ? ['ing-1'] : []);
  });

  it.each([
    {
      name: 'asks for a list first when there is none to add to',
      options: { listIds: [] },
      error: 'Please create a shopping list first.',
    },
    {
      name: 'sends nothing for a recipe that has no id yet',
      options: { withoutRecipeId: true },
      error: NOTHING_TO_ADD,
    },
  ])('$name', async ({ options, error }) => {
    const add = queuedAdd();
    const { result } = await renderShopping(add.mock, options);

    await addOne(result);

    expect(add.fired).toEqual([]);
    expect(toasts()).toEqual(failed(error));
    expect(marked(result)).toEqual([]);
  });
});

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

/** A cache whose list already holds one line to buy and one bought. */
function cacheWithListedLines() {
  const cache = makeCache();
  const lines = (ids: string[], isPurchased: boolean) => ({
    __typename: 'ShoppingListItemConnection',
    totalCount: ids.length,
    edges: ids.map(id => ({
      __typename: 'ShoppingListItemEdge',
      cursor: id,
      node: {
        __typename: 'ShoppingListItem',
        version: 1,
        id,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased,
        },
      },
    })),
  });
  seedFragment(cache, {
    id: 'ShoppingList:sl-1',
    fragment: LINES,
    data: {
      __typename: 'ShoppingList',
      version: 1,
      id: 'sl-1',
      active: lines(['sli-live'], false),
      bought: lines(['sli-bought'], true),
    },
  });
  return cache;
}

const listedIds = (cache: InMemoryCache) => {
  pendingWritesOf(cache).rebuild();
  const held = cache.readFragment<{
    active: { edges: { node: { id: string } }[] };
    bought: { edges: { node: { id: string } }[] };
  }>({ id: 'ShoppingList:sl-1', fragment: LINES, optimistic: true });
  return {
    active: held?.active.edges.map(edge => edge.node.id).sort(),
    bought: held?.bought.edges.map(edge => edge.node.id).sort(),
  };
};

describe('useRecipeShoppingList — Add All', () => {
  it('queues every ingredient but an optional one under its own minted id, and counts the rows sent', async () => {
    const add = queuedAdd();
    const { result, cache } = await renderShopping(add.mock, {
      recipe: recipeWith([
        ingredient({ id: 'ing-1', name: 'Flour' }),
        ingredient({ id: 'ing-2', isOptional: true }),
        ingredient({ id: 'ing-3', name: 'Butter' }),
      ]),
    });

    await addAllTo(result);

    expect(add.fired).toEqual([
      batchOf([sentRow(1), sentRow(2, 'ing-3', 'Butter')]),
    ]);
    // No response to count: every row sent replays on reconnect.
    expect(toasts()).toEqual(succeeded('Added 2 items to "My List"'));
    expect(
      [1, 2].map(
        n => (cachedRow(cache, rowId(n)) as { itemName: string }).itemName,
      ),
    ).toEqual(['Flour', 'Butter']);
    expect(cachedTotal(cache)).toBe(2);
    expect(marked(result)).toEqual(['ing-1', 'ing-3']);
  });

  it('folds each merged row onto the line the server names, and reports only a line the list showed as updated', async () => {
    // One created, one merged onto a listed line, one onto a bought line.
    const { result, cache } = await renderShopping(
      appliedAdd([
        accepted(0, rowId(1)),
        accepted(1, 'sli-live', CreateOutcome.Merged),
        accepted(2, 'sli-bought', CreateOutcome.Merged),
      ]).mock,
      { cache: cacheWithListedLines(), recipe: recipeWith(ingredients(3)) },
    );

    await addAllTo(result);

    // The merged rows never came to exist under their minted ids, and the
    // bought line the server reused is back among the lines to buy.
    expect(cachedRowIds(cache)).toEqual([rowId(1), 'sli-bought', 'sli-live']);
    expect(listedIds(cache)).toEqual({
      active: [rowId(1), 'sli-bought', 'sli-live'],
      bought: [],
    });
    expect(toasts()).toEqual(
      succeeded('Added 2 items to "My List", updated 1'),
    );
    expect(marked(result)).toEqual(['ing-1', 'ing-2', 'ing-3']);
  });

  it.each([
    {
      name: "reports the plain count when nothing the list showed was updated, and takes the list's count from the response",
      add: () =>
        appliedAdd([accepted(0, rowId(1)), accepted(1, rowId(2))], {
          id: 'sl-1',
          totalItems: 7,
        }),
      rows: [rowId(1), rowId(2)],
      total: 7,
      said: succeeded('Added 2 items to "My List"'),
      marks: ['ing-1', 'ing-2'],
    },
    {
      // Unmarked, so it can be added on its own.
      name: 'leaves an entry the service refused out of the count and the list',
      add: () => appliedAdd([accepted(0, rowId(1)), refusedEntry(1)]),
      rows: [rowId(1)],
      total: 1,
      said: succeeded('Added 1 items to "My List"'),
      marks: ['ing-1'],
    },
    {
      name: 'reports a refused add as a failure, takes its rows back and marks nothing',
      add: refusedAdd,
      rows: [],
      total: 0,
      said: failed(QUANTITY_COPY),
      marks: [],
    },
  ])('$name', async ({ add, rows, total, said, marks }) => {
    const { result, cache } = await renderShopping(add().mock, {
      recipe: recipeWith(ingredients(2)),
    });

    await addAllTo(result);

    expect(cachedRowIds(cache)).toEqual(rows);
    expect(cachedTotal(cache)).toBe(total);
    expect(toasts()).toEqual(said);
    expect(marked(result)).toEqual(marks);
  });

  it('sends a recipe of 51 ingredients read whole as two requests, 50 and 1', async () => {
    // Each request is answered for the rows IT carried, so the toast's count
    // is the two answers added together.
    let listed = 0;
    const add = recordMock(AddItemsToShoppingListFromRecipeDocument, {
      dataFor: vars => {
        listed += itemsOf(vars).length;
        return appliedData(acceptEach(vars), listHolding(listed));
      },
    });
    const { result, cache } = await renderShopping(add.mock, {
      recipe: recipeWith(ingredients(51)),
    });

    await addAllTo(result);

    expect(add.fired).toEqual([
      batchOf(range(1, 50).map(n => sentRow(n))),
      batchOf([sentRow(51)]),
    ]);
    expect(toasts()).toEqual(succeeded('Added 51 items to "My List"'));
    expect(cachedTotal(cache)).toBe(51);
    expect(marked(result)).toHaveLength(51);
  });

  it('marks the rows of the request that landed when the next one is refused', async () => {
    // The first 50 rows are accepted; the request carrying the 51st is refused
    // whole.
    const add = recordMock(AddItemsToShoppingListFromRecipeDocument, {
      dataFor: vars =>
        itemsOf(vars).length === 50
          ? appliedData(acceptEach(vars), listHolding(50))
          : REFUSED,
    });
    const { result, cache } = await renderShopping(add.mock, {
      recipe: recipeWith(ingredients(51)),
    });

    await addAllTo(result);

    expect(toasts()).toEqual(failed(QUANTITY_COPY));
    // The 50 that landed are on the list and marked; the refused one is neither.
    expect(cachedTotal(cache)).toBe(50);
    expect(cachedRow(cache, rowId(51))).toBeUndefined();
    expect(marked(result)).toEqual(range(1, 50).map(n => `ing-${n}`));
  });

  // The device holds one page of a recipe over the limit, and the rows are
  // derived on the device: that page alone would add a short list.
  it('sends nothing for a recipe over the ingredient limit, and says why', async () => {
    const add = queuedAdd();
    const { result, cache } = await renderShopping(add.mock, {
      recipe: recipeWith(ingredients(2), { hasNextPage: true }),
    });

    openPicker(result);
    // Refused before the picker: no list is picked or created for nothing.
    expect(result.current.listPickerVisible).toBe(false);
    await pickList(result);

    expect(add.fired).toEqual([]);
    expect(toasts()).toEqual(failed(OVER_LIMIT));
    expect(marked(result)).toEqual([]);
    expect(cachedRowIds(cache)).toEqual([]);
    expect(cachedTotal(cache)).toBe(0);
  });

  it('sends nothing when a refresh finds the recipe over the limit while the picker is open', async () => {
    const add = queuedAdd();
    const { result, rerender } = await renderShopping(add.mock, {
      recipe: recipeWith(ingredients(2)),
    });

    openPicker(result);
    expect(result.current.listPickerVisible).toBe(true);
    // The recipe grew past the limit elsewhere, and a refresh restated its
    // one page.
    rerender(recipeWith(ingredients(2), { hasNextPage: true }));
    await pickList(result);

    expect(add.fired).toEqual([]);
    expect(toasts()).toEqual(failed(OVER_LIMIT));
  });

  it.each([
    { name: 'adds nothing while there is no recipe yet', recipe: null },
    {
      name: 'adds nothing for a recipe whose every ingredient is optional',
      recipe: recipeWith([ingredient({ isOptional: true })]),
    },
  ])('$name', async ({ recipe }) => {
    const add = queuedAdd();
    const { result } = await renderShopping(add.mock, { recipe });

    await addAllTo(result);

    expect(add.fired).toEqual([]);
    expect(toasts()).toEqual(failed(NOTHING_TO_ADD));
  });
});

describe('useRecipeShoppingList — Add what is missing', () => {
  it('sends only the ingredients the pantry lacks', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping(add.mock, {
      recipe: recipeWith([
        ingredient({ id: 'ing-1', name: 'Flour' }),
        ingredient({ id: 'ing-2', name: 'Eggs' }),
        ingredient({ id: 'ing-3', name: 'Butter' }),
      ]),
      missing: ['ing-1', 'ing-3'],
    });
    expect(missingIds(result)).toEqual(['ing-1', 'ing-3']);

    act(() => {
      result.current.handleAddMissing();
    });
    await pickList(result);

    expect(add.fired).toEqual([
      batchOf([sentRow(1), sentRow(2, 'ing-3', 'Butter')]),
    ]);
    expect(marked(result)).toEqual(['ing-1', 'ing-3']);
    expect(missingIds(result)).toEqual([]);
  });

  it('stops counting an ingredient once it is added on its own', async () => {
    const { result } = await renderShopping(queuedAdd().mock, {
      recipe: recipeWith([
        ingredient({ id: 'ing-1', name: 'Flour' }),
        ingredient({ id: 'ing-2', name: 'Vanilla' }),
      ]),
      missing: ['ing-2'],
    });
    expect(missingIds(result)).toEqual(['ing-2']);

    await addOne(result, { id: 'ing-2', name: 'Vanilla' });

    expect(missingIds(result)).toEqual([]);
  });

  it('counts nothing the list already holds, and sends only the rest', async () => {
    const add = queuedAdd();
    const { result } = await renderShopping(add.mock, {
      recipe: recipeWith([
        ingredient({ id: 'ing-1', name: 'Flour' }),
        ingredient({
          id: 'ing-2',
          name: 'Vanilla',
          item: {
            __typename: 'Item',
            id: 'item-vanilla',
            version: 1,
            name: 'Vanilla',
            imageUrl: null,
          },
        }),
        ingredient({ id: 'ing-3', name: 'Butter' }),
      ]),
      missing: ['ing-2', 'ing-3'],
      listedItemIds: ['item-vanilla'],
    });
    await drainTimers();

    expect(missingIds(result)).toEqual(['ing-3']);
    expect(marked(result)).toEqual(['ing-2']);

    act(() => {
      result.current.handleAddMissing();
    });
    await pickList(result);

    expect(add.fired).toEqual([batchOf([sentRow(1, 'ing-3', 'Butter')])]);
  });
});

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
  const readIds = (cache: InMemoryCache, variables: Variant) =>
    cache
      .readQuery<{
        shoppingLists: { edges: Array<{ node: { id: string } }> };
      }>({ query: LISTS_QUERY, variables })
      ?.shoppingLists.edges.map(edge => edge.node.id);

  const createListMock: MockFor<typeof CreateShoppingListDocument> = {
    request: { query: CreateShoppingListDocument, variables: () => true },
    result: variables => ({
      data: {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: {
            id: String(variables.input.id),
            homeId: 'home-a',
            home: { id: 'home-a' },
          },
        },
      },
    }),
  };

  it("adds the new list to its own home's and the unscoped variants only", async () => {
    const cache = makeCache();
    const variants: Variant[] = [
      { homeId: 'home-a' },
      { homeId: 'home-b' },
      { homeId: null },
      { filters: { isTemplate: true } },
    ];
    variants.forEach(variables =>
      seedQuery(cache, {
        query: LISTS_QUERY,
        variables,
        data: {
          shoppingLists: {
            __typename: 'ShoppingListConnection',
            totalCount: 0,
            edges: [],
          },
        },
      }),
    );
    const { result } = await renderShopping(createListMock, { cache });

    await act(async () => {
      result.current.handleCreateListAndAddIngredients('Dinner');
    });

    await drainTimers();
    expect(variants.map(variables => readIds(cache, variables))).toEqual([
      ['gen-id-1'],
      [],
      ['gen-id-1'],
      [],
    ]);
  });
});
