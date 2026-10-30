import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { StoreLineMatch, UnitSystem } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  ALDI,
  GIANT_EAGLE,
  OZ,
  candidate,
  cell,
  saving,
  savingsAnswer,
  savingsLine,
} from '#/test-utils/fixtures/listSavingsFixtures';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { formatMonthDay } from '#/utils/formatters/date';
import { ListSavingsDocument } from '#features/shoppingList/hooks/useListSavings.generated';
import { StoreSavingsItems } from '../StoreSavingsItems';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

// Its repeating diagnostics timer never drains: 0 is the hook's own off switch.
jest.mock('#hooks/performance/useFlashListPerformance', () => {
  const actual = jest.requireActual(
    '#hooks/performance/useFlashListPerformance',
  );
  return {
    ...actual,
    useFlashListPerformance: (list: unknown, options: object) =>
      actual.useFlashListPerformance(list, { ...options, reportInterval: 0 }),
  };
});

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(),
}));
jest.mock('#hooks/settings/useReadingSystem', () => ({
  useReadingSystem: jest.fn(),
}));

const milk = savingsLine('l-milk', 'Milk');
const bacon = savingsLine('l-bacon', 'Bacon');
const oil = savingsLine('l-oil', 'Olive oil');
const saffron = savingsLine('l-saffron', 'Saffron');
const SEEN = '2026-10-18T12:00:00.000Z';

/** ALDI against Giant Eagle, the list's store. */
const answer = savingsAnswer([
  candidate(GIANT_EAGLE, {
    isTarget: true,
    lines: [
      cell(milk, { amount: 3.49 }),
      cell(bacon, { amount: 7.49 }),
      cell(oil, { amount: 9.99 }),
      cell(saffron, { amount: 12.99 }),
    ],
  }),
  candidate(ALDI, {
    total: 52,
    savingVsTarget: saving(8, 7),
    standIn: {
      __typename: 'PriceStandIn',
      distanceKm: 6.4,
      store: { __typename: 'Store', id: 's-aldi-w', name: 'ALDI Wilkinsburg' },
    },
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
      cell(oil, {
        kind: StoreLineMatch.Estimated,
        amount: 8.49,
        isCurrent: false,
        observedAt: SEEN,
      }),
      cell(saffron, { kind: StoreLineMatch.None, amount: null }),
    ],
  }),
]);

const route = {
  key: 'StoreSavingsItems',
  name: 'StoreSavingsItems' as const,
  params: { listId: 'list-1', storeKey: 'store:s-aldi' },
};

const renderScreen = () => {
  const cache = makeCache();
  seedQuery(cache, {
    query: ListSavingsDocument,
    variables: { listId: 'list-1' },
    data: { __typename: 'Query', shoppingListStoreSavings: answer },
  });
  const asked = recordMock(ListSavingsDocument, {
    data: { shoppingListStoreSavings: answer },
  });
  renderWithApollo(<StoreSavingsItems route={route} />, {
    cache,
    operationMocks: [asked.mock],
  });
  return asked;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  jest.mocked(useReadingSystem).mockReturnValue(UnitSystem.Imperial);
});

describe('StoreSavingsItems', () => {
  it("prices ALDI's lines against Giant Eagle's, each as the server judged it", async () => {
    renderScreen();

    await drainTimers();
    expect(screen.getByText('ALDI Banksville')).toBeTruthy();
    expect(
      screen.getByText('Prices from ALDI Wilkinsburg, 4 mi away'),
    ).toBeTruthy();
    // Same: the price, the list store's, and the gap.
    expect(screen.getByText('$2.99')).toBeTruthy();
    expect(
      screen.getByText("$3.49 at your list's store · $0.50 cheaper"),
    ).toBeTruthy();
    // Similar: the badge and the product priced.
    expect(screen.getByText('Similar')).toBeTruthy();
    expect(screen.getByText('Appleton Farms Bacon · 12 oz')).toBeTruthy();
    expect(
      screen.getByText("$7.49 at your list's store · $1.50 cheaper"),
    ).toBeTruthy();
    // Estimated and stale: why it's estimated, no gap, and when it was seen.
    expect(screen.getByText('Estimated')).toBeTruthy();
    expect(screen.getByText("A typical price, not this store's")).toBeTruthy();
    expect(screen.getByText("$9.99 at your list's store")).toBeTruthy();
    expect(
      screen.getByText(`Last seen ${formatMonthDay(new Date(SEEN))}`),
    ).toBeTruthy();
    // None: no amount.
    expect(screen.getByText('No price')).toBeTruthy();
  });

  it('opens from the stored answer, asking nothing', async () => {
    const asked = renderScreen();

    await drainTimers();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(asked.fired).toHaveLength(0);
  });

  it("opens a line's detail", async () => {
    renderScreen();

    await drainTimers();
    fireEvent.press(screen.getByText('Milk'));
    expect(useAppNavigation().toShoppingListItemDetail).toHaveBeenCalledWith({
      listId: 'list-1',
      itemId: 'l-milk',
    });
  });
});
