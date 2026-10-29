import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { PriceComparisonScope } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { formatCurrency } from '#/utils/formatters/number';
import { ListStoreComparisonDocument } from '#features/shoppingList/hooks/useListStoreComparison.generated';
import { StoreComparisonSection } from '../StoreComparisonSection';

type Comparison = MockDataFor<
  typeof ListStoreComparisonDocument
>['shoppingListStoreComparison'];
type Candidate = NonNullable<NonNullable<Comparison>['candidates']>[number];

function Section() {
  return <StoreComparisonSection listId="list-1" />;
}

// The rest is completed from the SDL.
const renderWith = (
  candidates: Candidate[],
  overrides: Partial<Comparison> = {},
) => {
  const query = recordMock(ListStoreComparisonDocument, {
    data: {
      shoppingListStoreComparison: {
        scope: PriceComparisonScope.Store,
        currency: { code: 'USD', decimalPlaces: 2 },
        comparableLines: 10,
        leftOutLines: 0,
        unpricedLines: [],
        candidates,
        ...overrides,
      },
    },
  });
  renderWithApollo(<Section />, {
    operationMocks: [query.mock],
  });
  return query;
};

describe('StoreComparisonSection', () => {
  it('ranks stores by total and says how much of each total is their own', async () => {
    renderWith([
      {
        scope: PriceComparisonScope.Store,
        chain: { name: 'Aldi' },
        estimatedTotal: 42.1,
        pricedLines: 7,
        chainFilledLines: 2,
        anyStoreFilledLines: 1,
        ranked: true,
      },
    ]);

    expect(
      await screen.findByText(formatCurrency(42.1, 'USD', 2)),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '7 priced here · 2 from other Aldi stores · 1 at a typical price',
      ),
    ).toBeTruthy();
  });

  // Its total rests mostly on other stores' prices, so it is not compared.
  it("shows the list's own store without a total while it has too few prices", async () => {
    renderWith([
      {
        scope: PriceComparisonScope.Store,
        estimatedTotal: 50,
        pricedLines: 1,
        anyStoreFilledLines: 9,
        ranked: false,
        isTarget: true,
      },
    ]);

    expect(await screen.findByText('Your store')).toBeTruthy();
    expect(screen.getByText('Not enough prices yet')).toBeTruthy();
    expect(screen.queryByText(formatCurrency(50, 'USD', 2))).toBeNull();
  });

  it('says when no store has enough prices, and what was left out', async () => {
    renderWith([], { leftOutLines: 1, unpricedLines: [{}, {}] });

    expect(
      await screen.findByText(
        'No store has enough recorded prices for this list yet. Every price entered when an item is ticked helps.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('2 items have no recorded price yet.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "1 item can't be compared: it isn't in the catalog, or its unit doesn't convert.",
      ),
    ).toBeTruthy();
  });

  it('compares store branches', async () => {
    const query = renderWith([]);
    await screen.findByText('Compares 10 items on this list.');

    expect(query.fired).toEqual([
      { input: { listId: 'list-1', scope: PriceComparisonScope.Store } },
    ]);
  });

  // The rest of Budget & prices reads from the device; this needs the server.
  it('says it needs a connection when it cannot be read offline', async () => {
    useStore.setState({ isOnline: false });
    const query = recordMock(ListStoreComparisonDocument, {
      error: new Error('Network request failed'),
    });
    renderWithApollo(<Section />, { operationMocks: [query.mock] });

    expect(await screen.findByText('Not available offline')).toBeTruthy();
    useStore.setState({ isOnline: true });
  });
});
