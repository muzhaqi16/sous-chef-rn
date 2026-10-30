import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { formatCurrency } from '#/utils/formatters/number';
import { ListStoreSavingsDocument } from '#features/shoppingList/hooks/useListStoreComparison.generated';
import { StoreComparisonSection } from '../StoreComparisonSection';

type Comparison = MockDataFor<
  typeof ListStoreSavingsDocument
>['shoppingListStoreSavings'];
type Candidate = NonNullable<NonNullable<Comparison>['candidates']>[number];

function Section() {
  return <StoreComparisonSection listId="list-1" />;
}

// The rest is completed from the SDL.
const renderWith = (
  candidates: Candidate[],
  overrides: Partial<Comparison> = {},
) => {
  const query = recordMock(ListStoreSavingsDocument, {
    data: {
      shoppingListStoreSavings: {
        currency: { code: 'USD', decimalPlaces: 2 },
        comparableLines: 10,
        leftOutLines: 0,
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
  it('shows each store with its total and how much of it is its own shelf prices', async () => {
    renderWith([
      {
        store: { id: 'store-aldi', name: 'Aldi', address: null },
        total: 42.1,
        sameLines: 5,
        similarLines: 2,
        estimatedLines: 1,
      },
    ]);

    expect(
      await screen.findByText(formatCurrency(42.1, 'USD', 2)),
    ).toBeTruthy();
    expect(
      screen.getByText('7 priced here · 1 at a typical price'),
    ).toBeTruthy();
  });

  // Too few shelf prices there: no total that compares.
  it("shows the list's own store without a total while it has too few prices", async () => {
    renderWith([
      {
        store: { id: 'store-ge', name: 'Giant Eagle', address: null },
        total: null,
        sameLines: 1,
        similarLines: 0,
        estimatedLines: 9,
        isTarget: true,
      },
    ]);

    expect(await screen.findByText('Your store')).toBeTruthy();
    expect(screen.getByText('Not enough prices yet')).toBeTruthy();
  });

  // A whole chain has no branch to name, so the section leaves it out.
  it('shows branches only', async () => {
    renderWith([
      { store: null, chain: { id: 'chain-aldi', name: 'Aldi' }, total: 30 },
    ]);

    expect(
      await screen.findByText(
        'No store has enough recorded prices for this list yet. Every price entered when an item is ticked helps.',
      ),
    ).toBeTruthy();
  });

  it('says when no store has enough prices, and what was left out', async () => {
    renderWith([], { leftOutLines: 1 });

    expect(
      await screen.findByText(
        'No store has enough recorded prices for this list yet. Every price entered when an item is ticked helps.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "1 item can't be compared: it isn't in the catalog, or its unit doesn't convert.",
      ),
    ).toBeTruthy();
  });

  it("compares the household's usual stores", async () => {
    const query = renderWith([]);
    await screen.findByText('Compares 10 items on this list.');

    expect(query.fired).toEqual([{ input: { listId: 'list-1' } }]);
  });

  // The rest of Budget & prices reads from the device; this needs the server.
  it('says it needs a connection when it cannot be read offline', async () => {
    useStore.setState({ isOnline: false });
    const query = recordMock(ListStoreSavingsDocument, {
      error: new Error('Network request failed'),
    });
    renderWithApollo(<Section />, { operationMocks: [query.mock] });

    expect(await screen.findByText('Not available offline')).toBeTruthy();
    useStore.setState({ isOnline: true });
  });
});
