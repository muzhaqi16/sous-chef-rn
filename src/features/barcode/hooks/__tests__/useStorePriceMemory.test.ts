import { waitFor } from '@testing-library/react-native';
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
  StorePriceComparisonDocument,
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
  renderHookWithApollo(() => useStorePriceMemory('pb', 'list-1', JAR_UNIT), {
    operationMocks: mocks.map(mock => mock.mock),
  });

describe('useStorePriceMemory', () => {
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
      price: t('barcode.price.perKg', { price: usd(14.3) }),
      storeName: 'Giant Eagle',
      paidOn: formatMonthDay(new Date(PAID_AT)),
      onSale: true,
    });
    expect(result.current.usual).toBeNull();
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
      t('barcode.price.perKg', { price: usd(7.69) }),
    );
    expect(result.current.lastPaid?.price).toBe(
      t('barcode.price.perUnit', { price: usd(3.49), unit: 'jar' }),
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
        price: t('barcode.price.perKg', { price: usd(8.1) }),
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
        price: t('barcode.price.perKg', { price: usd(9.5) }),
        chainName: null,
      }),
    );
  });

  it('reads nothing outside store mode', () => {
    const paid = paidMock({});
    const here = comparisonMock([]);
    const { result } = renderHookWithApollo(
      () => useStorePriceMemory('pb', undefined, JAR_UNIT),
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
    expect(paid.fired[0]).toMatchObject({ unitId: 'u-jar' });

    const usual = t('barcode.price.perUnit', { price: usd(3.49), unit: 'jar' });
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
