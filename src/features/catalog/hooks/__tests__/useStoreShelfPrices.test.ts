import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { PriceBasis } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { formatMonthDay } from '#/utils/formatters/date';
import { formatCurrency } from '#/utils/formatters/number';
import {
  StoreShelfPricesDocument,
  UseStoreShelfPrices_ItemFragmentDoc,
  UseStoreShelfPrices_ListFragmentDoc,
  type UseStoreShelfPrices_ItemFragment,
} from '../useStoreShelfPrices.generated';
import { useStoreShelfPrices } from '../useStoreShelfPrices';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(),
}));
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(),
}));

type Connection = UseStoreShelfPrices_ItemFragment['storePricesConnection'];
type StorePrice = Connection['edges'][number]['node'];
type SimilarPrice =
  UseStoreShelfPrices_ItemFragment['similarStorePrices'][number];

const USD: StorePrice['currency'] = {
  __typename: 'Currency',
  id: 'usd',
  code: 'USD',
  decimalPlaces: 2,
};
const usd = (amount: number) => formatCurrency(amount, 'USD', 2);
const LB: StorePrice['unit'] = asAbbreviation({
  __typename: 'Unit',
  id: 'u-lb',
  symbol: 'lb',
});
const PIECE: StorePrice['unit'] = asAbbreviation({
  __typename: 'Unit',
  id: 'u-pc',
  symbol: 'pc',
});
const OZ: SimilarPrice['unit'] = asAbbreviation({
  __typename: 'Unit',
  id: 'u-oz',
  symbol: 'oz',
});
const SEEN = '2026-10-16T18:11:52.922Z';

const store = (id: string, name: string): StorePrice['store'] => ({
  __typename: 'Store',
  id,
  name,
});

/** A current, regular-priced row at its usual; each case states what differs. */
const priceAt = (
  at: StorePrice['store'],
  overrides: Partial<StorePrice> = {},
): StorePrice => ({
  __typename: 'ItemStorePrice',
  store: at,
  price: 2.49,
  regularPrice: 2.49,
  onPromotion: false,
  typicalPrice: 2.49,
  lowestPrice: 2.49,
  coveredDays: 90,
  normalizedPrice: null,
  normalizedBasis: null,
  isCurrent: true,
  confirmedAt: SEEN,
  aisle: null,
  unit: LB,
  currency: USD,
  ...overrides,
});

const ALDI = store('s-aldi', 'ALDI');
const GIANT_EAGLE = store('s-ge', 'Giant Eagle');
const KROGER = store('s-kroger', 'Kroger - Weirton');

const connectionOf = (nodes: StorePrice[]): Connection => ({
  __typename: 'ItemStorePriceConnection',
  edges: nodes.map(node => ({ __typename: 'ItemStorePriceEdge', node })),
});

/** Appleton Farms bacon, 12 oz, at $4.49: $13.20 a kilogram. */
const similarAt = (
  at: SimilarPrice['store'],
  overrides: Partial<SimilarPrice> = {},
): SimilarPrice => ({
  __typename: 'SimilarStorePrice',
  store: at,
  product: {
    __typename: 'Item',
    id: 'item-appleton',
    name: 'Appleton Farms Bacon',
  },
  price: 4.49,
  unit: PIECE,
  packageNetWeight: 12,
  packageNetWeightUnit: OZ,
  normalizedPrice: 13.2,
  basis: PriceBasis.PerKg,
  currency: USD,
  ...overrides,
});

const pricesMock = (nodes: StorePrice[]) =>
  recordMock(StoreShelfPricesDocument, {
    data: {
      item: {
        id: 'item-1',
        storePricesConnection: connectionOf(nodes),
        similarStorePrices: [],
      },
    },
  });

/** A cache holding the item's prices, as a store-mode scan's lookup leaves it. */
const cacheWith = (
  nodes: StorePrice[],
  targetStoreId: string | null = null,
  similar: SimilarPrice[] = [],
) => {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Item', id: 'item-1' }),
    fragment: UseStoreShelfPrices_ItemFragmentDoc,
    fragmentName: 'useStoreShelfPrices_item',
    data: {
      __typename: 'Item',
      id: 'item-1',
      storePricesConnection: connectionOf(nodes),
      similarStorePrices: similar,
    },
  });
  if (targetStoreId) {
    cache.writeFragment({
      id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
      fragment: UseStoreShelfPrices_ListFragmentDoc,
      fragmentName: 'useStoreShelfPrices_list',
      data: {
        __typename: 'ShoppingList',
        id: 'list-1',
        targetStore: { __typename: 'Store', id: targetStoreId },
      },
    });
  }
  return cache;
};

const rowsFrom = async (
  nodes: StorePrice[],
  targetStoreId: string | null = null,
) => {
  const { result } = renderHookWithApollo(
    () => useStoreShelfPrices('item-1', 'list-1'),
    { cache: cacheWith(nodes, targetStoreId) },
  );
  await waitFor(() => expect(result.current.rows).toHaveLength(nodes.length));
  return result.current.rows;
};

const firstRow = async (overrides: Partial<StorePrice>) => {
  const [row] = await rowsFrom([priceAt(KROGER, overrides)]);
  if (!row) throw new Error('no row');
  return row;
};

beforeEach(() => {
  jest.mocked(useFeatureFlag).mockReturnValue(true);
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
});

describe('useStoreShelfPrices', () => {
  it('asks for an item no lookup brought, and keeps the server order', async () => {
    const answer = pricesMock([
      priceAt(ALDI, { price: 1.99 }),
      priceAt(GIANT_EAGLE),
      priceAt(KROGER, { price: 2.79 }),
    ]);
    const { result } = renderHookWithApollo(
      () => useStoreShelfPrices('item-1', 'list-1'),
      { operationMocks: [answer.mock] },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.rows.map(row => row.storeName)).toEqual([
      'ALDI',
      'Giant Eagle',
      'Kroger - Weirton',
    ]);
    expect(answer.fired).toEqual([{ itemId: 'item-1' }]);
  });

  it('reads what a store-mode scan stored without asking again', async () => {
    const answer = pricesMock([]);
    const { result } = renderHookWithApollo(
      () => useStoreShelfPrices('item-1', 'list-1'),
      { cache: cacheWith([priceAt(KROGER)]), operationMocks: [answer.mock] },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(answer.fired).toEqual([]);
  });

  it('shows the last answer when a newer one replaces it', async () => {
    const cache = cacheWith([priceAt(ALDI), priceAt(KROGER)]);
    const { result } = renderHookWithApollo(
      () => useStoreShelfPrices('item-1', 'list-1'),
      { cache },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    cache.writeFragment({
      id: cache.identify({ __typename: 'Item', id: 'item-1' }),
      fragment: UseStoreShelfPrices_ItemFragmentDoc,
      fragmentName: 'useStoreShelfPrices_item',
      data: {
        __typename: 'Item',
        id: 'item-1',
        storePricesConnection: connectionOf([priceAt(GIANT_EAGLE)]),
        similarStorePrices: [],
      },
    });

    await waitFor(() =>
      expect(result.current.rows.map(row => row.storeName)).toEqual([
        'Giant Eagle',
      ]),
    );
  });

  describe('the price', () => {
    it('reads per the unit it is sold in, with its price per kg', async () => {
      const row = await firstRow({
        price: 1.29,
        regularPrice: 1.29,
        typicalPrice: 1.29,
        lowestPrice: 1.29,
        normalizedPrice: 2.8439631822,
        normalizedBasis: PriceBasis.PerKg,
      });
      expect(row.price).toBe(
        t('labels.pricePer.unit', { price: usd(1.29), unit: 'lb' }),
      );
      expect(row.perBasis).toBe(t('labels.pricePer.kg', { price: usd(2.84) }));
    });

    it('reads "each" for a piece, once', async () => {
      const row = await firstRow({
        price: 0.89,
        regularPrice: 0.89,
        typicalPrice: 0.89,
        lowestPrice: 0.89,
        normalizedPrice: 0.89,
        normalizedBasis: PriceBasis.Each,
        unit: PIECE,
      });
      expect(row.price).toBe(t('labels.pricePer.each', { price: usd(0.89) }));
      expect(row.perBasis).toBeNull();
    });

    // The wire can carry a basis this build's enum lacks.
    it('shows no per-unit line on a basis this build predates', async () => {
      const row = await firstRow({
        normalizedPrice: 5.49,
        normalizedBasis: 'PER_LB' as unknown as PriceBasis,
      });
      expect(row.price).toBe(
        t('labels.pricePer.unit', { price: usd(2.49), unit: 'lb' }),
      );
      expect(row.perBasis).toBeNull();
    });

    it('reads in its own currency and decimal places', async () => {
      const row = await firstRow({
        price: 298,
        regularPrice: 298,
        typicalPrice: 298,
        lowestPrice: 298,
        unit: PIECE,
        currency: {
          __typename: 'Currency',
          id: 'jpy',
          code: 'JPY',
          decimalPlaces: 0,
        },
      });
      expect(row.price).toContain('¥298');
      expect(row.price).not.toContain('298.00');
    });
  });

  it('shows the regular price a promotion replaces', async () => {
    const row = await firstRow({
      price: 2.49,
      regularPrice: 2.99,
      onPromotion: true,
    });
    expect(row.wasPrice).toBe(t('storeShelfPrices.was', { price: usd(2.99) }));
    expect((await firstRow({})).wasPrice).toBeNull();
  });

  describe('the usual and the low', () => {
    it('names the usual and a 90-day low under it', async () => {
      const row = await firstRow({
        price: 1.99,
        typicalPrice: 2.39,
        lowestPrice: 1.99,
      });
      expect(row.usual).toBe(
        t('storeShelfPrices.usually', { price: usd(2.39) }),
      );
      expect(row.lowest).toBe(t('storeShelfPrices.lowestIn', { count: 90 }));
    });

    it('names neither at the usual', async () => {
      const row = await firstRow({});
      expect(row.usual).toBeNull();
      expect(row.lowest).toBeNull();
    });

    it('names the span of a short history', async () => {
      const row = await firstRow({
        price: 1.29,
        typicalPrice: 1.49,
        lowestPrice: 1.29,
        coveredDays: 11,
      });
      expect(row.usual).toBe(
        t('storeShelfPrices.usuallyOver', { price: usd(1.49), count: 11 }),
      );
      expect(row.lowest).toBe(t('storeShelfPrices.lowestIn', { count: 11 }));
    });
  });

  it('says when a stale price was last seen, and never calls it a low', async () => {
    const [stale, other] = await rowsFrom([
      priceAt(KROGER, {
        isCurrent: false,
        price: 1.99,
        typicalPrice: 2.39,
        lowestPrice: 1.99,
      }),
      priceAt(ALDI, { isCurrent: false }),
    ]);
    expect(stale?.lastSeen).toBe(
      t('storeShelfPrices.lastSeen', { date: formatMonthDay(new Date(SEEN)) }),
    );
    expect(stale?.lowest).toBeNull();
    expect(stale?.isCheapest).toBe(false);
    expect(other?.isCheapest).toBe(false);
  });

  describe('the cheapest', () => {
    it('is the first current row when another is ranked', async () => {
      const rows = await rowsFrom([
        priceAt(ALDI, { price: 1.99 }),
        priceAt(KROGER, { price: 2.79 }),
      ]);
      expect(rows.map(row => row.isCheapest)).toEqual([true, false]);
      expect(rows[0]?.lastSeen).toBeNull();
    });

    it('is no row when only one store is priced', async () => {
      expect((await firstRow({})).isCheapest).toBe(false);
    });
  });

  describe("the list's store", () => {
    it('is tagged when the cached list names it', async () => {
      const rows = await rowsFrom(
        [priceAt(ALDI, { price: 1.99 }), priceAt(GIANT_EAGLE)],
        GIANT_EAGLE.id,
      );
      expect(rows.map(row => row.isListStore)).toEqual([false, true]);
      expect(rows.map(row => row.isCheapest)).toEqual([true, false]);
    });

    it('is no row when the list is not cached', async () => {
      const rows = await rowsFrom([priceAt(GIANT_EAGLE)]);
      expect(rows[0]?.isListStore).toBe(false);
    });
  });

  it('shows the aisle as the store words it', async () => {
    expect((await firstRow({ aisle: 'Aisle 12' })).aisle).toBe('Aisle 12');
    expect((await firstRow({ aisle: '  ' })).aisle).toBeNull();
  });

  describe('asks nothing and shows nothing', () => {
    const expectNothing = async (listId: string | null) => {
      const answer = pricesMock([priceAt(KROGER)]);
      const { result } = renderHookWithApollo(
        () => useStoreShelfPrices('item-1', listId),
        {
          cache: cacheWith([priceAt(KROGER)], null, [similarAt(ALDI)]),
          operationMocks: [answer.mock],
        },
      );
      // Rendering settles before any request could be sent.
      await waitFor(() => expect(result.current.rows).toEqual([]));
      expect(result.current.similarRows).toEqual([]);
      expect(answer.fired).toEqual([]);
    };

    it('with Budget & prices off', async () => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
      await expectNothing('list-1');
    });

    it("with the build's flag off", async () => {
      jest.mocked(useFeatureFlag).mockReturnValue(false);
      await expectNothing('list-1');
      expect(jest.mocked(useFeatureFlag)).toHaveBeenCalledWith(
        'storeShelfPrices',
      );
    });

    it('outside a list', async () => {
      await expectNothing(null);
    });
  });

  // Oscar Mayer bacon 16 oz at Giant Eagle ($15.41/kg) and Kroger ($16.51/kg).
  describe('similar products', () => {
    const oscarMayer = [
      priceAt(GIANT_EAGLE, {
        price: 6.99,
        normalizedPrice: 15.41,
        normalizedBasis: PriceBasis.PerKg,
      }),
      priceAt(KROGER, {
        price: 7.49,
        normalizedPrice: 16.51,
        normalizedBasis: PriceBasis.PerKg,
      }),
    ];
    const similarFrom = async (similar: SimilarPrice[]) => {
      const { result } = renderHookWithApollo(
        () => useStoreShelfPrices('item-1', 'list-1'),
        { cache: cacheWith(oscarMayer, null, similar) },
      );
      await waitFor(() => expect(result.current.rows).toHaveLength(2));
      return result.current;
    };

    it("follow the item's own stores, naming the product, its size and its price per kg", async () => {
      const { rows, similarRows } = await similarFrom([similarAt(ALDI)]);

      expect(rows.map(row => [row.storeName, row.isCheapest])).toEqual([
        ['Giant Eagle', true],
        ['Kroger - Weirton', false],
      ]);
      expect(similarRows).toEqual([
        {
          storeId: 's-aldi',
          storeName: 'ALDI',
          product: 'Appleton Farms Bacon · 12 oz',
          price: t('labels.pricePer.unit', { price: usd(4.49), unit: 'pc' }),
          perBasis: t('labels.pricePer.kg', { price: usd(13.2) }),
          mightBeCheaper: true,
        },
      ]);
    });

    it('show none for a line naming only a food', async () => {
      expect((await similarFrom([])).similarRows).toEqual([]);
    });

    it('leave out a product dearer per kg than the item at the same store', async () => {
      const { similarRows } = await similarFrom([
        similarAt(GIANT_EAGLE, { normalizedPrice: 18 }),
      ]);

      expect(similarRows).toEqual([]);
    });

    it('never read "might be cheaper" against another basis', async () => {
      const { similarRows } = await similarFrom([
        similarAt(ALDI, { basis: PriceBasis.Each, normalizedPrice: 4.49 }),
      ]);

      expect(similarRows[0]?.mightBeCheaper).toBe(false);
    });
  });

  it('shows no rows when the request fails', async () => {
    const failed = recordMock(StoreShelfPricesDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderHookWithApollo(
      () => useStoreShelfPrices('item-1', 'list-1'),
      { operationMocks: [failed.mock] },
    );
    await waitFor(() => expect(failed.fired).toHaveLength(1));
    expect(result.current.rows).toEqual([]);
  });
});
