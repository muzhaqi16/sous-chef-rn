'use no memo';
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SearchResults, type SearchResultsProps } from '../SearchResults';
import { renderWithProviders } from '#/test-utils/renderWithProviders';
import { recordMock } from '#/test-utils/apolloMockProvider';
import { BarcodeCreatePantryItemDocument } from '../SearchResults.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => {
  const { classifyCreateResult } = jest.requireActual(
    '#/apollo/utils/classifyCreateResult',
  );
  const revertOptimisticShoppingListItem = jest.fn();
  return {
    addNewItemToShoppingListCache: jest.fn(),
    adoptServerShoppingListItemId: jest.fn(),
    revertOptimisticShoppingListItem,
    addOptimisticShoppingListItem: jest.fn(),
    createOptimisticShoppingListItem: jest.fn((id: string) => ({
      __typename: 'ShoppingListItem',
      id,
    })),
    // Mirror the real reconciler (real classify + mocked revert) so the
    // keep/revert decision under test matches production.
    reconcileShoppingCreate: jest.fn(
      (cache: unknown, listId: string, id: string, result: unknown) => {
        if (classifyCreateResult(result) === 'rejected') {
          revertOptimisticShoppingListItem(cache, listId, id);
          return 'reverted';
        }
        return 'kept';
      },
    ),
  };
});

jest.mock('#/utils/errors/pantryItemDuplicate', () => {
  const isDup = jest.fn().mockReturnValue(false);
  const getInfo = jest.fn().mockReturnValue(null);
  const getInfoFromPayload = jest.fn().mockReturnValue(null);
  return {
    isPantryItemDuplicateError: isDup,
    getPantryItemDuplicateInfo: getInfo,
    getPantryItemDuplicateInfoFromPayload: getInfoFromPayload,
    promptPantryDuplicate: jest.fn(),
    getPantryItemDuplicateFromResult: jest.fn(
      (payload: { __typename?: string } | null | undefined, error: unknown) => {
        if (payload?.__typename === 'DuplicatePantryItemError') {
          const info = getInfoFromPayload(payload);
          if (info) return info;
        }
        if (error != null && isDup(error)) return getInfo(error);
        return null;
      },
    ),
  };
});

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(
    (
      selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
    ) => {
      const state = { setPendingPantryScrollToTop: jest.fn() };
      return selector(state);
    },
  ),
}));

// Use the real wrappers so pressing the add button actually runs the async
// handler (the auto-mock would no-op the callbacks and never fire the mutation).
jest.mock('#/utils/compilerSafeWrappers', () =>
  jest.requireActual('#/utils/compilerSafeWrappers'),
);

jest.mock('../ProductResultCard', () => ({
  ProductResultCard: ({ item }: { item: { name: string } }) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, item.name);
  },
}));

type MockAction = { label: string; onPress: () => void };
jest.mock('../ActionButtons', () => ({
  ActionButtons: ({
    primaryAction,
    secondaryAction,
  }: {
    primaryAction?: MockAction;
    secondaryAction: MockAction;
  }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      null,
      primaryAction
        ? R.createElement(
            RN.Pressable,
            { onPress: primaryAction.onPress, testID: 'primary-btn' },
            R.createElement(RN.Text, null, primaryAction.label),
          )
        : null,
      R.createElement(
        RN.Pressable,
        { onPress: secondaryAction.onPress, testID: 'secondary-btn' },
        R.createElement(RN.Text, null, secondaryAction.label),
      ),
    );
  },
}));

describe('SearchResults', () => {
  const mockItem = {
    id: 'item-1',
    name: 'Organic Milk',
    upc: '123456',
    netWeight: 1,
  };

  const defaultProps: SearchResultsProps = {
    item: mockItem,
    onScanAnother: jest.fn(),
    source: 'pantry',
    pantryId: 'pantry-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  it('renders Add to Pantry button for pantry source', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });

  it('renders Add to Shopping List button for shopping list source', () => {
    renderWithProviders(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        shoppingListId="list-1"
      />,
    );
    expect(screen.getByText('Add to Shopping List')).toBeTruthy();
  });

  it('renders Scan Another button', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Scan Another')).toBeTruthy();
  });

  // The screen is only reached from a pantry or shopping list, both of which
  // pass a source — but `scan/result` is deep-linkable, so a link can land a
  // user here with no destination. Offering a button that silently no-ops (its
  // handler returns early on `!source`) is worse than offering none.
  it('offers no add action when there is no source to add to', () => {
    renderWithProviders(<SearchResults {...defaultProps} source={undefined} />);
    expect(screen.queryByTestId('primary-btn')).toBeNull();
    // The card and the escape hatch still render.
    expect(screen.getByText('Scan Another')).toBeTruthy();
  });

  it('sends quantity 1 (not the net weight) when adding a scanned item to the pantry', async () => {
    // A 1.89 L carton: quantity is the CONTAINER COUNT (1), the per-container
    // weight goes in the separate netWeight input. Sending quantity = netWeight
    // would make the server compute remainingNetWeight = netWeight² (regression).
    const rec = recordMock(BarcodeCreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
        },
      },
    });

    renderWithProviders(
      <SearchResults
        {...defaultProps}
        item={{
          ...mockItem,
          netWeight: 1.89,
          displayUnit: { id: 'unit-litre', name: 'litre', symbol: 'L' },
        }}
      />,
      { apolloProps: { mocks: [rec.mock] } },
    );

    fireEvent.press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
    const firedInput = (
      rec.fired[0] as {
        input: {
          quantity: number;
          netWeight: { netWeight: number; netWeightUnitId: string } | null;
        };
      }
    ).input;
    expect(firedInput.quantity).toBe(1);
    expect(firedInput.netWeight).toEqual({
      netWeight: 1.89,
      netWeightUnitId: 'unit-litre',
    });
  });
});
