// The duplicate → Restock branch, which reports its outcome to nobody.
//
// `restockDuplicate` returns a `MutationOutcome`, and under `errorPolicy: 'all'`
// a refusal RESOLVES — so an unread outcome flips the button to "Added" and
// resets the scanner over a restock the server never made. The sibling
// `addToPantry` call in the same handler branches on its outcome.
//
// The feature hook is mocked here rather than driven through Apollo: the branch
// under test is what the screen does with the outcome, not how the hook
// produces one.

import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { promptPantryDuplicate } from '#domain/pantryItemDuplicate';
import { alertService } from '#/services/alertService';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#domain/pantryItemDuplicate', () => ({
  promptPantryDuplicate: jest.fn(),
}));

const mockAddToPantry = jest.fn();
const mockRestockDuplicate = jest.fn();
jest.mock('#features/barcode/hooks/useAddScannedItem', () => ({
  useAddScannedItem: () => ({
    addToPantry: (...args: unknown[]) => mockAddToPantry(...args),
    restockDuplicate: (...args: unknown[]) => mockRestockDuplicate(...args),
    forceAddPending: jest.fn(),
    revertPending: jest.fn(),
    addToShoppingList: jest.fn(),
  }),
}));

const mockSetPendingPantryScrollToTop = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
  ) =>
    selector({ setPendingPantryScrollToTop: mockSetPendingPantryScrollToTop }),
}));

jest.mock('#/utils/finallyHelpers', () =>
  jest.requireActual('#/utils/finallyHelpers'),
);

jest.mock('../ProductResultCard', () => ({
  ProductResultCard: ({ item }: { item: { name: string } }) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, item.name);
  },
}));

type MockAction = { label: string; onPress: () => void };
jest.mock('../ActionButtons', () => ({
  ActionButtons: ({ primaryAction }: { primaryAction?: MockAction }) => {
    const RN = require('react-native');
    const R = require('react');
    return primaryAction
      ? R.createElement(
          RN.Pressable,
          { onPress: primaryAction.onPress, testID: 'primary-btn' },
          R.createElement(RN.Text, null, primaryAction.label),
        )
      : null;
  },
}));

const onScanAnother = jest.fn();
const props: SearchResultsProps = {
  item: { id: 'item-1', name: 'Organic Milk', upc: '123456', netWeight: 1 },
  onScanAnother,
  source: 'pantry',
  pantryId: 'pantry-1',
};

/** Press Add, then take the Restock callback the duplicate prompt was given. */
const pressAddThenRestock = async () => {
  const user = userEvent.setup();
  renderWithApollo(<SearchResults {...props} />);

  await user.press(screen.getByTestId('primary-btn'));

  const opts = (promptPantryDuplicate as jest.Mock).mock.lastCall?.[0] as {
    onRestock: () => void;
  };
  await opts.onRestock();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAddToPantry.mockResolvedValue({
    status: 'duplicate',
    existingPantryItemId: 'pantry-item-9',
  });
});

describe('restocking a duplicate the scanner found', () => {
  it('reports a refusal instead of showing it as added', async () => {
    mockRestockDuplicate.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          __typename: 'ForbiddenError',
          code: 'FORBIDDEN',
          message: 'Not allowed',
        },
      },
    });

    await pressAddThenRestock();

    expect(mockRestockDuplicate).toHaveBeenCalledWith('pantry-item-9');
    expect(alertService.alert).toHaveBeenCalled();
    expect(onScanAnother).not.toHaveBeenCalled();
    expect(mockSetPendingPantryScrollToTop).not.toHaveBeenCalled();
  });

  it('completes the add when the restock is accepted', async () => {
    mockRestockDuplicate.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          __typename: 'PantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-9' },
        },
      },
    });

    await pressAddThenRestock();

    expect(onScanAnother).toHaveBeenCalledTimes(1);
    expect(mockSetPendingPantryScrollToTop).toHaveBeenCalledWith(true);
  });
});
