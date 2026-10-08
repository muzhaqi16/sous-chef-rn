'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import {
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useStore } from '#store';
import {
  AcquisitionMethod,
  CreateOutcome,
  ErrorCode,
  NetWeightKind,
  PriceSource,
  ReceiptMatchConfidence,
  ReceiptMatchMethod,
  ReceiptParser,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import { toDateKey } from '#/utils/dateUtils';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
  type ReceiptLineChoice,
} from '../../store/receiptDraftStore';
import {
  lineChoice,
  parsedReceipt,
  seedDraft,
} from '../../__tests__/helpers/receiptFixtures';
import { useReceiptReview } from '../useReceiptReview';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import {
  RecordReceiptMatchesDocument,
  ResolveReceiptLinesDocument,
} from '../useReceiptMatches.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
interface CurrentPantry {
  pantry: { id: string; name: string } | null;
  currentHome: { id: string } | null;
}
const KITCHEN: CurrentPantry = {
  pantry: { id: 'p1', name: 'Kitchen' },
  currentHome: { id: 'home-1' },
};
const mockCurrentPantry = jest.fn<CurrentPantry, []>();
jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => mockCurrentPantry(),
}));
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

globalThis.requestIdleCallback = jest.fn((cb: IdleRequestCallback) => {
  cb({ didTimeout: false, timeRemaining: () => 0 });
  return 1;
});
globalThis.cancelIdleCallback = jest.fn();

const PANTRY_VARS = { id: 'p1', itemsFirst: 100 };
const PANTRY: MockDataFor<typeof GetPantryDocument> = {
  pantry: {
    __typename: 'Pantry',
    id: 'p1',
    stats: { totalItems: 0 },
    itemsConnection: {
      totalCount: 0,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: [],
    },
  },
};

const MILK = lineChoice({ price: 2.79 });
const BANANAS = lineChoice({
  itemId: null,
  itemName: 'Bananas',
  quantity: 2.14,
  unitText: 'lb',
  price: 1.26,
});

const seedKrogerDraft = () =>
  seedDraft({
    pages: ['KROGER'],
    scannedAt: '2026-09-30T10:00:00.000Z',
    purchasedOn: '2026-09-28',
    parsed: parsedReceipt(
      [
        { rawText: 'KROGER', kind: 'other' },
        {
          rawText: 'KRO WHL MILK 3.29',
          kind: 'item',
          product: 'KRO WHL MILK',
          lineTotal: 3.29,
        },
        {
          rawText: 'SC KROGER SAVINGS 0.50-',
          kind: 'discount',
          lineTotal: -0.5,
          appliesToIndex: 1,
        },
        {
          rawText: 'BANANAS',
          kind: 'item',
          product: 'BANANAS',
          quantity: 2.14,
          unit: 'lb',
          lineTotal: 1.26,
        },
        { rawText: 'BALANCE 4.05', kind: 'total', lineTotal: 4.05 },
      ],
      'KROGER',
    ),
  });

const readPantry = (cache: ReturnType<typeof makeCache>) =>
  cache.readQuery<Unmasked<GetPantryQuery>>({
    query: GetPantryDocument,
    variables: PANTRY_VARS,
  })?.pantry;

function pantryItemNames(cache: ReturnType<typeof makeCache>) {
  return (
    readPantry(cache)?.itemsConnection.edges.map(edge => edge.node.itemName) ??
    []
  );
}

// The catalog item is created; the typed one is refused.
const createFor = (
  vars: Record<string, unknown>,
): MockDataFor<typeof CreatePantryItemDocument> => {
  const input = inputOf(vars);
  const item = isRecord(input.item) ? input.item : {};
  return item.id
    ? {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: {
            id: String(input.id),
            itemName: 'Whole milk',
            item: { id: 'cat-milk' },
          },
          pantry: { id: 'p1', stats: { totalItems: 1 } },
        },
      }
    : {
        createPantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'item',
        },
      };
};

const GRAM = {
  __typename: 'Unit',
  id: 'unit-g',
  name: 'gram',
  symbol: 'g',
  type: UnitType.Weight,
} as const;

// Milk (counted) and beef (in grams) are open on the active list; nothing has
// been bought from it yet. The API answers only the lines naming `itemIds`.
const listItems = (
  vars: Record<string, unknown>,
): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => {
  const milk = {
    cursor: 'c1',
    node: {
      id: 'sli-milk',
      itemName: 'Milk',
      quantity: 2,
      unit: null,
      item: { id: 'cat-milk' },
      shoppingList: { id: 'list-1' },
      purchaseInfo: { isPurchased: false, movedToPantryAt: null },
    },
  };
  const beef = {
    cursor: 'c2',
    node: {
      id: 'sli-beef',
      itemName: 'Ground beef',
      quantity: 500,
      unit: GRAM,
      item: { id: 'cat-beef' },
      shoppingList: { id: 'list-1' },
      purchaseInfo: { isPurchased: false, movedToPantryAt: null },
    },
  };
  const asked = Array.isArray(vars.itemIds) ? vars.itemIds : null;
  const edges = [milk, beef].filter(
    edge => !asked || asked.includes(edge.node.item.id),
  );
  return {
    shoppingList: {
      __typename: 'ShoppingList',
      id: 'list-1',
      itemsConnection: {
        totalCount: vars.isPurchased ? 0 : edges.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        edges: vars.isPurchased ? [] : edges,
      },
    },
  };
};

const movedFor = (
  vars: Record<string, unknown>,
): MockDataFor<typeof MoveShoppingItemToPantryDocument> => {
  const input = inputOf(vars);
  return {
    moveShoppingItemToPantry: {
      __typename: 'MoveShoppingItemToPantryPayload',
      pantryItem: { id: String(input.pantryItemId) },
    },
  };
};

// The API is sure of the milk by its code and only guesses at the bananas.
const RESOLVED: MockDataFor<typeof ResolveReceiptLinesDocument> = {
  resolveReceiptLines: {
    store: { id: 'store-27', name: 'Kroger #412' },
    lines: [
      {
        clientId: '1',
        confidence: ReceiptMatchConfidence.High,
        best: {
          method: ReceiptMatchMethod.Code,
          item: { id: 'cat-milk', name: 'Whole milk' },
        },
        candidates: [
          {
            method: ReceiptMatchMethod.Code,
            item: { id: 'cat-milk', name: 'Whole milk' },
          },
        ],
      },
      {
        clientId: '3',
        confidence: ReceiptMatchConfidence.Low,
        best: {
          method: ReceiptMatchMethod.Search,
          item: { id: 'cat-bananas', name: 'Bananas' },
        },
        candidates: [
          {
            method: ReceiptMatchMethod.Search,
            item: { id: 'cat-bananas', name: 'Bananas' },
          },
          {
            method: ReceiptMatchMethod.Search,
            item: { id: 'cat-plantains', name: 'Plantains' },
          },
        ],
      },
    ],
  },
};

async function setup({
  create = recordMock(CreatePantryItemDocument, { dataFor: createFor }),
  resolve,
  resolveAgain,
  storeCreate,
  held = PANTRY,
  listDelay,
  move = recordMock(MoveShoppingItemToPantryDocument, { dataFor: movedFor }),
  listFor = listItems,
  cache = makeCache(),
}: {
  /** The cache to render with, to see what one visit leaves the next. */
  cache?: ReturnType<typeof makeCache>;
  /** The list's pages as the API answers them. */
  listFor?: (
    vars: Record<string, unknown>,
  ) => MockDataFor<typeof GetShoppingListItemsFilteredDocument>;
  /** What the move answers; it echoes the line by default. */
  move?: ReturnType<typeof recordMock>;
  /** How long each page of the list takes to answer. */
  listDelay?: number;
  create?: ReturnType<typeof recordMock>;
  resolve?: ReturnType<typeof recordMock>;
  /** What the matcher answers when it is asked again. */
  resolveAgain?: ReturnType<typeof recordMock>;
  /** The store a confirm adds when the receipt's shop is not on file. */
  storeCreate?: ReturnType<typeof recordMock>;
  /** What the pantry holds before the receipt is added. */
  held?: MockDataFor<typeof GetPantryDocument>;
} = {}) {
  const getPantry = recordMock(GetPantryDocument, { data: held });
  const list = recordMock(GetShoppingListItemsFilteredDocument, {
    dataFor: listFor,
    ...(listDelay !== undefined ? { delay: listDelay } : {}),
  });
  // The user's lists: list-1 while a test has selected it, else none.
  const lists = recordMock(GetShoppingListsLiteDocument, {
    dataFor: (): MockDataFor<typeof GetShoppingListsLiteDocument> => ({
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: useStore.getState().selectedShoppingListId
          ? [
              {
                __typename: 'ShoppingListEdge',
                cursor: 'list-1',
                node: {
                  __typename: 'ShoppingList',
                  id: 'list-1',
                  name: 'Groceries',
                  isDefault: false,
                },
              },
            ]
          : [],
      },
    }),
  });
  const record = recordMock(RecordReceiptMatchesDocument, {
    data: {
      recordReceiptMatches: {
        __typename: 'RecordReceiptMatchesPayload',
        recorded: 1,
        skipped: 0,
      },
    },
  });
  const rendered = renderHookWithApollo(
    () => {
      const pantry = usePantryItemSelection('p1');
      return { pantry, review: useReceiptReview() };
    },
    {
      cache,
      operationMocks: [
        getPantry.mock,
        create.mock,
        lists.mock,
        list.mock,
        move.mock,
        record.mock,
        ...(resolve ? [resolve.mock] : []),
        ...(resolveAgain ? [resolveAgain.mock] : []),
        ...(storeCreate ? [storeCreate.mock] : []),
      ],
    },
  );
  await waitFor(() =>
    expect(rendered.result.current.pantry.hasLoaded).toBe(true),
  );
  // Chooses a line, waits for it to match its list line, and adds the choices.
  const chooseOnListAndAdd = async (
    index: number,
    choice: ReceiptLineChoice,
  ) => {
    await act(async () => {
      rendered.result.current.review.chooseLine(index, choice);
    });
    await waitFor(() =>
      expect(
        rendered.result.current.review.rows.find(row => row.index === index)
          ?.onList,
      ).toBe(true),
    );
    await act(async () => {
      await rendered.result.current.review.addChosen();
    });
  };
  return {
    ...rendered,
    cache,
    create,
    move,
    record,
    list,
    chooseOnListAndAdd,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentPantry.mockReturnValue(KITCHEN);
  seedKrogerDraft();
});

describe('useReceiptReview', () => {
  it('lists the item lines priced after their discounts, none chosen yet', async () => {
    const { result } = await setup();

    const { rows, merchant, pendingCount } = result.current.review;
    expect(merchant).toBe('KROGER');
    // No answer from the matcher: the lines wait for it rather than read as unmatched.
    expect(rows.map(row => [row.printed, row.price, row.status])).toEqual([
      ['KRO WHL MILK', 2.79, 'pending'],
      ['BANANAS', 1.26, 'pending'],
    ]);
    expect(pendingCount).toBe(0);
  });

  it('asks for the store only when neither the receipt nor the API names the shop', async () => {
    const { result, unmount } = await setup();
    // The receipt names KROGER: nothing to ask.
    expect(result.current.review.storeUnrecognized).toBe(false);
    unmount();

    const draft = useReceiptDraftStore.getState().draft;
    if (draft?.parsed) {
      const { merchant: _named, ...unnamed } = draft.parsed;
      useReceiptDraftStore.setState({ draft: { ...draft, parsed: unnamed } });
    }
    const unnamed = await setup();
    expect(unnamed.result.current.review.storeUnrecognized).toBe(true);
  });

  it.each<[string, Partial<ReceiptDraft>, unknown]>([
    [
      'shows the mismatch the server found in its reading',
      { parsedBy: 'server', totalsGap: { counted: 3.55, printed: 4.05 } },
      { counted: 3.55, printed: 4.05 },
    ],
    [
      'shows none when the server found its reading adds up',
      { parsedBy: 'server' },
      null,
    ],
    [
      "checks the phone's own reading on the phone",
      { parsedBy: 'device' },
      { counted: 5.75, printed: 4.05 },
    ],
  ])('%s', async (_name, readBy, totalsGap) => {
    const draft = useReceiptDraftStore.getState().draft!;
    const lines = draft.parsed!.lines.map(({ index: _index, ...line }) => line);
    // A markdown the API found was never taken off reads as OTHER, which the
    // phone's check counts as a fee.
    lines.splice(3, 0, {
      rawText: 'Markdown: $1.70',
      kind: 'other',
      lineTotal: 1.7,
    });
    useReceiptDraftStore.setState({
      draft: { ...draft, parsed: parsedReceipt(lines, 'KROGER'), ...readBy },
    });

    const { result } = await setup();

    expect(result.current.review.totalsGap).toEqual(totalsGap);
  });

  it('adds the chosen lines, keeps what was added, and names why the rest failed', async () => {
    const { result, cache, create } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, BANANAS);
    });
    expect(result.current.review.pendingCount).toBe(2);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
    });

    expect(outcome).toEqual({ added: 1, failed: 1 });
    expect(create.fired.map(vars => vars.input)).toEqual([
      expect.objectContaining({
        item: { id: 'cat-milk' },
        forceAdd: true,
        // A scanned receipt's price, observed on the day it printed. The total
        // only: the API derives the rate from the amount it records.
        purchase: {
          acquisitionMethod: AcquisitionMethod.Purchased,
          totalCost: 2.79,
          receipt: { purchasedOn: '2026-09-28' },
          priceSource: PriceSource.ReceiptScan,
        },
      }),
      expect.objectContaining({
        item: { inline: { name: 'Bananas' } },
        // The total only: the API derives the rate from the stated amount.
        purchase: expect.not.objectContaining({
          costPerUnit: expect.anything(),
        }),
        quantity: 2.14,
        unit: { name: 'lb' },
        forceAdd: true,
      }),
    ]);
    // A bare 1 with no unit is the API's to default, so none is sent.
    expect(create.fired[0]?.input).toEqual(
      expect.not.objectContaining({ quantity: expect.anything() }),
    );
    expect(pantryItemNames(cache)).toEqual(['Whole milk']);

    const [milk, bananas] = result.current.review.rows;
    expect(milk?.status).toBe('added');
    expect(bananas?.status).toBe('failed');
    expect(bananas?.failure).toEqual(expect.any(String));
    // A retry sends only the line that failed.
    expect(result.current.review.pendingCount).toBe(1);
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([1]);
  });

  it('restocks an item the pantry holds and adds a new one beside it', async () => {
    const held: MockDataFor<typeof GetPantryDocument> = {
      pantry: {
        __typename: 'Pantry',
        id: 'p1',
        stats: { totalItems: 1 },
        itemsConnection: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                id: 'pi-milk',
                itemName: 'Whole milk',
                quantity: 1,
                item: { id: 'cat-milk' },
              },
            },
          ],
        },
      },
    };
    // `forceAdd` restocks a held item: the create answers with the held row.
    const create = recordMock(CreatePantryItemDocument, {
      dataFor: (vars): MockDataFor<typeof CreatePantryItemDocument> => {
        const input = inputOf(vars);
        const item = isRecord(input.item) ? input.item : {};
        const restocked = item.id === 'cat-milk';
        return {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            pantryItem: restocked
              ? {
                  id: 'pi-milk',
                  itemName: 'Whole milk',
                  quantity: 2,
                  item: { id: 'cat-milk' },
                }
              : {
                  id: String(input.id),
                  itemName: 'Bananas',
                  item: { id: 'cat-bananas' },
                },
            pantry: { id: 'p1', stats: { totalItems: restocked ? 1 : 2 } },
          },
        };
      },
    });
    const { result, cache } = await setup({ create, held });
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, {
        ...BANANAS,
        itemId: 'cat-bananas',
      });
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
    });

    expect(outcome).toEqual({ added: 2, failed: 0 });
    // One milk row, restocked, beside the new bananas; the count is the server's.
    expect(pantryItemNames(cache).sort()).toEqual(['Bananas', 'Whole milk']);
    expect(readPantry(cache)?.stats.totalItems).toBe(2);
    // Nothing written under the milk's own id outlives the restock: not the
    // row, its edge, its local item, nor its batches field.
    const milkInput = create.fired
      .map(vars => inputOf(vars))
      .find(input => isRecord(input.item) && input.item.id === 'cat-milk');
    const clientId = milkInput ? String(milkInput.id) : '';
    expect(clientId).not.toBe('');
    expect(JSON.stringify(cache.extract())).not.toContain(clientId);
  });

  it('adds nine lines of ten when the API refuses one, and keeps that one to retry', async () => {
    const products = Array.from({ length: 10 }, (_, at) => `ITEM ${at}`);
    seedDraft({
      pages: ['STORE'],
      parsed: parsedReceipt(
        products.map(product => ({
          rawText: `${product}  1.00`,
          kind: 'item',
          product,
          lineTotal: 1,
        })),
      ),
    });
    const create = recordMock(CreatePantryItemDocument, {
      dataFor: (vars): MockDataFor<typeof CreatePantryItemDocument> => {
        const input = inputOf(vars);
        const item = isRecord(input.item) ? input.item : {};
        return item.id === 'cat-6'
          ? {
              createPantryItem: {
                __typename: 'ValidationError',
                code: ErrorCode.ValidationFailed,
                field: 'item',
              },
            }
          : {
              createPantryItem: {
                __typename: 'CreatePantryItemPayload',
                pantryItem: {
                  id: String(input.id),
                  item: { id: String(item.id) },
                },
              },
            };
      },
    });
    const { result } = await setup({ create });
    await act(async () => {
      products.forEach((product, index) =>
        result.current.review.chooseLine(index, {
          ...MILK,
          itemId: `cat-${index}`,
          itemName: product,
        }),
      );
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
    });

    expect(outcome).toEqual({ added: 9, failed: 1 });
    expect(
      result.current.review.rows
        .filter(row => row.failure)
        .map(row => row.index),
    ).toEqual([6]);
    expect(result.current.review.pendingCount).toBe(1);
    expect(useReceiptDraftStore.getState().draft?.added).toHaveLength(9);
  });

  it('counts a create queued offline as added and shows it at once', async () => {
    // The offline queue completes a queued create with null data.
    const data: MockDataFor<typeof CreatePantryItemDocument> = {
      createPantryItem: null,
    };
    const { result, cache } = await setup({
      create: recordMock(CreatePantryItemDocument, { data, partial: true }),
    });
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, {
        ...BANANAS,
        itemId: 'cat-bananas',
      });
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
    });

    expect(outcome).toEqual({ added: 2, failed: 0 });
    expect(pantryItemNames(cache).sort()).toEqual(['Bananas', 'Whole milk']);
    expect(result.current.review.pendingCount).toBe(0);
  });

  it('forgets a line the user chose not to add', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
    });
    await act(async () => {
      result.current.review.chooseLine(1, null);
    });

    expect(result.current.review.rows[0]?.choice).toBeUndefined();
    expect(result.current.review.rows[0]?.status).toBe('skipped');
    expect(result.current.review.pendingCount).toBe(0);
  });

  it('adds a line whose price was not read with no price', async () => {
    const { result, create } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, { ...MILK, price: null });
    });

    await act(async () => {
      await result.current.review.addChosen();
    });

    const [input] = create.fired.map(vars => vars.input);
    expect(input).toEqual(
      expect.objectContaining({ item: { id: 'cat-milk' } }),
    );
    expect(input).not.toHaveProperty('purchase.totalCost');
    expect(input).not.toHaveProperty('purchase.costPerUnit');
  });

  it('adds a printed count as that many packages, priced by their total', async () => {
    const { result, create } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, {
        ...MILK,
        quantity: 2,
        price: 5.58,
      });
    });

    await act(async () => {
      await result.current.review.addChosen();
    });

    // 2 @ 2.79 is two packages the server sizes, never 2 of the milk's
    // tracking unit (2 mL).
    const [input] = create.fired.map(vars => vars.input);
    expect(input).toEqual(
      expect.objectContaining({
        amount: { packages: { count: 2 } },
        purchase: expect.objectContaining({ totalCost: 5.58 }),
      }),
    );
    expect(input).not.toHaveProperty('quantity');
    expect(input).not.toHaveProperty('unit');
  });

  it('adds on the scan day when the receipt printed none, and on the day the user sets', async () => {
    const seeded = useReceiptDraftStore.getState().draft;
    if (!seeded) throw new Error('no draft');
    const { purchasedOn: _read, ...unread } = seeded;
    useReceiptDraftStore.setState({ draft: unread });
    const { result, create } = await setup();

    expect(result.current.review.purchasedOn).toBe(
      toDateKey(new Date(seeded.scannedAt)),
    );
    expect(result.current.review.dayIsScanDay).toBe(true);

    await act(async () => {
      result.current.review.setPurchasedOn('2026-09-26');
      result.current.review.chooseLine(1, MILK);
    });
    expect(result.current.review.dayIsScanDay).toBe(false);

    await act(async () => {
      await result.current.review.addChosen();
    });

    expect(create.fired.map(vars => vars.input)).toEqual([
      expect.objectContaining({
        purchase: expect.objectContaining({
          receipt: { purchasedOn: '2026-09-26' },
        }),
      }),
    ]);
  });

  describe('with the API proposing items', () => {
    const resolved = () =>
      recordMock(ResolveReceiptLinesDocument, { data: RESOLVED });

    it('asks once for the item lines, with the header and the pantry', async () => {
      const resolve = resolved();
      const { result } = await setup({ resolve });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );

      expect(resolve.fired).toEqual([
        {
          input: {
            merchantHeader: 'KROGER',
            pantryId: 'p1',
            parsedBy: ReceiptParser.Device,
            lines: [
              { clientId: '1', text: 'KRO WHL MILK' },
              { clientId: '3', text: 'BANANAS' },
            ],
          },
        },
      ]);
    });

    it('reads its matches from the cache on a return, and drops them once finished', async () => {
      useStore.getState().setSelectedShoppingListId('list-1');
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: RESOLVED,
        maxUsageCount: 2,
      });
      const cache = makeCache();
      const askedByItem = () =>
        Object.keys(cache.extract()['ShoppingList:list-1'] ?? {}).some(key =>
          key.includes('"itemIds"'),
        );
      const first = await setup({ resolve, cache });
      await waitFor(() =>
        expect(first.result.current.review.matchState).toBe('done'),
      );
      first.unmount();

      const second = await setup({ resolve, cache });
      await waitFor(() =>
        expect(second.result.current.review.matchState).toBe('done'),
      );
      expect(resolve.fired).toHaveLength(1);

      await waitFor(() => expect(askedByItem()).toBe(true));

      act(() => {
        second.result.current.review.finish();
      });
      expect(
        Object.keys(cache.extract().ROOT_QUERY ?? {}).some(key =>
          key.startsWith('resolveReceiptLines'),
        ),
      ).toBe(false);
      // The list lines it asked for by item go too.
      expect(askedByItem()).toBe(false);
      useStore.getState().setSelectedShoppingListId(null);
    });

    it('waits for the pantry to be known rather than asking twice', async () => {
      mockCurrentPantry.mockReturnValue({ pantry: null, currentHome: null });
      const resolve = resolved();
      const { result, rerender } = await setup({ resolve });
      expect(resolve.fired).toHaveLength(0);
      expect(result.current.review.matchState).toBe('matching');

      mockCurrentPantry.mockReturnValue(KITCHEN);
      rerender({});
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      expect(resolve.fired).toEqual([
        { input: expect.objectContaining({ pantryId: 'p1' }) },
      ]);
    });

    it('tells the matcher the server read a receipt it read', async () => {
      const draft = useReceiptDraftStore.getState().draft;
      if (draft) {
        useReceiptDraftStore.setState({
          draft: { ...draft, parsedBy: 'server' },
        });
      }
      const resolve = resolved();
      const { result } = await setup({ resolve });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );

      expect(resolve.fired[0]).toEqual({
        input: expect.objectContaining({ parsedBy: ReceiptParser.Server }),
      });
    });

    it('keeps the lines waiting when the lookup fails, and matches them on a retry', async () => {
      const { result } = await setup({
        resolve: recordMock(ResolveReceiptLinesDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        resolveAgain: resolved(),
      });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('failed'),
      );
      expect(result.current.review.rows.map(row => row.status)).toEqual([
        'pending',
        'pending',
      ]);

      await act(async () => {
        result.current.review.retryMatching();
      });

      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      expect(result.current.review.rows.map(row => row.status)).toEqual([
        'add',
        'guess',
      ]);
    });

    it('adds the item it is sure of, and the one it guesses unless the user picks another', async () => {
      const { result } = await setup({ resolve: resolved() });

      await waitFor(() =>
        expect(result.current.review.rows[0]?.status).toBe('add'),
      );
      const [milk, bananas] = result.current.review.rows;
      expect(milk?.choice).toEqual(MILK);
      expect(milk?.status).toBe('add');
      // The guess is the line's product, flagged to check, with no input.
      expect(bananas?.choice).toEqual({ ...BANANAS, itemId: 'cat-bananas' });
      expect(bananas?.status).toBe('guess');
      expect(bananas?.candidates.map(candidate => candidate.itemName)).toEqual([
        'Bananas',
        'Plantains',
      ]);
      expect(result.current.review.pendingCount).toBe(2);

      await act(async () => {
        result.current.review.chooseLine(
          3,
          lineChoice({ itemId: 'cat-plantains', itemName: 'Plantains' }),
        );
      });
      expect(result.current.review.rows[1]?.status).toBe('add');
    });

    it('tells candidates of one name apart by their one brand, else their pack size', async () => {
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: {
          resolveReceiptLines: {
            store: null,
            lines: [
              {
                clientId: '3',
                confidence: ReceiptMatchConfidence.Low,
                best: null,
                candidates: [
                  {
                    method: ReceiptMatchMethod.Search,
                    item: {
                      id: 'milk-kirkland',
                      name: 'Whole milk',
                      brands: [
                        { id: 'ib-1', brand: { id: 'b-1', name: 'Kirkland' } },
                      ],
                    },
                  },
                  {
                    method: ReceiptMatchMethod.Search,
                    item: {
                      id: 'milk-gallon',
                      name: 'Whole milk',
                      netWeight: 1,
                      netWeightKind: NetWeightKind.Package,
                      displayUnit: {
                        id: 'u-gal',
                        symbol: 'gal',
                        name: 'gallon',
                      },
                    },
                  },
                  {
                    method: ReceiptMatchMethod.Search,
                    item: {
                      id: 'milk-label',
                      name: 'Whole milk',
                      netWeight: 100,
                      netWeightKind: NetWeightKind.Reference,
                      displayUnit: { id: 'u-g', symbol: 'g', name: 'gram' },
                    },
                  },
                  {
                    method: ReceiptMatchMethod.Search,
                    item: {
                      id: 'bananas-dole',
                      name: 'Bananas',
                      brands: [
                        { id: 'ib-2', brand: { id: 'b-2', name: 'Dole' } },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      });
      const { result } = await setup({ resolve });

      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      expect(
        result.current.review.rows[1]?.candidates.map(({ itemId, detail }) => ({
          itemId,
          detail,
        })),
      ).toEqual([
        { itemId: 'milk-kirkland', detail: 'Kirkland' },
        { itemId: 'milk-gallon', detail: '1 gal' },
        // A 100 g nutrition basis is no pack size.
        { itemId: 'milk-label', detail: null },
        // No other candidate shares its name: nothing to tell apart.
        { itemId: 'bananas-dole', detail: null },
      ]);
    });

    it('keeps a line the user left out, out, whatever the API proposes', async () => {
      const { result } = await setup({ resolve: resolved() });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.status).toBe('add'),
      );

      await act(async () => {
        result.current.review.chooseLine(1, null);
        result.current.review.chooseLine(3, null);
      });

      // A sure match and an unsure guess alike stay out once left out.
      expect(result.current.review.rows.map(row => row.choice)).toEqual([
        undefined,
        undefined,
      ]);
      expect(result.current.review.rows.map(row => row.status)).toEqual([
        'skipped',
        'skipped',
      ]);
      expect(result.current.review.pendingCount).toBe(0);
    });

    it('adds at the receipt store, then remembers what the household confirmed', async () => {
      const { result, create, record } = await setup({ resolve: resolved() });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.status).toBe('add'),
      );
      // The guess was wrong: the user picks the second candidate.
      await act(async () => {
        result.current.review.chooseLine(3, {
          ...BANANAS,
          itemId: 'cat-plantains',
          itemName: 'Plantains',
        });
      });

      await act(async () => {
        await result.current.review.addChosen();
      });

      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          item: { id: 'cat-milk' },
          purchase: expect.objectContaining({
            receipt: { purchasedOn: '2026-09-28', storeId: 'store-27' },
          }),
        }),
        expect.objectContaining({ item: { id: 'cat-plantains' } }),
      ]);
      await waitFor(() => expect(record.fired).toHaveLength(1));
      expect(record.fired[0]).toEqual({
        input: {
          idempotencyKey: expect.any(String),
          homeId: 'home-1',
          storeId: 'store-27',
          lines: [
            {
              rawText: 'KRO WHL MILK',
              itemId: 'cat-milk',
              resolvedBy: ReceiptMatchMethod.Code,
              edited: false,
            },
            {
              rawText: 'BANANAS',
              itemId: 'cat-plantains',
              resolvedBy: ReceiptMatchMethod.Search,
              edited: true,
            },
          ],
        },
      });
    });

    it('keeps the store field and the proposals while the picked store is asked', async () => {
      const draft = useReceiptDraftStore.getState().draft;
      if (draft?.parsed) {
        const { merchant: _named, ...unnamed } = draft.parsed;
        useReceiptDraftStore.setState({ draft: { ...draft, parsed: unnamed } });
      }
      const resolveAgain = recordMock(ResolveReceiptLinesDocument, {
        // The API echoes the picked store, and is sure of the bananas there.
        data: {
          resolveReceiptLines: {
            store: { id: 'store-99', name: 'Kroger #87' },
            lines: RESOLVED.resolveReceiptLines?.lines?.map(line => ({
              ...line,
              confidence: ReceiptMatchConfidence.High,
            })),
          },
        },
        delay: 100,
      });
      const { result } = await setup({
        resolve: recordMock(ResolveReceiptLinesDocument, {
          data: {
            resolveReceiptLines: {
              ...RESOLVED.resolveReceiptLines,
              store: null,
            },
          },
          maxUsageCount: 1,
        }),
        resolveAgain,
      });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      expect(result.current.review.storeUnrecognized).toBe(true);

      await act(async () => {
        result.current.review.chooseStore({
          id: 'store-99',
          name: 'Kroger #87',
        });
      });
      await waitFor(() => expect(resolveAgain.fired).toHaveLength(1));
      expect(result.current.review.rows.map(row => row.status)).toEqual([
        'add',
        'guess',
      ]);

      await waitFor(() =>
        expect(result.current.review.rows.map(row => row.status)).toEqual([
          'add',
          'add',
        ]),
      );
      // The pick stays open to change.
      expect(result.current.review.storeUnrecognized).toBe(true);
      expect(result.current.review.store).toEqual({
        id: 'store-99',
        name: 'Kroger #87',
      });
    });

    it('shows the store the header names, and adds and remembers at the one the user picks', async () => {
      const resolve = resolved();
      const { result, create, record } = await setup({ resolve });
      await waitFor(() =>
        expect(result.current.review.store).toEqual({
          id: 'store-27',
          name: 'Kroger #412',
        }),
      );

      await act(async () => {
        result.current.review.chooseStore({
          id: 'store-99',
          name: 'Kroger #87',
        });
      });

      expect(result.current.review.store).toEqual({
        id: 'store-99',
        name: 'Kroger #87',
      });
      // The matcher is asked again, at the store the user named.
      await waitFor(() =>
        expect(resolve.fired).toContainEqual({
          input: expect.objectContaining({ storeId: 'store-99' }),
        }),
      );
      await waitFor(() =>
        expect(result.current.review.rows[0]?.status).toBe('add'),
      );

      await act(async () => {
        await result.current.review.addChosen();
      });

      // The bananas go in as the API guessed them: nothing left to choose.
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          item: { id: 'cat-milk' },
          purchase: expect.objectContaining({
            receipt: { purchasedOn: '2026-09-28', storeId: 'store-99' },
          }),
        }),
        expect.objectContaining({
          item: { id: 'cat-bananas' },
          purchase: expect.objectContaining({
            receipt: { purchasedOn: '2026-09-28', storeId: 'store-99' },
          }),
        }),
      ]);
      await waitFor(() => expect(record.fired).toHaveLength(1));
      expect(record.fired[0]).toEqual({
        input: expect.objectContaining({ storeId: 'store-99' }),
      });
    });
    it('adds the shop the receipt names but nobody has, then the lines at it', async () => {
      const draft = useReceiptDraftStore.getState().draft!;
      useReceiptDraftStore.setState({
        draft: {
          ...draft,
          parsedBy: 'server',
          printedStore: {
            name: 'East End Food Co-Op',
            address: '7516 Meade Street',
          },
        },
      });
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: {
          resolveReceiptLines: {
            ...RESOLVED.resolveReceiptLines,
            store: null,
            proposedStore: {
              name: 'East End Food Co-Op',
              address: '7516 Meade Street',
              storeNumber: null,
              chain: null,
            },
          },
        },
      });
      const storeCreate = recordMock(CreateStoreDocument, {
        dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
          createStore: {
            __typename: 'CreateStorePayload',
            outcome: CreateOutcome.Created,
            store: {
              id: String(inputOf(vars).id),
              name: 'East End Food Co-Op',
              address: '7516 Meade Street',
            },
          },
        }),
      });
      const { result, create, record } = await setup({ resolve, storeCreate });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      expect(resolve.fired[0]).toEqual({
        input: expect.objectContaining({
          merchant: {
            name: 'East End Food Co-Op',
            address: '7516 Meade Street',
          },
        }),
      });
      expect(result.current.review.proposedStoreName).toBe(
        'East End Food Co-Op',
      );

      await act(async () => {
        await result.current.review.addChosen();
      });

      // Added on confirm, under an id the client minted, before the lines.
      expect(storeCreate.fired).toEqual([
        {
          input: {
            id: expect.any(String),
            name: 'East End Food Co-Op',
            address: '7516 Meade Street',
          },
        },
      ]);
      const [created] = storeCreate.fired;
      const storeId = String(inputOf(created ?? {}).id);
      const atTheStore = expect.objectContaining({
        receipt: { purchasedOn: '2026-09-28', storeId },
      });
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          item: { id: 'cat-milk' },
          purchase: atTheStore,
        }),
        expect.objectContaining({
          item: { id: 'cat-bananas' },
          purchase: atTheStore,
        }),
      ]);
      await waitFor(() => expect(record.fired).toHaveLength(1));
      expect(record.fired[0]).toEqual({
        input: expect.objectContaining({ storeId }),
      });
      // Kept as the pick, so a retry adds no second store.
      expect(useReceiptDraftStore.getState().draft?.store).toEqual({
        id: storeId,
        name: 'East End Food Co-Op',
      });
    });

    it('stays busy from the store add on, so a second tap adds nothing twice', async () => {
      const draft = useReceiptDraftStore.getState().draft!;
      useReceiptDraftStore.setState({
        draft: { ...draft, printedStore: { name: 'Corner Deli' } },
      });
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: {
          resolveReceiptLines: {
            ...RESOLVED.resolveReceiptLines,
            store: null,
            proposedStore: {
              name: 'Corner Deli',
              address: null,
              storeNumber: null,
              chain: null,
            },
          },
        },
      });
      const storeCreate = recordMock(CreateStoreDocument, {
        delay: 50,
        dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
          createStore: {
            __typename: 'CreateStorePayload',
            outcome: CreateOutcome.Created,
            store: { id: String(inputOf(vars).id), name: 'Corner Deli' },
          },
        }),
      });
      const { result, create } = await setup({ resolve, storeCreate });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );

      let adding: Promise<unknown> = Promise.resolve();
      act(() => {
        adding = result.current.review.addChosen();
      });

      expect(storeCreate.fired).toHaveLength(1);
      expect(create.fired).toHaveLength(0);
      expect(result.current.review.applying).toBe(true);
      await act(async () => {
        await adding;
      });
      expect(result.current.review.applying).toBe(false);
      expect(create.fired).toHaveLength(2);
    });
  });

  describe('with the milk open on the shopping list', () => {
    it('offers the list line for a product as it is picked, before it is saved', async () => {
      const { result } = await setup();
      act(() => {
        result.current.review.pickItem('cat-milk');
      });

      await waitFor(() =>
        expect(
          result.current.review.listItemNameFor(1, {
            itemId: 'cat-milk',
            unitId: null,
            unitText: '',
          }),
        ).toBe('Milk'),
      );
      expect(
        result.current.review.listItemNameFor(1, {
          itemId: 'cat-milk',
          unitId: null,
          unitText: 'kg',
        }),
      ).toBeUndefined();
      expect(result.current.review.rows[0]?.onList).toBe(false);
    });

    beforeEach(() => {
      useStore.getState().setSelectedShoppingListId('list-1');
    });
    afterEach(() => {
      useStore.getState().setSelectedShoppingListId(null);
    });

    it('ticks the list line off instead of adding the milk again', async () => {
      const { result, create, move } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
        result.current.review.chooseLine(3, {
          ...BANANAS,
          itemId: 'cat-bananas',
        });
      });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.onList).toBe(true),
      );
      expect(result.current.review.rows[1]?.onList).toBe(false);
      // The milk's list line is taken, so no other line is offered it.
      expect(result.current.review.listItemNameFor(1, MILK)).toBe('Milk');
      expect(result.current.review.listItemNameFor(3, MILK)).toBeUndefined();

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.review.addChosen();
      });

      expect(outcome).toEqual({ added: 2, failed: 0 });
      // Neither line names a unit and the pantry holds no milk: one package,
      // for the API to size, never 1 of a unit nobody named.
      expect(move.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          shoppingListItemId: 'sli-milk',
          pantryId: 'p1',
          amount: { packages: { count: 1 } },
          totalCost: 2.79,
          removeFromList: true,
          receipt: { purchasedOn: '2026-09-28' },
          priceSource: PriceSource.ReceiptScan,
        }),
      ]);
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({ item: { id: 'cat-bananas' } }),
      ]);
    });

    // A receipt's printed count (2 @ 1.99) is stated as that many packages and
    // the total as printed; the API owns the package arithmetic.
    it.each([
      [
        "the list's amount, not 1 of its unit, for a line that states none",
        { quantity: 1, price: 7.99 },
        { measured: { quantity: 500, unitId: 'unit-g' } },
      ],
      [
        'a printed count as that many packages, with the total as printed',
        { quantity: 2, price: 3.98 },
        { packages: { count: 2 } },
      ],
      [
        'its own amount for a line that states a unit',
        { quantity: 750, unitText: 'g', price: 9.99 },
        { measured: { quantity: 750, unitId: 'unit-g' } },
      ],
    ])('moves %s', async (_case, stated, amount) => {
      const { move, chooseOnListAndAdd } = await setup();
      await chooseOnListAndAdd(
        3,
        lineChoice({ itemId: 'cat-beef', itemName: 'Ground beef', ...stated }),
      );

      expect(move.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          shoppingListItemId: 'sli-beef',
          amount,
          totalCost: stated.price,
        }),
      ]);
      expect(move.fired[0]?.input).not.toHaveProperty('actualPrice');
    });

    it('asks the list only for the lines naming the receipt items', async () => {
      const { move, list, chooseOnListAndAdd } = await setup();
      await chooseOnListAndAdd(
        3,
        lineChoice({
          itemId: 'cat-beef',
          itemName: 'Ground beef',
          price: 7.99,
        }),
      );

      expect(move.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({ shoppingListItemId: 'sli-beef' }),
      ]);
      // Never the whole list: every ask names the items it looks for.
      const asks = list.fired.filter(vars => !vars.isPurchased);
      expect(asks.length).toBeGreaterThan(0);
      expect(asks.every(vars => Array.isArray(vars.itemIds))).toBe(true);
      expect(asks.at(-1)?.itemIds).toContain('cat-beef');
    });

    it('holds the add until the list lines have loaded', async () => {
      const { result } = await setup({ listDelay: 300 });
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
      });

      await waitFor(
        () => expect(result.current.review.listLoading).toBe(true),
        {
          timeout: 3000,
        },
      );
      await waitFor(
        () => expect(result.current.review.listLoading).toBe(false),
        { timeout: 3000 },
      );
    });

    it('matches against the list the user still has when the selected one is gone', async () => {
      useStore.getState().setSelectedShoppingListId('list-gone');
      const { result } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
      });

      await waitFor(() =>
        expect(result.current.review.rows[0]?.onList).toBe(true),
      );
    });

    it('says when the list is longer than the review can see', async () => {
      // Every page is full and another always follows: the cache keeps 100.
      const endless = (
        vars: Record<string, unknown>,
      ): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => {
        const from = Number(vars.after ?? 0);
        return {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              totalCount: vars.isPurchased ? 0 : 500,
              pageInfo: {
                hasNextPage: !vars.isPurchased,
                endCursor: String(from + 25),
              },
              edges: vars.isPurchased
                ? []
                : Array.from({ length: 25 }, (_, i) => ({
                    cursor: String(from + i + 1),
                    node: {
                      id: `sli-${from + i}`,
                      itemName: `Item ${from + i}`,
                      quantity: 1,
                      unit: null,
                      item: { id: `cat-${from + i}` },
                      shoppingList: { id: 'list-1' },
                      purchaseInfo: {
                        isPurchased: false,
                        movedToPantryAt: null,
                      },
                    },
                  })),
            },
          },
        };
      };
      const { result } = await setup({ listFor: endless });
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
      });

      await waitFor(
        () => expect(result.current.review.listIncomplete).toBe(true),
        { timeout: 5000 },
      );
      expect(result.current.review.listLoading).toBe(false);
    });

    it('counts a line no unit names in the counted stack the pantry holds', async () => {
      const held: MockDataFor<typeof GetPantryDocument> = {
        pantry: {
          __typename: 'Pantry',
          id: 'p1',
          stats: { totalItems: 1 },
          itemsConnection: {
            totalCount: 1,
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [
              {
                node: {
                  id: 'pi-milk',
                  itemName: 'Milk',
                  quantity: 2,
                  item: { id: 'cat-milk' },
                  unit: {
                    id: 'unit-carton',
                    symbol: 'carton',
                    type: UnitType.Count,
                  },
                },
              },
            ],
          },
        },
      };
      const { move, chooseOnListAndAdd } = await setup({ held });
      await chooseOnListAndAdd(1, MILK);

      expect(move.fired[0]?.input).toMatchObject({
        amount: { measured: { quantity: 1, unitId: 'unit-carton' } },
      });
    });

    it('names a line the API cannot size, and adds the rest', async () => {
      const refused = recordMock(MoveShoppingItemToPantryDocument, {
        data: {
          moveShoppingItemToPantry: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'No package size',
            field: 'amount.packages.size',
          },
        },
      });
      const { result, create } = await setup({ move: refused });
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
        result.current.review.chooseLine(3, {
          ...BANANAS,
          itemId: 'cat-bananas',
        });
      });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.onList).toBe(true),
      );

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.review.addChosen();
      });

      expect(outcome).toEqual({ added: 1, failed: 1 });
      expect(create.fired).toHaveLength(1);
      expect(result.current.review.pendingCount).toBe(1);
    });

    it('sends the receipt but no price for a line whose price was not read', async () => {
      const { move, chooseOnListAndAdd } = await setup();
      await chooseOnListAndAdd(1, { ...MILK, price: null });

      const [input] = move.fired.map(vars => vars.input);
      expect(input).toEqual(
        expect.objectContaining({
          shoppingListItemId: 'sli-milk',
          amount: { packages: { count: 1 } },
          // The purchase keeps the receipt's store and day.
          receipt: { purchasedOn: '2026-09-28' },
          priceSource: PriceSource.ReceiptScan,
        }),
      );
      // No price read, so none is sent: the list's own price stands.
      expect(input).toMatchObject({ totalCost: undefined });
    });

    it('adds a line on its own when the user keeps it off the list', async () => {
      const { result, create, move } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, { ...MILK, offList: true });
      });
      // Still offered, so the line can be put back on the list.
      await waitFor(() =>
        expect(result.current.review.listItemNameFor(1, MILK)).toBe('Milk'),
      );
      expect(result.current.review.rows[0]?.onList).toBe(false);

      await act(async () => {
        await result.current.review.addChosen();
      });

      expect(move.fired).toEqual([]);
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({ item: { id: 'cat-milk' } }),
      ]);
    });
  });
});
