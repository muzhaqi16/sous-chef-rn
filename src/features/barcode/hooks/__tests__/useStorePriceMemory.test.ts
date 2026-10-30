import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
import {
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import {
  PriceBasis,
  PriceComparisonScope,
} from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { formatMonthDay } from '#/utils/formatters/date';
import {
  HouseholdUsualUnitPriceDocument,
  StorePriceMemoryDocument,
  UseStorePriceMemory_ItemFragmentDoc,
  UseStorePriceMemory_ListFragmentDoc,
} from '../useStorePriceMemory.generated';
import { useStorePriceMemory } from '../useStorePriceMemory';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => 'home-1',
}));

const USD = { id: 'usd', code: 'USD', decimalPlaces: 2 };
const usd = (amount: number) => formatCurrency(amount, 'USD', 2);
const PAID_AT = '2026-10-02T15:00:00.000Z';

const row = (
  scope: PriceComparisonScope,
  at: string,
  medianPrice: number,
  meetsMinimumSample = true,
) => ({
  basis: PriceBasis.PerKg,
  scope,
  medianPrice,
  meetsMinimumSample,
  store: scope === PriceComparisonScope.Store ? { id: at } : null,
  chain: scope === PriceComparisonScope.Chain ? { id: at } : null,
});

// The list is shopped at store-1, of the chain chain-1.
const LIST = {
  id: 'list-1',
  targetStore: {
    id: 'store-1',
    chain: { id: 'chain-1', name: 'Giant Eagle' },
  },
};

const memoryMock = (
  summary: {
    lastPaid?: {
      unitPrice: number;
      unit: { id: string; name: string; symbol: string };
      normalizedPrice: number | null;
      basis: PriceBasis | null;
      store: { id: string; name: string } | null;
      onSale?: boolean;
    } | null;
    usual?: {
      basis: PriceBasis;
      medianPrice: number;
      unitPrice?: number | null;
    } | null;
  },
  rows: ReturnType<typeof row>[] = [],
  maxUsageCount?: number,
) =>
  recordMock(StorePriceMemoryDocument, {
    data: {
      item: {
        id: 'pb',
        // The unit the usual is priced in when asked for none: the jar.
        usualUnit: { id: 'u-jar' },
        householdPriceSummary: {
          currency: USD,
          lastPaid: summary.lastPaid
            ? { paidAt: PAID_AT, onSale: false, ...summary.lastPaid }
            : null,
          usual: summary.usual ? { unitPrice: null, ...summary.usual } : null,
        },
        priceComparison: { currency: USD, rows },
      },
      shoppingList: LIST,
    },
    ...(maxUsageCount ? { maxUsageCount } : {}),
  });

const JAR = { id: 'u-jar', name: 'jar', symbol: 'jar' };

const JAR_UNIT = { id: 'u-jar', symbol: 'jar' };

const render = (mocks: ReturnType<typeof recordMock>[]) =>
  renderHookWithApollo(
    () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'USD'),
    {
      operationMocks: mocks.map(mock => mock.mock),
    },
  );

describe('useStorePriceMemory', () => {
  // Store mode mounts the card per scan: the same product scanned again reads
  // what it already holds. A second ask would be answered, and counted.
  it('asks once for a product scanned twice', async () => {
    const cache = makeCache();
    const memory = memoryMock(
      {},
      [row(PriceComparisonScope.Store, 'store-1', 9.5)],
      2,
    );
    const mount = () =>
      renderHookWithApollo(
        () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'USD'),
        { cache, operationMocks: [memory.mock] },
      );

    const first = mount();
    await waitFor(() => expect(first.result.current.typical).not.toBeNull());
    first.unmount();
    const second = mount();

    expect(second.result.current.typical).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(memory.fired).toHaveLength(1);
  });

  it('shows nothing for a product the household never bought, with thin data here', async () => {
    const memory = memoryMock({}, [
      row(PriceComparisonScope.Store, 'store-1', 12, false),
    ]);
    const { result } = render([memory]);

    await waitFor(() => expect(memory.fired).toHaveLength(1));
    expect(result.current).toMatchObject({
      lastPaid: null,
      usual: null,
      typical: null,
    });
  });

  it('shows one purchase per kg, with no usual below the minimum', async () => {
    const { result } = render([
      memoryMock({
        lastPaid: {
          unitPrice: 6.49,
          unit: JAR,
          normalizedPrice: 14.3,
          basis: PriceBasis.PerKg,
          store: { id: 'store-1', name: 'Giant Eagle' },
          onSale: true,
        },
      }),
    ]);

    await waitFor(() => expect(result.current.lastPaid).not.toBeNull());
    expect(result.current.lastPaid).toEqual({
      price: t('labels.pricePer.kg', { price: usd(14.3) }),
      storeName: 'Giant Eagle',
      paidOn: formatMonthDay(new Date(PAID_AT)),
      onSale: true,
    });
    expect(result.current.usual).toBeNull();
  });

  // The wire can carry a basis this build's enum lacks, which no mock can
  // state: the cache holds what an older build parsed. The price shows alone.
  it('shows the bare price on a basis this build predates', async () => {
    const cache = makeCache();
    seedFragment(cache, {
      id: cache.identify({ __typename: 'Item', version: 1, id: 'pb' }),
      fragment: UseStorePriceMemory_ItemFragmentDoc,
      fragmentName: 'useStorePriceMemory_item',
      variables: { homeId: 'home-1' },
      data: {
        __typename: 'Item',
        version: 1,
        id: 'pb',
        usualUnit: { __typename: 'Unit', id: 'u-jar' },
        householdPriceSummary: {
          __typename: 'HouseholdPriceSummary',
          currency: { __typename: 'Currency', ...USD },
          lastPaid: {
            __typename: 'HouseholdPaidPrice',
            unitPrice: 6.49,
            unit: asAbbreviation({ __typename: 'Unit', ...JAR }),
            normalizedPrice: 6.5,
            basis: 'PER_LB' as unknown as PriceBasis,
            store: null,
            paidAt: PAID_AT,
            onSale: false,
          },
          usual: null,
        },
        priceComparison: {
          __typename: 'ItemPriceComparison',
          currency: { __typename: 'Currency', ...USD },
          rows: [],
        },
      },
    });
    seedFragment(cache, {
      id: cache.identify({
        __typename: 'ShoppingList',
        version: 1,
        id: 'list-1',
      }),
      fragment: UseStorePriceMemory_ListFragmentDoc,
      fragmentName: 'useStorePriceMemory_list',
      data: {
        __typename: 'ShoppingList',
        version: 1,
        id: 'list-1',
        targetStore: null,
      },
    });

    const { result } = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'USD'),
      { cache, operationMocks: [] },
    );

    await waitFor(() => expect(result.current.lastPaid).not.toBeNull());
    expect(result.current.lastPaid?.price).toBe(usd(6.5));
  });

  it('reads every line on the usual basis, and a last price off it per its own unit', async () => {
    const { result } = render([
      memoryMock(
        {
          lastPaid: {
            unitPrice: 3.49,
            unit: JAR,
            normalizedPrice: 3.49,
            basis: PriceBasis.Each,
            store: null,
          },
          usual: { basis: PriceBasis.PerKg, medianPrice: 7.69 },
        },
        [row(PriceComparisonScope.Chain, 'chain-1', 8.1)],
      ),
    ]);

    await waitFor(() => expect(result.current.usual).not.toBeNull());
    expect(result.current.usual).toBe(
      t('labels.pricePer.kg', { price: usd(7.69) }),
    );
    expect(result.current.lastPaid?.price).toBe(
      t('labels.pricePer.unit', { price: usd(3.49), unit: 'jar' }),
    );
    expect(result.current.lastPaid?.storeName).toBeNull();
  });

  it("takes this store's typical price over its chain's, each only on enough data", async () => {
    const chainOnly = render([
      memoryMock({}, [
        row(PriceComparisonScope.Store, 'store-1', 9.5, false),
        row(PriceComparisonScope.Chain, 'chain-1', 8.1),
        row(PriceComparisonScope.Store, 'store-2', 6),
      ]),
    ]);
    await waitFor(() =>
      expect(chainOnly.result.current.typical).toEqual({
        price: t('labels.pricePer.kg', { price: usd(8.1) }),
        chainName: 'Giant Eagle',
      }),
    );

    const atStore = render([
      memoryMock({}, [
        row(PriceComparisonScope.Chain, 'chain-1', 8.1),
        row(PriceComparisonScope.Store, 'store-1', 9.5),
      ]),
    ]);
    await waitFor(() =>
      expect(atStore.result.current.typical).toEqual({
        price: t('labels.pricePer.kg', { price: usd(9.5) }),
        chainName: null,
      }),
    );
  });

  // The card stays open while Budget & prices is switched off: store mode
  // then shows no money, though the cache still holds the comparison.
  it('drops the typical price once prices are switched off', async () => {
    const shopping: { listId: string | undefined } = { listId: 'list-1' };
    const { result, rerender } = renderHookWithApollo(
      ({ listId }: { listId: string | undefined }) =>
        useStorePriceMemory('pb', listId, JAR_UNIT, 'USD'),
      {
        operationMocks: [
          memoryMock({}, [row(PriceComparisonScope.Store, 'store-1', 9.5)])
            .mock,
        ],
        initialProps: shopping,
      },
    );
    await waitFor(() => expect(result.current.typical).not.toBeNull());

    rerender({ listId: undefined });

    expect(result.current.typical).toBeNull();
  });

  it('reads nothing outside store mode', () => {
    const memory = memoryMock({});
    const { result } = renderHookWithApollo(
      () => useStorePriceMemory('pb', undefined, JAR_UNIT, 'USD'),
      { operationMocks: [memory.mock] },
    );

    expect(memory.fired).toHaveLength(0);
    expect(result.current.typical).toBeNull();
  });

  it('says how a shelf price per jar compares with the usual per jar, to the cent', async () => {
    const memory = memoryMock({
      usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: 3.49 },
    });
    const { result } = render([memory]);
    await waitFor(() => expect(result.current.usual).not.toBeNull());
    // The jar is the unit the usual comes in: nothing more is asked.
    expect(memory.fired).toEqual([
      { itemId: 'pb', homeId: 'home-1', listId: 'list-1' },
    ]);

    const usual = t('labels.pricePer.unit', { price: usd(3.49), unit: 'jar' });
    expect(result.current.compareToUsual(4.29)).toBe(
      t('barcode.price.aboveUsual', { difference: usd(0.8), usual }),
    );
    expect(result.current.compareToUsual(3.491)).toBe(
      t('barcode.price.sameAsUsual', { usual }),
    );
    expect(result.current.compareToUsual(2.99)).toBe(
      t('barcode.price.belowUsual', { difference: usd(0.5), usual }),
    );
  });

  // A list line counting in pounds: the usual per pound is asked on its own.
  it("asks the usual per one of a list line's own unit", async () => {
    const perLb = recordMock(HouseholdUsualUnitPriceDocument, {
      data: {
        item: {
          id: 'pb',
          householdPriceSummary: { usual: { unitPrice: 5.99 } },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () =>
        useStorePriceMemory(
          'pb',
          'list-1',
          { id: 'u-lb', symbol: 'lb' },
          'USD',
        ),
      {
        operationMocks: [
          memoryMock({
            usual: {
              basis: PriceBasis.PerKg,
              medianPrice: 13.2,
              unitPrice: 3.49,
            },
          }).mock,
          perLb.mock,
        ],
      },
    );

    await waitFor(() =>
      expect(result.current.compareToUsual(5.99)).toBe(
        t('barcode.price.sameAsUsual', {
          usual: t('labels.pricePer.unit', { price: usd(5.99), unit: 'lb' }),
        }),
      ),
    );
    expect(perLb.fired).toEqual([
      { itemId: 'pb', homeId: 'home-1', unitId: 'u-lb' },
    ]);
    // The pound's price joins the summary the first answer stored.
    expect(result.current.usual).toBe(
      t('labels.pricePer.kg', { price: usd(13.2) }),
    );
  });

  // The typed price is in the list's currency; the household's usual in the
  // caller's. Compared as bare numbers they would read "€0.50 below $2.50".
  it('compares nothing with a usual in another currency', async () => {
    const memory = memoryMock({
      usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: 2.5 },
    });
    const inEuros = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'EUR'),
      { operationMocks: [memory.mock] },
    );
    await waitFor(() => expect(inEuros.result.current.usual).not.toBeNull());

    expect(inEuros.result.current.compareToUsual(2)).toBeNull();

    // Nor while the list's currency is not yet known.
    const unknown = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, null),
      { operationMocks: [memory.mock] },
    );
    await waitFor(() => expect(unknown.result.current.usual).not.toBeNull());
    expect(unknown.result.current.compareToUsual(2)).toBeNull();
  });

  it('compares nothing when the usual cannot be put on the unit, or there is none', async () => {
    const offBasis = render([
      memoryMock({
        usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: null },
      }),
    ]);
    await waitFor(() => expect(offBasis.result.current.usual).not.toBeNull());
    expect(offBasis.result.current.compareToUsual(4.29)).toBeNull();

    const none = render([memoryMock({})]);
    expect(none.result.current.compareToUsual(4.29)).toBeNull();
  });
});
