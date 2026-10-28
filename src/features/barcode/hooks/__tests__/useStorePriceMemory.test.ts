import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  PriceBasis,
  PriceComparisonScope,
} from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { formatMonthDay } from '#/utils/formatters/date';
import {
  HouseholdPricePaidDocument,
  HouseholdUsualUnitPriceDocument,
  StorePriceComparisonDocument,
  UseStorePriceMemory_ItemFragmentDoc,
} from '../useStorePriceMemory.generated';
import { useStorePriceMemory } from '../useStorePriceMemory';

jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => 'home-1',
}));

const USD = { id: 'usd', code: 'USD', decimalPlaces: 2 };
const usd = (amount: number) => formatCurrency(amount, 'USD', 2);
const PAID_AT = '2026-10-02T15:00:00.000Z';

const paidMock = (summary: {
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
}) =>
  recordMock(HouseholdPricePaidDocument, {
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
      },
    },
  });

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

const comparisonMock = (rows: ReturnType<typeof row>[]) =>
  recordMock(StorePriceComparisonDocument, {
    data: {
      shoppingList: {
        id: 'list-1',
        targetStore: {
          id: 'store-1',
          chain: { id: 'chain-1', name: 'Giant Eagle' },
        },
      },
      itemPriceComparison: { currency: USD, rows },
    },
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
  // the comparison it already holds.
  it('asks once for a product scanned twice', async () => {
    const cache = makeCache();
    const paid = paidMock({});
    const here = comparisonMock([
      row(PriceComparisonScope.Store, 'store-1', 12, false),
    ]);
    const mount = () =>
      renderHookWithApollo(
        () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'USD'),
        { cache, operationMocks: [paid.mock, here.mock] },
      );

    const first = mount();
    await waitFor(() => expect(here.fired).toHaveLength(1));
    await waitFor(() =>
      expect(cache.extract().ROOT_QUERY).toHaveProperty([
        'itemPriceComparison({"input":{"itemId":"pb"}})',
      ]),
    );
    first.unmount();
    mount();

    await waitFor(() => expect(paid.fired).toHaveLength(1));
    expect(here.fired).toHaveLength(1);
  });

  it('shows nothing for a product the household never bought, with thin data here', async () => {
    const paid = paidMock({});
    const here = comparisonMock([
      row(PriceComparisonScope.Store, 'store-1', 12, false),
    ]);
    const { result } = render([paid, here]);

    await waitFor(() => expect(here.fired).toHaveLength(1));
    await waitFor(() => expect(paid.fired).toHaveLength(1));
    expect(result.current).toMatchObject({
      lastPaid: null,
      usual: null,
      typical: null,
    });
  });

  it('shows one purchase per kg, with no usual below the minimum', async () => {
    const { result } = render([
      paidMock({
        lastPaid: {
          unitPrice: 6.49,
          unit: JAR,
          normalizedPrice: 14.3,
          basis: PriceBasis.PerKg,
          store: { id: 'store-1', name: 'Giant Eagle' },
          onSale: true,
        },
      }),
      comparisonMock([]),
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
    cache.writeFragment({
      id: cache.identify({ __typename: 'Item', id: 'pb' }),
      fragment: UseStorePriceMemory_ItemFragmentDoc,
      fragmentName: 'useStorePriceMemory_item',
      variables: { homeId: 'home-1' },
      data: {
        __typename: 'Item',
        id: 'pb',
        usualUnit: { __typename: 'Unit', id: 'u-jar' },
        householdPriceSummary: {
          __typename: 'HouseholdPriceSummary',
          currency: { __typename: 'Currency', ...USD },
          lastPaid: {
            __typename: 'HouseholdPaidPrice',
            unitPrice: 6.49,
            unit: { __typename: 'Unit', ...JAR },
            normalizedPrice: 6.5,
            basis: 'PER_LB' as unknown as PriceBasis,
            store: null,
            paidAt: PAID_AT,
            onSale: false,
          },
          usual: null,
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'USD'),
      { cache, operationMocks: [comparisonMock([]).mock] },
    );

    await waitFor(() => expect(result.current.lastPaid).not.toBeNull());
    expect(result.current.lastPaid?.price).toBe(usd(6.5));
  });

  it('reads every line on the usual basis, and a last price off it per its own unit', async () => {
    const { result } = render([
      paidMock({
        lastPaid: {
          unitPrice: 3.49,
          unit: JAR,
          normalizedPrice: 3.49,
          basis: PriceBasis.Each,
          store: null,
        },
        usual: { basis: PriceBasis.PerKg, medianPrice: 7.69 },
      }),
      comparisonMock([row(PriceComparisonScope.Chain, 'chain-1', 8.1)]),
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
      paidMock({}),
      comparisonMock([
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
      paidMock({}),
      comparisonMock([
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
  // then shows no money, though the skipped query keeps its last answer.
  it('drops the typical price once prices are switched off', async () => {
    const shopping: { listId: string | undefined } = { listId: 'list-1' };
    const { result, rerender } = renderHookWithApollo(
      ({ listId }: { listId: string | undefined }) =>
        useStorePriceMemory('pb', listId, JAR_UNIT, 'USD'),
      {
        operationMocks: [
          paidMock({}).mock,
          comparisonMock([row(PriceComparisonScope.Store, 'store-1', 9.5)])
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
    const paid = paidMock({});
    const here = comparisonMock([]);
    const { result } = renderHookWithApollo(
      () => useStorePriceMemory('pb', undefined, JAR_UNIT, 'USD'),
      { operationMocks: [paid.mock, here.mock] },
    );

    expect(paid.fired).toHaveLength(0);
    expect(here.fired).toHaveLength(0);
    expect(result.current.typical).toBeNull();
  });

  it('says how a shelf price per jar compares with the usual per jar, to the cent', async () => {
    const paid = paidMock({
      usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: 3.49 },
    });
    const { result } = render([paid, comparisonMock([])]);
    await waitFor(() => expect(result.current.usual).not.toBeNull());
    // The jar is the unit the usual comes in: nothing more is asked.
    expect(paid.fired).toEqual([{ itemId: 'pb', homeId: 'home-1' }]);

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
          paidMock({
            usual: {
              basis: PriceBasis.PerKg,
              medianPrice: 13.2,
              unitPrice: 3.49,
            },
          }).mock,
          perLb.mock,
          comparisonMock([]).mock,
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
    const paid = paidMock({
      usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: 2.5 },
    });
    const inEuros = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, 'EUR'),
      { operationMocks: [paid.mock, comparisonMock([]).mock] },
    );
    await waitFor(() => expect(inEuros.result.current.usual).not.toBeNull());

    expect(inEuros.result.current.compareToUsual(2)).toBeNull();

    // Nor while the list's currency is not yet known.
    const unknown = renderHookWithApollo(
      () => useStorePriceMemory('pb', 'list-1', JAR_UNIT, null),
      { operationMocks: [paid.mock, comparisonMock([]).mock] },
    );
    await waitFor(() => expect(unknown.result.current.usual).not.toBeNull());
    expect(unknown.result.current.compareToUsual(2)).toBeNull();
  });

  it('compares nothing when the usual cannot be put on the unit, or there is none', async () => {
    const offBasis = render([
      paidMock({
        usual: { basis: PriceBasis.PerKg, medianPrice: 7.69, unitPrice: null },
      }),
      comparisonMock([]),
    ]);
    await waitFor(() => expect(offBasis.result.current.usual).not.toBeNull());
    expect(offBasis.result.current.compareToUsual(4.29)).toBeNull();

    const none = render([paidMock({}), comparisonMock([])]);
    expect(none.result.current.compareToUsual(4.29)).toBeNull();
  });
});
