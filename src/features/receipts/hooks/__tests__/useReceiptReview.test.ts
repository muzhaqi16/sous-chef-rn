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
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import {
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useStore } from '#store';
import {
  CreateOutcome,
  NetWeightKind,
  ReceiptMatchConfidence,
  ReceiptMatchMethod,
  ReceiptParser,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { toDateKey } from '#/utils/dateUtils';
import { t } from '#/i18n';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
  type ReceiptLineChoice,
} from '../../store/receiptDraftStore';
import {
  checkInAnswer,
  lineChoice,
  parsedReceipt,
  seedDraft,
  sentLinesOf,
} from '../../__tests__/helpers/receiptFixtures';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import { useReceiptReview } from '../useReceiptReview';
import { UseReceiptReview_StoreFragmentDoc } from '../useReceiptReview.generated';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { ResolveReceiptLinesDocument } from '../useReceiptMatches.generated';
import { CreateReceiptCheckInDocument } from '../useReceiptCheckIn.generated';
import {
  UseHeldStores_ListFragmentDoc,
  UseHeldStores_StoreFragmentDoc,
} from '../useHeldStores.generated';

jest.mock('#/services/errorService');
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
  pantry: { id: 'p1', itemsConnection: connectionOf([]) },
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

// Milk is open on the active list; nothing has been bought from it yet. The
// API answers only the lines naming `itemIds`.
const listItems = (
  vars: Record<string, unknown>,
): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => {
  const milk = {
    id: 'sli-milk',
    itemName: 'Milk',
    unit: null,
    item: { id: 'cat-milk' },
    purchaseInfo: { isPurchased: false, movedToPantryAt: null },
  };
  const asked = Array.isArray(vars.itemIds) ? vars.itemIds : null;
  const open = !asked || asked.includes(milk.item.id);
  return {
    shoppingList: {
      id: 'list-1',
      itemsConnection: connectionOf(open && !vars.isPurchased ? [milk] : []),
    },
  };
};

const fired = (checkIn: ReturnType<typeof recordMock>) =>
  checkIn.fired.map(vars => inputOf(vars));

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
        candidates: [{ item: { id: 'cat-milk', name: 'Whole milk' } }],
      },
      {
        clientId: '3',
        confidence: ReceiptMatchConfidence.Low,
        best: {
          method: ReceiptMatchMethod.Search,
          item: { id: 'cat-bananas', name: 'Bananas' },
        },
        candidates: [
          { item: { id: 'cat-bananas', name: 'Bananas' } },
          { item: { id: 'cat-plantains', name: 'Plantains' } },
        ],
      },
    ],
  },
};

// The API places no store, proposing the receipt's shop to add on confirm
// and the household's unlocated store a check-in would locate.
const proposing = (
  { name, address = null }: { name: string; address?: string | null },
  completableStore: { id: string; name: string } | null = null,
) =>
  recordMock(ResolveReceiptLinesDocument, {
    data: {
      resolveReceiptLines: {
        ...RESOLVED.resolveReceiptLines,
        store: null,
        proposedStore: { name, address, storeNumber: null, chain: null },
        completableStore,
      },
    },
  });

// Adds the store a confirm creates, under the id the client minted.
const creating = (
  store: { name: string; address?: string },
  { held = false }: { held?: boolean } = {},
) =>
  recordMock(CreateStoreDocument, {
    held,
    dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
      createStore: {
        __typename: 'CreateStorePayload',
        outcome: CreateOutcome.Created,
        store: { id: String(inputOf(vars).id), ...store },
      },
    }),
  });

async function setup({
  checkIn = recordMock(CreateReceiptCheckInDocument, {
    dataFor: checkInAnswer(),
  }),
  resolve,
  resolveAgain,
  storeCreate,
  held = PANTRY,
  listHeld = false,
  listFor = listItems,
  cache = makeCache(),
}: {
  /** The cache to render with, to see what one visit leaves the next. */
  cache?: ReturnType<typeof makeCache>;
  /** The list's pages as the API answers them. */
  listFor?: (
    vars: Record<string, unknown>,
  ) => MockDataFor<typeof GetShoppingListItemsFilteredDocument>;
  /** The list answers only once the test calls `list.release()`. */
  listHeld?: boolean;
  /** What the check-in answers; it records every line by default. */
  checkIn?: ReturnType<typeof recordMock>;
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
    held: listHeld,
  });
  // The user's lists: list-1 while a test has selected it, else none.
  const lists = recordMock(GetShoppingListsLiteDocument, {
    dataFor: (): MockDataFor<typeof GetShoppingListsLiteDocument> => ({
      shoppingLists: connectionOf(
        useStore.getState().selectedShoppingListId
          ? [{ id: 'list-1', isDefault: false }]
          : [],
      ),
    }),
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
        lists.mock,
        list.mock,
        checkIn.mock,
        ...(resolve ? [resolve.mock] : []),
        ...(resolveAgain ? [resolveAgain.mock] : []),
        ...(storeCreate ? [storeCreate.mock] : []),
      ],
    },
  );
  await waitFor(() =>
    expect(rendered.result.current.pantry.hasLoaded).toBe(true),
  );
  // Adds the chosen lines, and waits for the API to answer the check-in.
  const addChosen = async () => {
    let outcome: unknown;
    await act(async () => {
      outcome = await rendered.result.current.review.addChosen();
    });
    await waitFor(() =>
      expect(useReceiptDraftStore.getState().draft?.checkIn?.state).not.toBe(
        'sending',
      ),
    );
    return outcome;
  };
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
    await addChosen();
  };
  return {
    ...rendered,
    cache,
    checkIn,
    list,
    addChosen,
    chooseOnListAndAdd,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentPantry.mockReturnValue(KITCHEN);
  seedKrogerDraft();
  // The units the device warmed: a typed unit resolves without the API.
  useStore.getState().setCachedUnits([
    { id: 'unit-lb', name: 'pound', symbol: 'lb' },
    { id: 'unit-g', name: 'gram', symbol: 'g' },
  ]);
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
  ])('%s', async (_name, readBy, totalsGap) => {
    const draft = useReceiptDraftStore.getState().draft!;
    const lines = draft.parsed!.lines.map(({ index: _index, ...line }) => line);
    // A markdown the API found was never taken off reads as OTHER, which a sum
    // of the lines counts as a fee: only the reader's verdict is shown.
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

  it('checks the chosen lines in at once, keeps what landed, and names why the rest failed', async () => {
    const checkIn = recordMock(CreateReceiptCheckInDocument, {
      // The typed bananas are refused.
      dataFor: checkInAnswer({ refuses: line => !!line.item.inline }),
      maxUsageCount: 2,
    });
    const { result, cache, addChosen } = await setup({ checkIn });
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, BANANAS);
    });
    expect(result.current.review.pendingCount).toBe(2);

    let shownBefore: string[] = [];
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
      shownBefore = pantryItemNames(cache);
    });
    // Both show in the pantry before the API is asked.
    expect(outcome).toEqual({ sent: 2, held: 0 });
    expect(shownBefore.sort()).toEqual(['Bananas', 'Whole milk']);
    await addChosen();

    const ids = useReceiptDraftStore.getState().draft?.checkIn;
    const [milkIds, bananaIds] = [ids?.lines[1], ids?.lines[3]];
    expect(fired(checkIn)).toEqual([
      {
        id: ids?.ids[0],
        pantryId: 'p1',
        purchasedOn: '2026-09-28',
        // No time was read: noon that day, on the phone's clock.
        purchasedAt: new Date(2026, 8, 28, 12).toISOString(),
        today: expect.any(String),
        // No store is on file for it: the API places the receipt by its header.
        merchantHeader: 'KROGER',
        lines: [
          {
            clientId: '1',
            purchaseId: milkIds?.purchaseId,
            pantryItemId: milkIds?.pantryItemId,
            item: { id: 'cat-milk' },
            // A bare 1 with no unit is one package, for the API to size.
            amount: { packages: { count: 1 } },
            // What was paid, with the saving apart: the API records 3.29.
            totalPaid: 2.79,
            discount: 0.5,
            rawText: 'KRO WHL MILK',
            resolvedBy: null,
            edited: true,
          },
          {
            clientId: '3',
            purchaseId: bananaIds?.purchaseId,
            pantryItemId: bananaIds?.pantryItemId,
            // A typed name goes under the id the device minted for it.
            item: { inline: { id: bananaIds?.newItemId, name: 'Bananas' } },
            amount: { measured: { quantity: 2.14, unitId: 'unit-lb' } },
            totalPaid: 1.26,
            rawText: 'BANANAS',
            resolvedBy: null,
            edited: true,
          },
        ],
      },
    ]);
    expect(pantryItemNames(cache)).toEqual(['Whole milk']);

    const [milk, bananas] = result.current.review.rows;
    expect(milk?.status).toBe('added');
    expect(bananas?.status).toBe('failed');
    expect(bananas?.failure).toEqual(expect.any(String));
    expect(result.current.review.pendingCount).toBe(1);
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([1]);

    // A retry sends the line that failed alone, under the ids it was given.
    await addChosen();
    const [first, retry] = checkIn.fired;
    expect(sentLinesOf(retry ?? {})).toEqual([sentLinesOf(first ?? {})[1]]);
  });

  it('counts a check-in queued offline as added and shows it at once', async () => {
    // The offline queue completes a queued write with null data.
    const data: MockDataFor<typeof CreateReceiptCheckInDocument> = {
      createReceiptCheckIn: null,
    };
    const { result, cache, addChosen } = await setup({
      checkIn: recordMock(CreateReceiptCheckInDocument, {
        data,
        partial: true,
      }),
    });
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, {
        ...BANANAS,
        itemId: 'cat-bananas',
      });
    });

    expect(await addChosen()).toEqual({ sent: 2, held: 0 });

    expect(pantryItemNames(cache).sort()).toEqual(['Bananas', 'Whole milk']);
    expect(result.current.review.pendingCount).toBe(0);
    expect(useReceiptDraftStore.getState().draft?.checkIn?.state).toBe(
      'queued',
    );
  });

  it.each<[string, Partial<ReceiptLineChoice>, string]>([
    [
      'no price was read',
      { price: null },
      'Enter what you paid for this line.',
    ],
    [
      'it was bought in a unit the device cannot name',
      { unitText: 'flagon' },
      'Give it a unit to add it',
    ],
    [
      'it names no product',
      { itemId: null, itemName: ' ' },
      'Please enter an item name',
    ],
  ])(
    'holds a line back, saying why, when %s, and sends the rest',
    async (_case, lacking, why) => {
      const { result, checkIn, addChosen } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, { ...MILK, ...lacking });
        result.current.review.chooseLine(3, {
          ...BANANAS,
          itemId: 'cat-bananas',
        });
      });

      expect(await addChosen()).toEqual({ sent: 1, held: 1 });

      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.objectContaining({ clientId: '3' }),
      ]);
      const [milk] = result.current.review.rows;
      expect(milk?.status).toBe('failed');
      expect(milk?.failure).toContain(why);
      expect(result.current.review.pendingCount).toBe(1);
    },
  );

  it('says a line refused with no code this build knows was not added', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      const { draft } = useReceiptDraftStore.getState();
      useReceiptDraftStore.setState({
        draft: draft && { ...draft, failed: { 1: null } },
      });
    });

    const [milk] = result.current.review.rows;
    expect(milk?.status).toBe('failed');
    expect(milk?.failure).toBe(t('errors.addItemFailedRetry'));
  });

  it('sends the server reading it was confirmed from, and a saving off the whole order', async () => {
    const draft = useReceiptDraftStore.getState().draft!;
    const lines = draft.parsed!.lines.map(({ index: _index, ...line }) => line);
    lines.splice(4, 0, {
      rawText: '$5 OFF $50 2.00-',
      kind: 'discount',
      lineTotal: -2,
    });
    useReceiptDraftStore.setState({
      draft: {
        ...draft,
        parsed: parsedReceipt(lines, 'KROGER'),
        parsedBy: 'server',
        parseId: 'parse-1',
      },
    });
    const { result, checkIn, addChosen } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
    });

    await addChosen();

    expect(fired(checkIn)[0]).toEqual(
      expect.objectContaining({ receiptParseId: 'parse-1', orderDiscount: 2 }),
    );
  });

  it('adds on the scan day when the receipt printed none, and on the day the user sets', async () => {
    const seeded = useReceiptDraftStore.getState().draft;
    if (!seeded) throw new Error('no draft');
    const { purchasedOn: _read, ...unread } = seeded;
    useReceiptDraftStore.setState({ draft: unread });
    const { result, checkIn, addChosen } = await setup();

    expect(result.current.review.purchasedOn).toBe(
      toDateKey(new Date(seeded.scannedAt)),
    );
    expect(result.current.review.dayIsScanDay).toBe(true);

    await act(async () => {
      result.current.review.setPurchasedOn('2026-09-26');
      result.current.review.chooseLine(1, MILK);
    });
    expect(result.current.review.dayIsScanDay).toBe(false);

    await addChosen();

    expect(fired(checkIn)).toEqual([
      expect.objectContaining({ purchasedOn: '2026-09-26' }),
    ]);
  });

  it("sends the receipt's printed time on the day, also a day the user sets", async () => {
    const seeded = useReceiptDraftStore.getState().draft;
    if (!seeded) throw new Error('no draft');
    useReceiptDraftStore.setState({
      draft: { ...seeded, purchaseTime: '18:42' },
    });
    const { result, checkIn, addChosen } = await setup();

    await act(async () => {
      result.current.review.setPurchasedOn('2026-09-26');
      result.current.review.chooseLine(1, MILK);
    });
    await addChosen();

    expect(fired(checkIn)).toEqual([
      expect.objectContaining({
        purchasedOn: '2026-09-26',
        purchasedAt: new Date(2026, 8, 26, 18, 42).toISOString(),
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
            lines: [
              {
                clientId: '3',
                best: null,
                candidates: [
                  {
                    item: {
                      id: 'milk-kirkland',
                      name: 'Whole milk',
                      brands: [{ brand: { name: 'Kirkland' } }],
                    },
                  },
                  {
                    item: {
                      id: 'milk-gallon',
                      name: 'Whole milk',
                      netWeight: 1,
                      netWeightKind: NetWeightKind.Package,
                      displayUnit: { symbol: 'gal', name: 'gallon' },
                    },
                  },
                  {
                    item: {
                      id: 'milk-label',
                      name: 'Whole milk',
                      netWeight: 100,
                      netWeightKind: NetWeightKind.Reference,
                      displayUnit: { symbol: 'g', name: 'gram' },
                    },
                  },
                  {
                    item: {
                      id: 'bananas-dole',
                      name: 'Bananas',
                      brands: [{ brand: { name: 'Dole' } }],
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

    it('offers one choice for candidates nothing tells apart: the first', async () => {
      // No brand and no pack size: nothing the sheet could show sets them apart.
      const spinach = (id: string) => ({
        item: {
          id,
          name: 'Baby Spinach',
          brands: [],
          netWeightKind: NetWeightKind.Reference,
        },
      });
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: {
          resolveReceiptLines: {
            lines: [
              {
                clientId: '3',
                best: null,
                candidates: [
                  spinach('spinach-1'),
                  spinach('spinach-2'),
                  spinach('spinach-3'),
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
      ).toEqual([{ itemId: 'spinach-1', detail: null }]);
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

    it('adds at the receipt store, and tells the API what the household confirmed', async () => {
      const { result, checkIn, addChosen } = await setup({
        resolve: resolved(),
      });
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

      await addChosen();

      const [input] = fired(checkIn);
      expect(input).toEqual(
        expect.objectContaining({
          storeId: 'store-27',
          purchasedOn: '2026-09-28',
        }),
      );
      // The store is known, so its header is not sent to place it.
      expect(input).not.toHaveProperty('merchantHeader');
      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.objectContaining({
          item: { id: 'cat-milk' },
          rawText: 'KRO WHL MILK',
          resolvedBy: ReceiptMatchMethod.Code,
          edited: false,
        }),
        expect.objectContaining({
          item: { id: 'cat-plantains' },
          rawText: 'BANANAS',
          resolvedBy: ReceiptMatchMethod.Search,
          edited: true,
        }),
      ]);
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
        held: true,
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

      await act(async () => resolveAgain.release());
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

    it('says where the store the header names is, and where the one the user picks is', async () => {
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: {
          resolveReceiptLines: {
            ...RESOLVED.resolveReceiptLines,
            store: {
              id: 'store-27',
              name: 'Kroger #412',
              address: '100 Main St',
              storeNumber: '412',
            },
          },
        },
      });
      const cache = makeCache();
      // A store the user picks was read with its address by the picker.
      cache.writeQuery({
        query: SearchStoresDocument,
        variables: { search: 'kroger', limit: 20 },
        data: {
          __typename: 'Query',
          stores: {
            __typename: 'StoreConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'StoreEdge',
                node: {
                  __typename: 'Store',
                  id: 'store-99',
                  name: 'Kroger #87',
                  address: '200 Side St',
                  storeNumber: '87',
                  chain: null,
                },
              },
            ],
          },
        },
      });
      const { result } = await setup({ resolve, cache });
      await waitFor(() =>
        expect(result.current.review.storeLocation).toEqual({
          address: '100 Main St',
          storeNumber: '412',
        }),
      );

      await act(async () => {
        result.current.review.chooseStore({
          id: 'store-99',
          name: 'Kroger #87',
        });
      });

      expect(result.current.review.storeLocation).toEqual({
        address: '200 Side St',
        storeNumber: '87',
      });
    });

    it('shows the store the header names, and adds at the one the user picks', async () => {
      const resolve = resolved();
      const { result, checkIn, addChosen } = await setup({ resolve });
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

      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({ storeId: 'store-99' }),
      ]);
      // The bananas go in as the API guessed them: nothing left to choose.
      expect(
        sentLinesOf(checkIn.fired[0] ?? {}).map(line => line.item),
      ).toEqual([{ id: 'cat-milk' }, { id: 'cat-bananas' }]);
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
      const coOp = {
        name: 'East End Food Co-Op',
        address: '7516 Meade Street',
      };
      const resolve = proposing(coOp);
      const storeCreate = creating(coOp);
      const { result, checkIn, addChosen } = await setup({
        resolve,
        storeCreate,
      });
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

      await addChosen();

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
      expect(fired(checkIn)).toEqual([expect.objectContaining({ storeId })]);
      // Kept as the pick, so a retry adds no second store.
      expect(useReceiptDraftStore.getState().draft?.store).toEqual({
        id: storeId,
        name: 'East End Food Co-Op',
      });
    });

    it('shows the lines while the shop is added, and checks them in once it is', async () => {
      const draft = useReceiptDraftStore.getState().draft!;
      useReceiptDraftStore.setState({
        draft: { ...draft, printedStore: { name: 'Corner Deli' } },
      });
      const resolve = proposing({ name: 'Corner Deli' });
      const storeCreate = creating({ name: 'Corner Deli' }, { held: true });
      const { result, cache, checkIn } = await setup({
        resolve,
        storeCreate,
      });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );
      const confirm = async () => {
        let outcome: unknown;
        await act(async () => {
          outcome = await result.current.review.addChosen();
        });
        return outcome;
      };

      await confirm();

      // The lines show while the store is still being added.
      expect(storeCreate.fired).toHaveLength(1);
      expect(checkIn.fired).toHaveLength(0);
      expect(pantryItemNames(cache).sort()).toEqual(['Bananas', 'Whole milk']);
      // A second tap sends nothing, and adds no second store.
      expect(await confirm()).toEqual({ sent: 0, held: 0 });

      await act(async () => storeCreate.release());
      await waitFor(() => expect(checkIn.fired).toHaveLength(1));
      expect(storeCreate.fired).toHaveLength(1);
    });
  });

  it('says where the shop it proposes to add is', async () => {
    const resolve = proposing({
      name: 'East End Food Co-Op',
      address: '7516 Meade Street',
    });
    const { result } = await setup({ resolve });

    await waitFor(() =>
      expect(result.current.review.storeLocation).toEqual({
        address: '7516 Meade Street',
        storeNumber: null,
      }),
    );
  });

  describe('offering a store the receipt would locate', () => {
    // The household's "Kroger", added before any receipt located it, and a
    // branch of that name, which has its address.
    const KROGER_LABEL = {
      id: 'store-label',
      name: 'Kroger',
      address: null,
      storeNumber: null,
    };
    const KROGER_BRANCH = {
      id: 'store-27',
      name: 'Kroger',
      address: '412 Main St',
    };
    const OFFER = { id: 'store-label', name: 'Kroger' };

    // Read by the server: the check-in sends the parse that locates a store.
    const readByServer = (readBy: Partial<ReceiptDraft> = {}) => {
      const draft = useReceiptDraftStore.getState().draft!;
      useReceiptDraftStore.setState({
        draft: { ...draft, parsedBy: 'server', parseId: 'parse-1', ...readBy },
      });
    };
    // Offline: the lookup cannot be asked.
    const offline = () =>
      recordMock(ResolveReceiptLinesDocument, {
        error: new Error('Network request failed'),
      });
    // The API places no store, proposes the receipt's, and names `completable`.
    const unplaced = (completable: { id: string; name: string } | null) =>
      proposing({ name: 'Kroger', address: '412 Main St' }, completable);

    afterEach(() => {
      useStore.getState().setCachedStores([]);
      useStore.getState().setSelectedShoppingListId(null);
    });

    it('offers the unlocated store the device holds, offline, and checks in there once picked', async () => {
      readByServer();
      useStore.getState().setCachedStores([KROGER_BRANCH, KROGER_LABEL]);
      const { result, checkIn, addChosen } = await setup({
        resolve: offline(),
      });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('failed'),
      );

      expect(result.current.review.storeOffer).toEqual(OFFER);
      // Offered, never placed.
      expect(result.current.review.store).toBeNull();

      await act(async () => {
        result.current.review.chooseStore(result.current.review.storeOffer!);
        result.current.review.chooseLine(1, MILK);
      });
      expect(result.current.review.store).toEqual(OFFER);
      expect(result.current.review.storeOffer).toBeNull();

      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({
          storeId: 'store-label',
          receiptParseId: 'parse-1',
        }),
      ]);
    });

    it("offers the active list's shop when the cache knows it has no address", async () => {
      readByServer();
      useStore.getState().setSelectedShoppingListId('list-1');
      const cache = makeCache();
      cache.writeFragment({
        fragment: UseHeldStores_ListFragmentDoc,
        fragmentName: 'useHeldStores_list',
        id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
        data: {
          __typename: 'ShoppingList',
          id: 'list-1',
          targetStore: {
            __typename: 'Store',
            id: 'store-label',
            name: 'Kroger',
          },
        },
      });
      const known = await setup({ resolve: offline(), cache });
      await waitFor(() =>
        expect(known.result.current.review.matchState).toBe('failed'),
      );
      // Its name alone: an address the cache never held is not none.
      expect(known.result.current.review.storeOffer).toBeNull();
      known.unmount();

      cache.writeFragment({
        fragment: UseHeldStores_StoreFragmentDoc,
        fragmentName: 'useHeldStores_store',
        id: cache.identify({ __typename: 'Store', id: 'store-label' }),
        data: { __typename: 'Store', ...KROGER_LABEL },
      });
      const { result } = await setup({ resolve: offline(), cache });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('failed'),
      );

      expect(result.current.review.storeOffer).toEqual(OFFER);
    });

    it("offers the API's unlocated store when the device holds none, and never places it", async () => {
      readByServer();
      const { result } = await setup({ resolve: unplaced(OFFER) });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );

      expect(result.current.review.storeOffer).toEqual(OFFER);
      expect(result.current.review.store).toBeNull();
      expect(useReceiptDraftStore.getState().draft?.store).toBeUndefined();
      expect(result.current.review.proposedStoreName).toBe('Kroger');
    });

    // The check-in places a store with no place of its own where the receipt
    // says, so the line keeps saying it once the offer is taken.
    it("keeps the receipt's place on the line once the offered store is picked", async () => {
      readByServer({
        printedStore: { name: 'Kroger', address: '412 Main St' },
      });
      const cache = makeCache();
      cache.writeFragment({
        fragment: UseReceiptReview_StoreFragmentDoc,
        fragmentName: 'useReceiptReview_store',
        id: cache.identify({ __typename: 'Store', id: 'store-label' }),
        data: {
          __typename: 'Store',
          id: 'store-label',
          address: null,
          storeNumber: null,
        },
      });
      const { result } = await setup({ resolve: unplaced(OFFER), cache });
      await waitFor(() =>
        expect(result.current.review.storeOffer).toEqual(OFFER),
      );
      expect(result.current.review.storeLocation).toEqual({
        address: '412 Main St',
        storeNumber: null,
      });

      await act(async () => {
        result.current.review.chooseStore(OFFER);
      });

      expect(result.current.review.store).toEqual(OFFER);
      expect(result.current.review.storeLocation).toEqual({
        address: '412 Main St',
        storeNumber: null,
      });
    });

    it('offers none for a receipt read on the phone: nothing would locate it', async () => {
      readByServer({ parsedBy: 'device' });
      useStore.getState().setCachedStores([KROGER_LABEL]);
      const { result } = await setup({ resolve: unplaced(OFFER) });
      await waitFor(() =>
        expect(result.current.review.matchState).toBe('done'),
      );

      expect(result.current.review.storeOffer).toBeNull();
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
      const { result, cache, checkIn, addChosen } = await setup();
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

      let movedBefore: unknown;
      await act(async () => {
        await result.current.review.addChosen();
        movedBefore = cache.extract()['ShoppingListItem:sli-milk'];
      });
      // Stamped moved on the device before the API answers.
      expect(movedBefore).toMatchObject({
        purchaseInfo: { movedToPantryAt: expect.any(String) },
      });
      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({ shoppingListId: 'list-1' }),
      ]);
      // Neither line names a unit and the pantry holds no milk: one package,
      // for the API to size, never 1 of a unit nobody named.
      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.objectContaining({
          shoppingListItemId: 'sli-milk',
          amount: { packages: { count: 1 } },
          totalPaid: 2.79,
        }),
        expect.not.objectContaining({ shoppingListItemId: expect.anything() }),
      ]);
      expect(useReceiptDraftStore.getState().draft?.added).toEqual([1, 3]);
    });

    it('holds the add until the list lines have loaded', async () => {
      const { result, list } = await setup({ listHeld: true });
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
      });

      await waitFor(() => expect(result.current.review.listLoading).toBe(true));
      await act(async () => list.release());
      await waitFor(() =>
        expect(result.current.review.listLoading).toBe(false),
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
      // Another page follows the one the review reads.
      const longer = (): MockDataFor<
        typeof GetShoppingListItemsFilteredDocument
      > => ({
        shoppingList: {
          id: 'list-1',
          itemsConnection: connectionOf([], { hasNextPage: true }),
        },
      });
      const { result } = await setup({ listFor: longer });
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
          id: 'p1',
          itemsConnection: connectionOf([
            {
              item: { id: 'cat-milk' },
              unit: { id: 'unit-carton', type: UnitType.Count },
            },
          ]),
        },
      };
      const { checkIn, chooseOnListAndAdd } = await setup({ held });
      await chooseOnListAndAdd(1, MILK);

      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.objectContaining({
          amount: { measured: { quantity: 1, unitId: 'unit-carton' } },
        }),
      ]);
    });

    it('names a line the API cannot size, puts it back on the list, and adds the rest', async () => {
      const checkIn = recordMock(CreateReceiptCheckInDocument, {
        dataFor: checkInAnswer({ refuses: line => !!line.shoppingListItemId }),
      });
      const { result, cache, addChosen } = await setup({ checkIn });
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

      await addChosen();

      expect(pantryItemNames(cache)).toEqual(['Bananas']);
      expect(cache.extract()['ShoppingListItem:sli-milk']).toMatchObject({
        purchaseInfo: { movedToPantryAt: null },
      });
      expect(result.current.review.rows.map(row => row.status)).toEqual([
        'failed',
        'added',
      ]);
      expect(result.current.review.pendingCount).toBe(1);
    });

    it('leaves a ticked list line at the version the API answers', async () => {
      const checkIn = recordMock(CreateReceiptCheckInDocument, {
        dataFor: (vars): MockDataFor<typeof CreateReceiptCheckInDocument> => ({
          createReceiptCheckIn: {
            __typename: 'CreateReceiptCheckInPayload',
            results: sentLinesOf(vars).map((line, index) => ({
              index,
              clientId: line.clientId,
              success: true,
              failure: null,
              pantryItem: { id: line.pantryItemId, item: { id: 'cat-milk' } },
              shoppingListItem: {
                id: line.shoppingListItemId,
                version: 7,
                purchaseInfo: { isPurchased: true },
              },
            })),
          },
        }),
      });
      const { cache, chooseOnListAndAdd } = await setup({ checkIn });
      await chooseOnListAndAdd(1, MILK);

      expect(cache.extract()['ShoppingListItem:sli-milk']).toMatchObject({
        version: 7,
      });
    });

    it('ticks the list line of a line kept out of the pantry at once, and puts it back when refused', async () => {
      const checkIn = recordMock(CreateReceiptCheckInDocument, {
        dataFor: checkInAnswer({ refuses: () => true }),
        held: true,
      });
      const { result, cache } = await setup({ checkIn });
      await act(async () => {
        result.current.review.chooseLine(1, { ...MILK, notStocked: true });
      });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.onList).toBe(true),
      );
      const toBuy =
        'itemsConnection:{"filters":{"isPurchased":false,"itemIds":["cat-milk"]}}';

      await act(async () => {
        await result.current.review.addChosen();
      });

      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.not.objectContaining({ pantryItemId: expect.anything() }),
      ]);
      // Bought, and not stamped as moved to the pantry.
      expect(cache.extract()['ShoppingListItem:sli-milk']).toMatchObject({
        purchaseInfo: { isPurchased: true, movedToPantryAt: null },
      });
      expect(cache.extract()['ShoppingList:list-1']).toMatchObject({
        [toBuy]: { totalCount: 0, edges: [] },
      });

      await act(async () => checkIn.release());
      await waitFor(() =>
        expect(cache.extract()['ShoppingListItem:sli-milk']).toMatchObject({
          purchaseInfo: { isPurchased: false },
        }),
      );
      expect(cache.extract()['ShoppingList:list-1']).toMatchObject({
        [toBuy]: {
          totalCount: 1,
          edges: [{ node: { __ref: 'ShoppingListItem:sli-milk' } }],
        },
      });
    });

    it('adds a line on its own when the user keeps it off the list', async () => {
      const { result, checkIn, addChosen } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, { ...MILK, offList: true });
      });
      // Still offered, so the line can be put back on the list.
      await waitFor(() =>
        expect(result.current.review.listItemNameFor(1, MILK)).toBe('Milk'),
      );
      expect(result.current.review.rows[0]?.onList).toBe(false);

      await addChosen();

      const [input] = fired(checkIn);
      expect(input).not.toHaveProperty('shoppingListId');
      expect(sentLinesOf(checkIn.fired[0] ?? {})).toEqual([
        expect.not.objectContaining({ shoppingListItemId: expect.anything() }),
      ]);
    });
  });
});
