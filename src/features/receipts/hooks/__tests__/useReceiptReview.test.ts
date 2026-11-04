'use no memo';

import { act } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import {
  readUsualStores,
  writeUsualStores,
} from '#features/catalog/cache/usualStores';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
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
  ErrorCode,
  NetWeightKind,
  ReceiptMatchConfidence,
  ReceiptMatchMethod,
  ReceiptParser,
  UnitType,
  UsualStoreSource,
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
  type SentCheckInLine,
} from '../../__tests__/helpers/receiptFixtures';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import { useReceiptReview } from '../useReceiptReview';
import { UseReceiptReview_StoreFragmentDoc } from '../useReceiptReview.generated';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { RemoveUsualStoreDocument } from '#features/catalog/hooks/useUsualStoreWrites.generated';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { ResolveReceiptLinesDocument } from '../useReceiptMatches.generated';
import { CreateReceiptCheckInDocument } from '../useReceiptCheckIn.generated';
import {
  UseHeldStores_ListFragmentDoc,
  UseHeldStores_StoreFragmentDoc,
} from '../useHeldStores.generated';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

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

type Cache = ReturnType<typeof makeCache>;
type Recorded = ReturnType<typeof recordMock>;
type Review = ReturnType<typeof useReceiptReview>;
type PrintedLine = Parameters<typeof parsedReceipt>[0][number];

const MILK = lineChoice({ price: 2.79 });
const BANANAS = lineChoice({
  itemId: null,
  itemName: 'Bananas',
  quantity: 2.14,
  unitText: 'lb',
  price: 1.26,
});
const PICKED_BANANAS = { ...BANANAS, itemId: 'cat-bananas' };
const KROGER_87 = { id: 'store-99', name: 'Kroger #87' };
const CO_OP = { name: 'East End Food Co-Op', address: '7516 Meade Street' };
const SCANNED_AT = '2026-09-30T10:00:00.000Z';
const SLI_MILK = 'ShoppingListItem:sli-milk';

const KROGER_LINES: PrintedLine[] = [
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
];
const krogerWith = (at: number, line: PrintedLine) => [
  ...KROGER_LINES.slice(0, at),
  line,
  ...KROGER_LINES.slice(at),
];

const seedKroger = (
  draft: Partial<ReceiptDraft> = {},
  lines: PrintedLine[] = KROGER_LINES,
) =>
  seedDraft({
    pages: ['KROGER'],
    scannedAt: SCANNED_AT,
    purchasedOn: '2026-09-28',
    parsed: parsedReceipt(lines, 'KROGER'),
    ...draft,
  });
const unnamedKroger = () => seedKroger({ parsed: parsedReceipt(KROGER_LINES) });

const draft = () => useReceiptDraftStore.getState().draft;
const record = (cache: Cache, id: string) => cache.extract(true)[id];
const pantryItems = (cache: Cache) =>
  cache
    .readQuery<Unmasked<GetPantryQuery>>({
      query: GetPantryDocument,
      variables: { id: 'p1', itemsFirst: 100 },
      optimistic: true,
    })
    ?.pantry?.itemsConnection.edges.map(edge => edge.node) ?? [];
const pantryItemNames = (cache: Cache) =>
  pantryItems(cache).map(node => node.itemName);

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

const fired = (checkIn: Recorded) => checkIn.fired.map(vars => inputOf(vars));
const sent = (checkIn: Recorded) => sentLinesOf(checkIn.fired[0] ?? {});
const refusing = (
  refuses: (line: SentCheckInLine) => boolean,
  options: { held?: boolean; maxUsageCount?: number } = {},
) =>
  recordMock(CreateReceiptCheckInDocument, {
    dataFor: checkInAnswer({ refuses }),
    ...options,
  });

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
const resolved = () =>
  recordMock(ResolveReceiptLinesDocument, { data: RESOLVED });
const offline = (maxUsageCount?: number) =>
  recordMock(ResolveReceiptLinesDocument, {
    error: new Error('Network request failed'),
    maxUsageCount,
  });

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

interface Options {
  /** What the check-in answers; it records every line by default. */
  checkIn?: Recorded;
  /** The matcher's first answer, landed before the test goes on. */
  resolve?: Recorded;
  /** Answers asked for later: a second match, a store's create or removal. */
  mocks?: Recorded[];
  /** What the pantry holds before the receipt is added. */
  held?: MockDataFor<typeof GetPantryDocument>;
  listFor?: typeof listItems;
  /** The list answers only once the test calls `list.release()`. */
  listHeld?: boolean;
  listFails?: boolean;
  /** The cache to render with, to see what one visit leaves the next. */
  cache?: Cache;
}

async function setup({
  checkIn = recordMock(CreateReceiptCheckInDocument, {
    dataFor: checkInAnswer(),
  }),
  resolve,
  mocks = [],
  held = { pantry: { id: 'p1', itemsConnection: connectionOf([]) } },
  listFor = listItems,
  listHeld = false,
  listFails = false,
  cache = makeCache(),
}: Options = {}) {
  const list = recordMock(
    GetShoppingListItemsFilteredDocument,
    listFails
      ? { error: new Error('network down') }
      : { dataFor: listFor, held: listHeld },
  );
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
    () => ({
      pantry: usePantryItemSelection('p1'),
      review: useReceiptReview(),
    }),
    {
      cache,
      operationMocks: [
        recordMock(GetPantryDocument, { data: held }).mock,
        lists.mock,
        list.mock,
        checkIn.mock,
        ...[...(resolve ? [resolve] : []), ...mocks].map(({ mock }) => mock),
      ],
    },
  );
  await drainTimers();
  expect(rendered.result.current.pantry.hasLoaded).toBe(true);
  if (resolve) await drainTimers();

  const review = () => rendered.result.current.review;
  const run = (does: (current: Review) => void) =>
    act(async () => {
      does(review());
    });
  const choose = (choices: Record<number, ReceiptLineChoice | null>) =>
    run(current => {
      for (const [index, choice] of Object.entries(choices)) {
        current.chooseLine(Number(index), choice);
      }
    });
  const confirm = () => drained(() => review().addChosen());
  /** Confirms, and waits for the API to answer the check-in. */
  const addChosen = async () => {
    const outcome = await confirm();
    await drainTimers();
    expect(draft()?.checkIn?.state).not.toBe('sending');
    return outcome;
  };
  return {
    ...rendered,
    cache,
    checkIn,
    list,
    review,
    run,
    choose,
    statuses: () => review().rows.map(row => row.status),
    /** Chooses lines, and waits for the milk to match its list line. */
    chooseOnList: async (choices: Record<number, ReceiptLineChoice | null>) => {
      await choose(choices);
      await drainTimers();
      expect(review().rows[0]?.onList).toBe(true);
    },
    confirm,
    addChosen,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockCurrentPantry.mockReturnValue(KITCHEN);
  seedKroger();
  // The units the device warmed: a typed unit resolves without the API.
  useStore.getState().setCachedUnits([
    { id: 'unit-lb', name: 'pound', symbol: 'lb' },
    { id: 'unit-g', name: 'gram', symbol: 'g' },
  ]);
});

afterEach(() => {
  jest.useRealTimers();
  useStore.getState().setCachedStores([]);
  useStore.getState().setSelectedShoppingListId(null);
});

describe('useReceiptReview', () => {
  it('lists the item lines priced after their discounts, none chosen yet', async () => {
    const { review } = await setup();

    expect(review().merchant).toBe('KROGER');
    // No answer from the matcher: the lines wait for it rather than read as unmatched.
    expect(
      review().rows.map(row => [row.printed, row.price, row.status]),
    ).toEqual([
      ['KRO WHL MILK', 2.79, 'pending'],
      ['BANANAS', 1.26, 'pending'],
    ]);
    expect(review().pendingCount).toBe(0);
  });

  it('asks for the store only when neither the receipt nor the API names the shop', async () => {
    const named = await setup();
    expect(named.review().storeUnrecognized).toBe(false);
    named.unmount();

    unnamedKroger();
    const { review } = await setup();
    expect(review().storeUnrecognized).toBe(true);
  });

  // A markdown the API found was never taken off reads as OTHER, which a sum
  // of the lines counts as a fee: only the reader's verdict is shown.
  it.each([
    [
      'shows the mismatch the server found in its reading',
      { counted: 3.55, printed: 4.05 },
    ],
    ['shows none when the server found its reading adds up', undefined],
  ])('%s', async (_name, totalsGap) => {
    seedKroger(
      { parsedBy: 'server', totalsGap },
      krogerWith(3, {
        rawText: 'Markdown: $1.70',
        kind: 'other',
        lineTotal: 1.7,
      }),
    );
    const { review } = await setup();

    expect(review().totalsGap).toEqual(totalsGap ?? null);
  });

  it('checks the chosen lines in at once, keeps what landed, and names why the rest failed', async () => {
    // The typed bananas are refused.
    const checkIn = refusing(line => !!line.item.inline, { maxUsageCount: 2 });
    const { review, choose, statuses, cache, addChosen } = await setup({
      checkIn,
    });
    await choose({ 1: MILK, 3: BANANAS });
    expect(review().pendingCount).toBe(2);

    const [outcome, shownBefore] = await drained(async () => {
      const sentOutcome = await review().addChosen();
      return [sentOutcome, pantryItemNames(cache)] as const;
    });
    // Both show in the pantry before the API is asked.
    expect(outcome).toMatchObject({ sent: 2, held: 0 });
    expect(shownBefore.sort()).toEqual(['Bananas', 'Whole milk']);

    const ids = draft()?.checkIn;
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
    expect(statuses()).toEqual(['added', 'failed']);
    expect(review().rows[1]?.failure).toEqual(expect.any(String));
    expect(review().pendingCount).toBe(1);
    expect(draft()?.added).toEqual([1]);

    // A retry sends the line that failed alone, under the ids it was given.
    await addChosen();
    const [first, retry] = checkIn.fired;
    expect(sentLinesOf(retry ?? {})).toEqual([sentLinesOf(first ?? {})[1]]);
  });

  it('shows two lines of one product as one row, at the total the answer states', async () => {
    const checkIn = recordMock(CreateReceiptCheckInDocument, {
      dataFor: (vars): MockDataFor<typeof CreateReceiptCheckInDocument> => {
        const lines = sentLinesOf(vars);
        return {
          createReceiptCheckIn: {
            __typename: 'CreateReceiptCheckInPayload',
            // Every result states the row as committed: Apollo stores a row once
            // per answer, the first copy, so a running total would show its first.
            results: lines.map((line, index) => ({
              index,
              clientId: line.clientId,
              success: true,
              failure: null,
              item: { id: 'cat-milk' },
              pantryItem: {
                id: lines[0]?.pantryItemId ?? '',
                itemName: 'Whole milk',
                item: { id: 'cat-milk' },
                quantity: 2,
                version: 3,
              },
              shoppingListItem: null,
            })),
          },
        };
      },
    });
    const { choose, cache, addChosen } = await setup({ checkIn });
    await choose({ 1: MILK, 3: MILK });

    expect(await addChosen()).toMatchObject({ sent: 2, held: 0 });

    expect(pantryItemNames(cache)).toEqual(['Whole milk']);
    expect(
      record(cache, `PantryItem:${pantryItems(cache)[0]?.id}`),
    ).toMatchObject({ quantity: 2 });
  });

  it('counts a check-in queued offline as added and shows it at once', async () => {
    const { review, choose, cache, addChosen } = await setup({
      // The offline queue completes a queued write with null data.
      checkIn: recordMock(CreateReceiptCheckInDocument, {
        data: { createReceiptCheckIn: null },
        partial: true,
      }),
    });
    await choose({ 1: MILK, 3: PICKED_BANANAS });

    expect(await addChosen()).toMatchObject({ sent: 2, held: 0 });

    expect(pantryItemNames(cache).sort()).toEqual(['Bananas', 'Whole milk']);
    expect(review().pendingCount).toBe(0);
    expect(draft()?.checkIn?.state).toBe('queued');
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
      const { review, choose, checkIn, addChosen } = await setup();
      await choose({ 1: { ...MILK, ...lacking }, 3: PICKED_BANANAS });

      expect(await addChosen()).toMatchObject({ sent: 1, held: 1 });

      expect(sent(checkIn)).toEqual([
        expect.objectContaining({ clientId: '3' }),
      ]);
      expect(review().rows[0]).toMatchObject({
        status: 'failed',
        failure: expect.stringContaining(why),
      });
      expect(review().pendingCount).toBe(1);
    },
  );

  it('says a line refused with no code this build knows was not added', async () => {
    const { review, run } = await setup();
    await run(current => {
      current.chooseLine(1, MILK);
      useReceiptDraftStore.setState(state => ({
        draft: state.draft && { ...state.draft, failed: { 1: null } },
      }));
    });

    expect(review().rows[0]).toMatchObject({
      status: 'failed',
      failure: t('errors.addItemFailedRetry'),
    });
  });

  it('sends the server reading it was confirmed from, and a saving off the whole order', async () => {
    seedKroger(
      { parsedBy: 'server', parseId: 'parse-1' },
      krogerWith(4, {
        rawText: '$5 OFF $50 2.00-',
        kind: 'discount',
        lineTotal: -2,
      }),
    );
    const { choose, checkIn, addChosen } = await setup();
    await choose({ 1: MILK });

    await addChosen();

    expect(fired(checkIn)[0]).toEqual(
      expect.objectContaining({ receiptParseId: 'parse-1', orderDiscount: 2 }),
    );
  });

  it('adds on the scan day when the receipt printed none, and at its printed time on the day the user sets', async () => {
    seedKroger({ purchasedOn: undefined, purchaseTime: '18:42' });
    const { review, run, checkIn, addChosen } = await setup();

    expect(review().purchasedOn).toBe(toDateKey(new Date(SCANNED_AT)));
    expect(review().dayIsScanDay).toBe(true);

    await run(current => {
      current.setPurchasedOn('2026-09-26');
      current.chooseLine(1, MILK);
    });
    expect(review().dayIsScanDay).toBe(false);

    await addChosen();

    expect(fired(checkIn)).toEqual([
      expect.objectContaining({
        purchasedOn: '2026-09-26',
        purchasedAt: new Date(2026, 8, 26, 18, 42).toISOString(),
      }),
    ]);
  });

  describe('with the API proposing items', () => {
    it.each([
      ['the phone', undefined, ReceiptParser.Device],
      ['the server', 'server', ReceiptParser.Server],
    ] as const)(
      'asks once for the item lines %s read, with the header, the pantry and each plain name',
      async (_reader, parsedBy, parser) => {
        seedKroger(
          { parsedBy },
          KROGER_LINES.map(line =>
            line.product === 'BANANAS' ? { ...line, name: 'bananas' } : line,
          ),
        );
        const resolve = resolved();
        const { review } = await setup({ resolve });
        expect(review().matchState).toBe('done');

        expect(resolve.fired).toEqual([
          {
            input: {
              merchantHeader: 'KROGER',
              pantryId: 'p1',
              parsedBy: parser,
              lines: [
                { clientId: '1', text: 'KRO WHL MILK' },
                { clientId: '3', text: 'BANANAS', name: 'bananas' },
              ],
            },
          },
        ]);
      },
    );

    it('reads its matches from the cache on a return, and drops them once finished', async () => {
      useStore.getState().setSelectedShoppingListId('list-1');
      const resolve = recordMock(ResolveReceiptLinesDocument, {
        data: RESOLVED,
        maxUsageCount: 2,
      });
      const cache = makeCache();
      const askedByItem = () =>
        Object.keys(record(cache, 'ShoppingList:list-1') ?? {}).some(key =>
          key.includes('"itemIds"'),
        );
      const first = await setup({ resolve, cache });
      expect(first.review().matchState).toBe('done');
      first.unmount();

      const { review, run } = await setup({ resolve, cache });
      expect(review().matchState).toBe('done');
      expect(resolve.fired).toHaveLength(1);
      await drainTimers();
      expect(askedByItem()).toBe(true);

      await run(current => current.finish());
      expect(
        Object.keys(cache.extract().ROOT_QUERY ?? {}).some(key =>
          key.startsWith('resolveReceiptLines'),
        ),
      ).toBe(false);
      // The list lines it asked for by item go too.
      expect(askedByItem()).toBe(false);
    });

    it('waits for the pantry to be known rather than asking twice', async () => {
      mockCurrentPantry.mockReturnValue({ pantry: null, currentHome: null });
      const resolve = resolved();
      const { review, rerender } = await setup({ resolve });
      expect(resolve.fired).toHaveLength(0);
      expect(review().matchState).toBe('matching');

      mockCurrentPantry.mockReturnValue(KITCHEN);
      rerender({});
      await drainTimers();
      expect(review().matchState).toBe('done');
      expect(resolve.fired).toEqual([
        { input: expect.objectContaining({ pantryId: 'p1' }) },
      ]);
    });

    it('keeps the lines waiting when the lookup fails, and matches them on a retry', async () => {
      const { review, run, statuses } = await setup({
        resolve: offline(1),
        mocks: [resolved()],
      });
      expect(review().matchState).toBe('failed');
      expect(statuses()).toEqual(['pending', 'pending']);

      await run(current => current.retryMatching());

      await drainTimers();
      expect(review().matchState).toBe('done');
      expect(statuses()).toEqual(['add', 'unmatched']);
    });

    it('adds the item it is sure of, and only suggests the one it guesses', async () => {
      const { review, choose, statuses } = await setup({ resolve: resolved() });

      const [milk, bananas] = review().rows;
      expect(statuses()).toEqual(['add', 'unmatched']);
      expect(milk?.choice).toEqual(MILK);
      // A guess is named, never the line's product, until the user picks it.
      expect(bananas?.choice).toBeUndefined();
      expect(bananas?.suggestion?.itemName).toBe('Bananas');
      expect(bananas?.candidates.map(candidate => candidate.itemName)).toEqual([
        'Bananas',
        'Plantains',
      ]);
      expect(review().pendingCount).toBe(1);

      await choose({
        3: lineChoice({ itemId: 'cat-plantains', itemName: 'Plantains' }),
      });
      expect(review().rows[1]?.status).toBe('add');
    });

    // No brand and no pack size: nothing the sheet could show sets them apart.
    const spinach = (id: string) => ({
      id,
      name: 'Baby Spinach',
      brands: [],
      netWeightKind: NetWeightKind.Reference,
    });
    it.each([
      [
        'tells candidates of one name apart by their one brand, else their pack size',
        [
          {
            id: 'milk-kirkland',
            name: 'Whole milk',
            brands: [{ brand: { name: 'Kirkland' } }],
          },
          {
            id: 'milk-gallon',
            name: 'Whole milk',
            netWeight: 1,
            netWeightKind: NetWeightKind.Package,
            displayUnit: { symbol: 'gal', name: 'gallon' },
          },
          {
            id: 'milk-label',
            name: 'Whole milk',
            netWeight: 100,
            netWeightKind: NetWeightKind.Reference,
            displayUnit: { symbol: 'g', name: 'gram' },
          },
          {
            id: 'bananas-dole',
            name: 'Bananas',
            brands: [{ brand: { name: 'Dole' } }],
          },
        ],
        [
          { itemId: 'milk-kirkland', detail: 'Kirkland' },
          { itemId: 'milk-gallon', detail: '1 gal' },
          // A 100 g nutrition basis is no pack size.
          { itemId: 'milk-label', detail: null },
          // No other candidate shares its name: nothing to tell apart.
          { itemId: 'bananas-dole', detail: null },
        ],
      ],
      [
        'offers one choice for candidates nothing tells apart: the first',
        [spinach('spinach-1'), spinach('spinach-2'), spinach('spinach-3')],
        [{ itemId: 'spinach-1', detail: null }],
      ],
    ])('%s', async (_name, items, expected) => {
      const { review } = await setup({
        resolve: recordMock(ResolveReceiptLinesDocument, {
          data: {
            resolveReceiptLines: {
              lines: [
                {
                  clientId: '3',
                  best: null,
                  candidates: items.map(item => ({ item })),
                },
              ],
            },
          },
        }),
      });

      expect(review().matchState).toBe('done');
      expect(
        review().rows[1]?.candidates.map(({ itemId, detail }) => ({
          itemId,
          detail,
        })),
      ).toEqual(expected);
    });

    it('keeps a line the user left out, out, whatever the API proposes', async () => {
      const { review, choose, statuses } = await setup({ resolve: resolved() });
      expect(statuses()[0]).toBe('add');

      await choose({ 1: null, 3: null });

      // A sure match and an unsure guess alike stay out once left out.
      expect(review().rows.map(row => row.choice)).toEqual([
        undefined,
        undefined,
      ]);
      expect(statuses()).toEqual(['skipped', 'skipped']);
      expect(review().pendingCount).toBe(0);
    });

    it.each([
      ['a candidate it did not guess', 'cat-plantains', 'Plantains'],
      ['its suggestion as it stands', 'cat-bananas', 'Bananas'],
    ])(
      'adds at the receipt store, sending its sure match as kept and %s as the user picked it',
      async (_pick, itemId, itemName) => {
        const { choose, checkIn, addChosen } = await setup({
          resolve: resolved(),
        });
        await choose({ 3: { ...BANANAS, itemId, itemName } });

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
        expect(sent(checkIn)).toEqual([
          expect.objectContaining({
            item: { id: 'cat-milk' },
            rawText: 'KRO WHL MILK',
            resolvedBy: ReceiptMatchMethod.Code,
            edited: false,
          }),
          expect.objectContaining({
            item: { id: itemId },
            rawText: 'BANANAS',
            resolvedBy: ReceiptMatchMethod.Search,
            edited: true,
          }),
        ]);
      },
    );

    it('keeps the store field and the proposals while the picked store is asked', async () => {
      unnamedKroger();
      const resolveAgain = recordMock(ResolveReceiptLinesDocument, {
        // The API echoes the picked store, and is sure of the bananas there.
        data: {
          resolveReceiptLines: {
            store: KROGER_87,
            lines: RESOLVED.resolveReceiptLines?.lines?.map(line => ({
              ...line,
              confidence: ReceiptMatchConfidence.High,
            })),
          },
        },
        held: true,
      });
      const { review, run, statuses } = await setup({
        resolve: recordMock(ResolveReceiptLinesDocument, {
          data: {
            resolveReceiptLines: {
              ...RESOLVED.resolveReceiptLines,
              store: null,
            },
          },
          maxUsageCount: 1,
        }),
        mocks: [resolveAgain],
      });
      expect(review().matchState).toBe('done');
      expect(review().storeUnrecognized).toBe(true);

      await run(current => current.chooseStore(KROGER_87));
      await drainTimers();
      expect(resolveAgain.fired).toHaveLength(1);
      expect(statuses()).toEqual(['add', 'unmatched']);

      await drained(() => resolveAgain.release());
      expect(statuses()).toEqual(['add', 'add']);
      // The pick stays open to change.
      expect(review().storeUnrecognized).toBe(true);
      expect(review().store).toEqual(KROGER_87);
    });

    it('shows the store the header names and where it is, then the one the user picks, and adds there', async () => {
      const cache = makeCache();
      // A store the user picks was read with its address by the picker.
      seedQuery(cache, {
        query: SearchStoresDocument,
        variables: { search: 'kroger', limit: 20 },
        data: {
          stores: {
            totalCount: 1,
            edges: [
              {
                node: {
                  __typename: 'Store',
                  ...KROGER_87,
                  address: '200 Side St',
                  storeNumber: '87',
                  chain: null,
                },
              },
            ],
          },
        },
      });
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
      const { review, run, checkIn, addChosen } = await setup({
        resolve,
        cache,
      });
      expect(review().store).toEqual({ id: 'store-27', name: 'Kroger #412' });
      expect(review().storeLocation).toEqual({
        address: '100 Main St',
        storeNumber: '412',
      });

      await run(current => current.chooseStore(KROGER_87));

      expect(review().store).toEqual(KROGER_87);
      expect(review().storeLocation).toEqual({
        address: '200 Side St',
        storeNumber: '87',
      });
      // The matcher is asked again, at the store the user named.
      await drainTimers();
      expect(resolve.fired).toContainEqual({
        input: expect.objectContaining({ storeId: 'store-99' }),
      });
      await drainTimers();
      expect(review().rows[0]?.status).toBe('add');

      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({ storeId: 'store-99' }),
      ]);
      // The bananas, only guessed at, wait for the user to choose them.
      expect(sent(checkIn).map(line => line.item)).toEqual([
        { id: 'cat-milk' },
      ]);
    });

    it('says where the shop it proposes to add is', async () => {
      const { review } = await setup({ resolve: proposing(CO_OP) });

      expect(review().storeLocation).toEqual({
        address: CO_OP.address,
        storeNumber: null,
      });
    });

    it('adds the shop the receipt names but nobody has, then the lines at it', async () => {
      seedKroger({ parsedBy: 'server', printedStore: CO_OP });
      const resolve = proposing(CO_OP);
      const storeCreate = creating(CO_OP);
      const { review, checkIn, addChosen } = await setup({
        resolve,
        mocks: [storeCreate],
      });
      expect(review().matchState).toBe('done');
      expect(resolve.fired[0]).toEqual({
        input: expect.objectContaining({ merchant: CO_OP }),
      });
      expect(review().proposedStoreName).toBe(CO_OP.name);

      await addChosen();

      // Added on confirm, under an id the client minted, before the lines.
      expect(storeCreate.fired).toEqual([
        { input: { id: expect.any(String), ...CO_OP } },
      ]);
      const storeId = String(inputOf(storeCreate.fired[0] ?? {}).id);
      expect(fired(checkIn)).toEqual([expect.objectContaining({ storeId })]);
      // Kept as the pick, so a retry adds no second store.
      expect(draft()?.store).toEqual({ id: storeId, name: CO_OP.name });
    });

    it('shows the lines while the shop is added, and checks them in once it is', async () => {
      seedKroger({ printedStore: { name: 'Corner Deli' } });
      const storeCreate = creating({ name: 'Corner Deli' }, { held: true });
      const { cache, checkIn, confirm } = await setup({
        resolve: proposing({ name: 'Corner Deli' }),
        mocks: [storeCreate],
      });

      await confirm();

      // The lines show while the store is still being added.
      expect(storeCreate.fired).toHaveLength(1);
      expect(checkIn.fired).toHaveLength(0);
      expect(pantryItemNames(cache)).toEqual(['Whole milk']);
      // A second tap sends nothing, and adds no second store.
      expect(await confirm()).toMatchObject({ sent: 0, held: 0 });

      await drained(() => storeCreate.release());
      expect(checkIn.fired).toHaveLength(1);
      expect(storeCreate.fired).toHaveLength(1);
    });
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
    const PRINTED = { name: 'Kroger', address: '412 Main St' };

    // Read by the server: the check-in sends the parse that locates a store.
    const readByServer = (readBy: Partial<ReceiptDraft> = {}) =>
      seedKroger({ parsedBy: 'server', parseId: 'parse-1', ...readBy });
    // The API places no store, proposes the receipt's, and names the offer.
    const unplaced = () => proposing(PRINTED, OFFER);

    it('offers the unlocated store the device holds, offline, and checks in there once picked', async () => {
      readByServer();
      useStore.getState().setCachedStores([KROGER_BRANCH, KROGER_LABEL]);
      const { review, run, checkIn, addChosen } = await setup({
        resolve: offline(),
      });
      expect(review().matchState).toBe('failed');

      expect(review().storeOffer).toEqual(OFFER);
      // Offered, never placed.
      expect(review().store).toBeNull();

      await run(current => {
        current.chooseStore(OFFER);
        current.chooseLine(1, MILK);
      });
      expect(review().store).toEqual(OFFER);
      expect(review().storeOffer).toBeNull();

      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({
          storeId: 'store-label',
          receiptParseId: 'parse-1',
        }),
      ]);
      // The server's parse locates it: the phone's reading stays home.
      expect(fired(checkIn)[0]).not.toHaveProperty('merchant');
    });

    it("offers the active list's shop when the cache knows it has no address", async () => {
      readByServer();
      useStore.getState().setSelectedShoppingListId('list-1');
      const cache = makeCache();
      seedFragment(cache, {
        fragment: UseHeldStores_ListFragmentDoc,
        fragmentName: 'useHeldStores_list',
        id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
        data: {
          id: 'list-1',
          targetStore: OFFER,
        },
      });
      const known = await setup({ resolve: offline(), cache });
      expect(known.review().matchState).toBe('failed');
      // Its name alone: an address the cache never held is not none.
      expect(known.review().storeOffer).toBeNull();
      known.unmount();

      seedFragment(cache, {
        fragment: UseHeldStores_StoreFragmentDoc,
        fragmentName: 'useHeldStores_store',
        id: cache.identify({ __typename: 'Store', id: 'store-label' }),
        data: KROGER_LABEL,
      });
      const { review } = await setup({ resolve: offline(), cache });
      expect(review().matchState).toBe('failed');

      expect(review().storeOffer).toEqual(OFFER);
    });

    it("offers the API's unlocated store when the device holds none, and never places it", async () => {
      readByServer();
      const { review } = await setup({ resolve: unplaced() });
      expect(review().matchState).toBe('done');

      expect(review().storeOffer).toEqual(OFFER);
      expect(review().store).toBeNull();
      expect(draft()?.store).toBeUndefined();
      expect(review().proposedStoreName).toBe('Kroger');
    });

    // The check-in places a store with no place of its own where the receipt
    // says, so the line keeps saying it once the offer is taken.
    it("keeps the receipt's place on the line once the offered store is picked", async () => {
      readByServer({ printedStore: PRINTED });
      const cache = makeCache();
      seedFragment(cache, {
        fragment: UseReceiptReview_StoreFragmentDoc,
        fragmentName: 'useReceiptReview_store',
        id: cache.identify({ __typename: 'Store', id: 'store-label' }),
        data: { id: 'store-label', address: null, storeNumber: null },
      });
      const { review, run } = await setup({ resolve: unplaced(), cache });
      const printedPlace = { address: PRINTED.address, storeNumber: null };
      expect(review().storeOffer).toEqual(OFFER);
      expect(review().storeLocation).toEqual(printedPlace);

      await run(current => current.chooseStore(OFFER));

      expect(review().store).toEqual(OFFER);
      expect(review().storeLocation).toEqual(printedPlace);
    });

    it('offers none for a receipt read on the phone that names no place', async () => {
      readByServer({ parsedBy: 'device' });
      useStore.getState().setCachedStores([KROGER_LABEL]);
      const { review } = await setup({ resolve: unplaced() });
      expect(review().matchState).toBe('done');

      expect(review().storeOffer).toBeNull();
    });

    // The API takes the merchant the phone read as read, so a check-in at the
    // household's own store places it at that address.
    it('offers it for a receipt read on the phone that names its address, and sends what the phone read', async () => {
      readByServer({ parsedBy: 'device', printedStore: PRINTED });
      const { review, run, checkIn, addChosen } = await setup({
        resolve: unplaced(),
      });
      expect(review().storeOffer).toEqual(OFFER);

      await run(current => {
        current.chooseStore(OFFER);
        current.chooseLine(1, MILK);
      });
      await addChosen();

      expect(fired(checkIn)).toEqual([
        expect.objectContaining({ storeId: 'store-label', merchant: PRINTED }),
      ]);
      expect(fired(checkIn)[0]).not.toHaveProperty('receiptParseId');
    });
  });

  describe('with the milk open on the shopping list', () => {
    beforeEach(() => {
      useStore.getState().setSelectedShoppingListId('list-1');
    });

    it('offers the list line for a product as it is picked, before it is saved', async () => {
      const { review, run } = await setup();
      await run(current => current.pickItem('cat-milk'));

      await drainTimers();
      expect(review().listItemNameFor(1, MILK)).toBe('Milk');
      expect(
        review().listItemNameFor(1, { ...MILK, unitText: 'kg' }),
      ).toBeUndefined();
      expect(review().rows[0]?.onList).toBe(false);
    });

    it('ticks the list line off instead of adding the milk again', async () => {
      const { review, cache, checkIn, chooseOnList, addChosen } = await setup();
      await chooseOnList({ 1: MILK, 3: PICKED_BANANAS });
      expect(review().rows[1]?.onList).toBe(false);
      // The milk's list line is taken, so no other line is offered it.
      expect(review().listItemNameFor(1, MILK)).toBe('Milk');
      expect(review().listItemNameFor(3, MILK)).toBeUndefined();

      const movedBefore = await drained(async () => {
        await review().addChosen();
        return record(cache, SLI_MILK);
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
      expect(sent(checkIn)).toEqual([
        expect.objectContaining({
          shoppingListItemId: 'sli-milk',
          amount: { packages: { count: 1 } },
          totalPaid: 2.79,
        }),
        expect.not.objectContaining({ shoppingListItemId: expect.anything() }),
      ]);
      expect(draft()?.added).toEqual([1, 3]);
    });

    it('holds the add until the list lines have loaded', async () => {
      const { review, choose, list } = await setup({ listHeld: true });
      await choose({ 1: MILK });

      await drainTimers();
      expect(review().listLoading).toBe(true);
      await drained(() => list.release());
      expect(review().listLoading).toBe(false);
    });

    it.each([
      {
        name: 'matches against the list the user still has when the selected one is gone',
        selected: 'list-gone',
        expected: { onList: true },
      },
      {
        name: 'says when the list could not be read',
        options: { listFails: true },
        expected: { listState: 'error', onList: false },
      },
      {
        name: 'says when the list is longer than the review can see',
        // Another page follows the one the review reads.
        options: {
          listFor: () => ({
            shoppingList: {
              id: 'list-1',
              itemsConnection: connectionOf([], { hasNextPage: true }),
            },
          }),
        },
        expected: { listIncomplete: true, listLoading: false },
      },
    ])('$name', async ({ selected, options, expected }) => {
      if (selected) useStore.getState().setSelectedShoppingListId(selected);
      const { review, choose } = await setup(options);
      await choose({ 1: MILK });

      await drainTimers();
      const { listState, listIncomplete, listLoading, rows } = review();
      expect({
        listState,
        listIncomplete,
        listLoading,
        onList: rows[0]?.onList,
      }).toMatchObject(expected);
    });

    it('counts a line no unit names in the counted stack the pantry holds', async () => {
      const { checkIn, chooseOnList, addChosen } = await setup({
        held: {
          pantry: {
            id: 'p1',
            itemsConnection: connectionOf([
              {
                item: { id: 'cat-milk' },
                unit: { id: 'unit-carton', type: UnitType.Count },
              },
            ]),
          },
        },
      });
      await chooseOnList({ 1: MILK });
      await addChosen();

      expect(sent(checkIn)).toEqual([
        expect.objectContaining({
          amount: { measured: { quantity: 1, unitId: 'unit-carton' } },
        }),
      ]);
    });

    it('names a line the API cannot size, puts it back on the list, and adds the rest', async () => {
      const { review, cache, statuses, chooseOnList, addChosen } = await setup({
        checkIn: refusing(line => !!line.shoppingListItemId),
      });
      await chooseOnList({ 1: MILK, 3: PICKED_BANANAS });

      await addChosen();

      expect(pantryItemNames(cache)).toEqual(['Bananas']);
      expect(record(cache, SLI_MILK)).toMatchObject({
        purchaseInfo: { movedToPantryAt: null },
      });
      expect(statuses()).toEqual(['failed', 'added']);
      expect(review().pendingCount).toBe(1);
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
      const { cache, chooseOnList, addChosen } = await setup({ checkIn });
      await chooseOnList({ 1: MILK });
      await addChosen();

      expect(record(cache, SLI_MILK)).toMatchObject({ version: 7 });
    });

    it('counts a line kept out of the pantry as recorded, apart from the rest', async () => {
      const { review, choose, confirm } = await setup();
      await choose({ 1: { ...MILK, notStocked: true } });
      await drainTimers();
      expect(review().recordedCount).toBe(1);

      expect(await confirm()).toMatchObject({ sent: 1, recorded: 1, held: 0 });
    });

    it('ticks the list line of a line kept out of the pantry at once, and puts it back when refused', async () => {
      const checkIn = refusing(() => true, { held: true });
      const { cache, chooseOnList, confirm } = await setup({ checkIn });
      await chooseOnList({ 1: { ...MILK, notStocked: true } });
      const toBuy =
        'itemsConnection:{"filters":{"isPurchased":false,"itemIds":["cat-milk"]}}';

      await confirm();

      expect(sent(checkIn)).toEqual([
        expect.not.objectContaining({ pantryItemId: expect.anything() }),
      ]);
      // Bought, and not stamped as moved to the pantry.
      expect(record(cache, SLI_MILK)).toMatchObject({
        purchaseInfo: { isPurchased: true, movedToPantryAt: null },
      });
      expect(record(cache, 'ShoppingList:list-1')).toMatchObject({
        [toBuy]: { totalCount: 0, edges: [] },
      });

      await drained(() => checkIn.release());
      expect(record(cache, SLI_MILK)).toMatchObject({
        purchaseInfo: { isPurchased: false },
      });
      expect(record(cache, 'ShoppingList:list-1')).toMatchObject({
        [toBuy]: { totalCount: 1, edges: [{ node: { __ref: SLI_MILK } }] },
      });
    });

    it('adds a line on its own when the user keeps it off the list', async () => {
      const { review, choose, checkIn, addChosen } = await setup();
      await choose({ 1: { ...MILK, offList: true } });
      // Still offered, so the line can be put back on the list.
      await drainTimers();
      expect(review().listItemNameFor(1, MILK)).toBe('Milk');
      expect(review().rows[0]?.onList).toBe(false);

      await addChosen();

      expect(fired(checkIn)[0]).not.toHaveProperty('shoppingListId');
      expect(sent(checkIn)).toEqual([
        expect.not.objectContaining({ shoppingListItemId: expect.anything() }),
      ]);
    });
  });

  // The check-in adds a receipt's new store on the server; the device shows it.
  describe('a store new to the household', () => {
    // The household's stores, already read; Kroger #412 among them or not.
    const knowing = (storeIds: string[]) => {
      const cache = makeCache();
      writeUsualStores(
        cache,
        'home-1',
        storeIds.map(id => ({
          __typename: 'UsualStore',
          id: `home-1:${id}`,
          addedVia: UsualStoreSource.Receipt,
          pinned: false,
          compared: true,
          lastUsedAt: '2026-10-20T12:00:00.000Z',
          store: {
            __typename: 'Store',
            id,
            name: id,
            address: null,
            chain: null,
          },
          chain: null,
        })),
      );
      return cache;
    };
    const storeIdsOf = (cache: Cache) =>
      readUsualStores(cache, 'home-1')?.map(entry => entry.store?.id) ?? null;

    const confirmed = async (options: Options) => {
      const { review, cache, addChosen } = await setup({
        resolve: resolved(),
        ...options,
      });
      expect(review().matchState).toBe('done');
      const { learned } = await addChosen();
      return { learned: await drained(() => learned), cache };
    };

    it("learns the receipt's store, and shows it among the household's", async () => {
      const { learned, cache } = await confirmed({
        cache: knowing(['store-ge']),
      });

      expect(learned).toEqual({
        name: 'Kroger #412',
        undo: expect.any(Function),
      });
      expect(
        readUsualStores(cache, 'home-1')?.find(
          entry => entry.store?.id === 'store-27',
        ),
      ).toMatchObject({ addedVia: UsualStoreSource.Receipt });
    });

    it("undoes the learned store, and the receipt's items stay in the pantry", async () => {
      const storeRemove = recordMock(RemoveUsualStoreDocument, {
        data: {
          removeUsualStore: {
            __typename: 'RemoveUsualStorePayload',
            usualStores: [{ id: 'home-1:store-ge' }],
          },
        },
      });
      const { learned, cache } = await confirmed({
        cache: knowing(['store-ge']),
        mocks: [storeRemove],
      });
      const added = pantryItemNames(cache);
      expect(added).toContain('Whole milk');

      await drained(() => learned?.undo());

      expect(storeRemove.fired.map(vars => inputOf(vars))).toEqual([
        { homeId: 'home-1', target: { storeId: 'store-27' } },
      ]);
      expect(storeIdsOf(cache)).toEqual(['store-ge']);
      expect(pantryItemNames(cache)).toEqual(added);
    });

    it.each([
      {
        when: 'when the check-in is refused whole',
        known: ['store-ge'],
        checkIn: recordMock(CreateReceiptCheckInDocument, {
          data: {
            createReceiptCheckIn: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'Refused',
              field: 'storeId',
            },
          },
        }),
      },
      { when: 'of a store the household already has', known: ['store-27'] },
      // An Undo then could remove a store the household already had.
      { when: "while the household's stores were never read" },
    ])('learns nothing $when', async ({ known, checkIn }) => {
      const { learned, cache } = await confirmed({
        cache: known && knowing(known),
        checkIn,
      });

      expect(learned).toBeNull();
      expect(storeIdsOf(cache)).toEqual(known ?? null);
    });

    it('learns a store the confirm adds, under the id it minted', async () => {
      const storeCreate = creating(CO_OP);
      const { learned, cache } = await confirmed({
        resolve: proposing(CO_OP),
        mocks: [storeCreate],
        cache: knowing(['store-ge']),
      });

      const minted = String(inputOf(storeCreate.fired[0] ?? {}).id);
      expect(learned).toMatchObject({ name: CO_OP.name });
      expect(storeIdsOf(cache)).toContain(minted);
    });
  });
});
