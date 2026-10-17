import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { PriceComparisonScope } from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { ListStoreComparisonDocument } from '#features/shoppingList/hooks/useListStoreComparison.generated';
import { StoreComparisonSection } from '../StoreComparisonSection';

type Comparison = MockDataFor<
  typeof ListStoreComparisonDocument
>['shoppingListStoreComparison'];

const comparison = (overrides: Partial<Comparison> = {}): Comparison => ({
  __typename: 'ShoppingListStoreComparison',
  scope: PriceComparisonScope.Store,
  currency: {
    __typename: 'Currency',
    id: 'cur-usd',
    code: 'USD',
    decimalPlaces: 2,
  },
  comparableLines: 10,
  leftOutLines: 0,
  truncated: false,
  unpricedLines: [],
  candidates: [],
  ...overrides,
});

type Candidate = NonNullable<NonNullable<Comparison>['candidates']>[number];

const branch = (
  id: string,
  name: string,
  overrides: Partial<Candidate> = {},
): Candidate => ({
  __typename: 'StoreComparisonCandidate',
  scope: PriceComparisonScope.Store,
  store: { __typename: 'Store', id, name, address: null },
  chain: null,
  estimatedTotal: 0,
  pricedLines: 0,
  chainFilledLines: 0,
  anyStoreFilledLines: 0,
  ranked: true,
  isTarget: false,
  newestObservedAt: null,
  ...overrides,
});

const renderWith = (answer: Comparison) => {
  const query = recordMock(ListStoreComparisonDocument, {
    data: { shoppingListStoreComparison: answer },
  });
  renderWithApollo(<StoreComparisonSection listId="list-1" />, {
    operationMocks: [query.mock],
  });
  return query;
};

describe('StoreComparisonSection', () => {
  it('ranks stores by total and says how much of each total is their own', async () => {
    renderWith(
      comparison({
        candidates: [
          branch('store-aldi', 'Aldi Main St', {
            chain: { __typename: 'StoreChain', id: 'chain-aldi', name: 'Aldi' },
            estimatedTotal: 42.1,
            pricedLines: 7,
            chainFilledLines: 2,
            anyStoreFilledLines: 1,
          }),
        ],
      }),
    );

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
    renderWith(
      comparison({
        candidates: [
          branch('store-corner', 'Corner Shop', {
            estimatedTotal: 50,
            pricedLines: 1,
            anyStoreFilledLines: 9,
            ranked: false,
            isTarget: true,
          }),
        ],
      }),
    );

    expect(await screen.findByText('Your store')).toBeTruthy();
    expect(screen.getByText('Not enough prices yet')).toBeTruthy();
    expect(screen.queryByText(formatCurrency(50, 'USD', 2))).toBeNull();
  });

  it('says when no store has enough prices, and what was left out', async () => {
    renderWith(
      comparison({
        leftOutLines: 1,
        unpricedLines: [
          { __typename: 'ShoppingListItem', id: 'line-1' },
          { __typename: 'ShoppingListItem', id: 'line-2' },
        ],
      }),
    );

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

  it('compares chains when asked', async () => {
    const query = renderWith(comparison());
    await screen.findByText('Compares 10 items on this list.');

    fireEvent.press(screen.getByText('Chains'));

    expect(query.fired).toContainEqual({
      input: { listId: 'list-1', scope: PriceComparisonScope.Chain },
    });
  });
});
