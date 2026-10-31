import { makeCache } from '#/apollo/cache';
import { StoreLineMatch, UnitSystem } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  ALDI,
  ANSWERED_AT,
  GIANT_EAGLE,
  KROGER,
  OZ,
  candidate,
  cell,
  saving,
  savingsAnswer,
  savingsLine,
  type SavingsAnswer,
} from '#/test-utils/fixtures/listSavingsFixtures';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { formatMonthDay } from '#/utils/formatters/date';
import { ListSavingsDocument } from '../useListSavings.generated';
import { useListSavings, useStoreSavingsLines } from '../useListSavings';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(),
}));
jest.mock('#hooks/settings/useReadingSystem', () => ({
  useReadingSystem: jest.fn(),
}));

const VARIABLES = { listId: 'list-1' };
const milk = savingsLine('l-milk', 'Milk');
const bacon = savingsLine('l-bacon', 'Bacon');
const oil = savingsLine('l-oil', 'Olive oil');
const saffron = savingsLine('l-saffron', 'Saffron');

const answering = (answer: SavingsAnswer) =>
  recordMock(ListSavingsDocument, {
    data: { shoppingListStoreSavings: answer },
  });

const cached = (answer: SavingsAnswer) => {
  const cache = makeCache();
  seedQuery(cache, {
    query: ListSavingsDocument,
    variables: VARIABLES,
    data: { __typename: 'Query', shoppingListStoreSavings: answer },
  });
  return cache;
};

/** The list at Giant Eagle, compared at ALDI and Kroger. */
const threeStores = savingsAnswer([
  candidate(GIANT_EAGLE, {
    isTarget: true,
    lines: [
      cell(milk, { amount: 3.49 }),
      cell(bacon, { amount: 7.49 }),
      cell(oil, { amount: 9.99 }),
    ],
  }),
  candidate(ALDI, {
    total: 52,
    savingVsTarget: saving(8, 7),
    lines: [
      cell(milk, { amount: 2.99 }),
      cell(bacon, {
        kind: StoreLineMatch.Similar,
        amount: 5.99,
        product: {
          __typename: 'Item',
          version: 1,
          id: 'i-af',
          name: 'Appleton Farms Bacon',
        },
        packageNetWeight: 12,
        packageNetWeightUnit: OZ,
      }),
      cell(oil, { kind: StoreLineMatch.Estimated, amount: 8.49 }),
    ],
  }),
  candidate(KROGER, {
    total: 58.8,
    savingVsTarget: saving(1.2, 9, true),
    lines: [
      cell(milk),
      cell(saffron, { kind: StoreLineMatch.None, amount: null }),
    ],
  }),
]);

const renderSavings = (
  mocks: ReturnType<typeof recordMock>['mock'][],
  cache = makeCache(),
) =>
  renderHookWithApollo(() => useListSavings('list-1'), {
    cache,
    operationMocks: mocks,
  });

const storeAt = (
  result: { current: ReturnType<typeof useListSavings> },
  key: string,
) => result.current.savings?.stores.find(s => s.option.key === key);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  jest.mocked(useReadingSystem).mockReturnValue(UnitSystem.Imperial);
});

describe('useListSavings', () => {
  it('compares three stores, with the list’s store marked', async () => {
    const { result } = renderSavings([answering(threeStores).mock]);

    await drainTimers();
    expect(result.current.savings?.stores).toHaveLength(3);
    expect(
      result.current.savings?.stores.map(s => [s.option.key, s.isTarget]),
    ).toEqual([
      ['store:s-ge', true],
      ['store:s-aldi', false],
      ['store:s-kroger', false],
    ]);
  });

  it('sends no request with Budget & prices off', async () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    const asked = answering(threeStores);
    const { result } = renderSavings([asked.mock]);

    await drainTimers();
    expect(result.current.loading).toBe(false);
    expect(asked.fired).toHaveLength(0);
    expect(result.current.savings).toBeNull();
  });

  it('reads "milk" as Same, and Appleton Farms bacon as Similar at $5.99, 12 oz', async () => {
    const { result } = renderSavings([answering(threeStores).mock]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    const [aldiMilk, aldiBacon] = storeAt(result, 'store:s-aldi')?.lines ?? [];
    expect(aldiMilk).toMatchObject({
      kind: 'same',
      price: '$2.99',
      product: null,
    });
    expect(aldiBacon).toMatchObject({
      kind: 'similar',
      price: '$5.99',
      product: 'Appleton Farms Bacon · 12\u00a0oz', // a size never splits
    });
  });

  it('reads Estimated with its price, and No price with none', async () => {
    const { result } = renderSavings([answering(threeStores).mock]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(storeAt(result, 'store:s-aldi')?.lines[2]).toMatchObject({
      kind: 'estimated',
      price: '$8.49',
    });
    expect(storeAt(result, 'store:s-kroger')?.lines[1]).toMatchObject({
      kind: 'none',
      price: null,
    });
  });

  it('gives no total where 2 of 10 lines are priced', async () => {
    const { result } = renderSavings([
      answering(
        savingsAnswer([candidate(ALDI, { total: null, savingVsTarget: null })]),
      ).mock,
    ]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(result.current.savings?.stores[0]).toMatchObject({
      total: null,
      saving: null,
    });
  });

  it('states the lines the saving covers, and an Estimated line moves no difference', async () => {
    const { result } = renderSavings([answering(threeStores).mock]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    const aldi = storeAt(result, 'store:s-aldi');
    expect(aldi?.saving).toEqual({
      kind: 'save',
      amount: '$8',
      coveredLines: 7,
    });
    // Olive oil is Estimated at ALDI: left out of the saving, no difference.
    expect(aldi?.lines[2]).toMatchObject({
      atListStore: '$9.99',
      difference: null,
    });
    expect(aldi?.lines[0]).toMatchObject({
      atListStore: '$3.49',
      difference: { kind: 'cheaper', amount: '$0.50' },
    });
  });

  it('takes the server’s "About the same" for $1.20 on $60', async () => {
    const { result } = renderSavings([answering(threeStores).mock]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(storeAt(result, 'store:s-kroger')?.saving).toEqual({
      kind: 'aboutTheSame',
      coveredLines: 9,
    });
  });

  it('reads a price 11 days old as "Last seen"', async () => {
    const { result } = renderSavings([
      answering(
        savingsAnswer([
          candidate(ALDI, {
            lines: [
              cell(milk, {
                isCurrent: false,
                observedAt: '2026-10-18T12:00:00.000Z',
              }),
            ],
          }),
        ]),
      ).mock,
    ]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(result.current.savings?.stores[0]?.lines[0]?.lastSeen).toBe(
      `Last seen ${formatMonthDay(new Date('2026-10-18T12:00:00.000Z'))}`,
    );
  });

  it('names a stand-in 4 mi away, and none for a chain beyond it', async () => {
    const { result } = renderSavings([
      answering(
        savingsAnswer([
          candidate(ALDI, {
            standIn: {
              __typename: 'PriceStandIn',
              distanceKm: 6.4,
              store: {
                __typename: 'Store',
                id: 's-aldi-w',
                name: 'ALDI Wilkinsburg',
              },
            },
          }),
          candidate(null, {
            chain: {
              __typename: 'StoreChain',
              id: 'c-trader',
              name: "Trader Joe's",
            },
            standIn: null,
            total: null,
          }),
        ]),
      ).mock,
    ]);

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(result.current.savings?.stores.map(s => s.standIn)).toEqual([
      'Prices from ALDI Wilkinsburg, 4 mi away',
      null,
    ]);
  });

  it('keeps the last answer when the request fails, with when it was given', async () => {
    const failing = recordMock(ListSavingsDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderSavings([failing.mock], cached(threeStores));

    await drainTimers();
    expect(result.current.failed).toBe(true);
    expect(result.current.savings?.answeredAt).toBe(ANSWERED_AT);
    expect(result.current.savings?.stores).toHaveLength(3);
  });

  it('has nothing to show when the first request fails', async () => {
    const failing = recordMock(ListSavingsDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderSavings([failing.mock]);

    await drainTimers();
    expect(result.current.failed).toBe(true);
    expect(result.current).toMatchObject({ savings: null, loading: false });
  });

  it('reads a kind this build does not know as No price', async () => {
    const future = savingsAnswer([
      candidate(ALDI, {
        lines: [cell(milk, { kind: 'BY_WEIGHT' as StoreLineMatch, amount: 1 })],
      }),
    ]);
    const { result } = renderHookWithApollo(
      () => useListSavings('list-1', 'cache-first'),
      { cache: cached(future), operationMocks: [] },
    );

    await drainTimers();
    expect(result.current.savings).not.toBeNull();
    expect(result.current.savings?.stores[0]?.lines[0]).toMatchObject({
      kind: 'none',
      price: null,
    });
  });
});

describe('useStoreSavingsLines', () => {
  it('reads one store from the stored answer, asking nothing', async () => {
    const asked = answering(threeStores);
    const { result } = renderHookWithApollo(
      () => useStoreSavingsLines('list-1', 'store:s-aldi'),
      { cache: cached(threeStores), operationMocks: [asked.mock] },
    );

    await drainTimers();
    expect(result.current.store).not.toBeNull();
    expect(result.current.store?.option.key).toBe('store:s-aldi');
    expect(asked.fired).toHaveLength(0);
  });
});
