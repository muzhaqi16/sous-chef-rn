// The duplicate → Restock branch. `restockDuplicate` resolves whether the
// restock stands — the hook has already told the user when it does not — so a
// refusal must not flip the button to "Added" or reset the scanner.
//
// The feature hook is mocked here rather than driven through Apollo: the branch
// under test is what the screen does with the outcome, not how the hook
// produces one.

import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { promptPantryDuplicate } from '#domain/pantryItemDuplicate';
import { alertService } from '#/services/alertService';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

jest.mock('#domain/pantryItemDuplicate', () => ({
  promptPantryDuplicate: jest.fn(),
}));

const mockAddToPantry = jest.fn();
const mockRestockDuplicate = jest.fn();
jest.mock('#features/barcode/hooks/useAddScannedItem', () => ({
  useAddScannedItem: () => ({
    addToPantry: (...args: unknown[]) => mockAddToPantry(...args),
    restockDuplicate: (...args: unknown[]) => mockRestockDuplicate(...args),
    addToShoppingList: jest.fn(),
    heldUnitOf: () => null,
  }),
}));

const mockSetPendingPantryScrollToTop = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useCachedUnits: () => [
    { id: 'unit-pc', name: 'piece', symbol: 'pc', type: 'COUNT' },
  ],
  useAppStore: (
    selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
  ) =>
    selector({ setPendingPantryScrollToTop: mockSetPendingPantryScrollToTop }),
}));

jest.mock('../ProductResultCard', () =>
  require('#/test-utils/searchResultsStubs'),
);
jest.mock('../ActionButtons', () => require('#/test-utils/searchResultsStubs'));

// Alerts have their own tests; here the household has nothing to check.
jest.mock('#features/barcode/hooks/useProductOrigin', () => ({
  useProductOrigin: () => ({ lines: [] }),
}));
jest.mock('#features/barcode/hooks/useProductBrandListings', () => ({
  useProductBrandListings: () => ({ listings: [], refresh: jest.fn() }),
}));
jest.mock('#features/profile/hooks/useBrandLists', () => ({
  useBrandLists: () => ({ lists: [], addBrand: jest.fn() }),
}));
jest.mock('#features/barcode/hooks/useProductDietaryAlerts', () => ({
  useProductDietaryAlerts: () => ({
    check: 'none',
    alerts: [],
    alternatives: [],
  }),
}));
jest.mock('#features/barcode/hooks/useStorePriceMemory', () => ({
  useStorePriceMemory: () => ({ lastPaid: null, usual: null, typical: null }),
}));

/** What the add stated: one package counted in a piece, sized by the record. */
const ONE_PACKAGE = {
  packaged: true,
  count: 1,
  unitId: 'unit-pc',
  size: null,
  consumeUnitId: null,
};

const onScanAnother = jest.fn();
const props: SearchResultsProps = {
  item: {
    id: 'item-1',
    conceptIds: [],
    name: 'Organic Milk',
    upc: '123456',
    netWeight: 1,
    canEdit: false,
    canSuggest: true,
  },
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
  // `onRestock` returns nothing to await; `act` flushes the work it starts.
  await act(async () => {
    opts.onRestock();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAddToPantry.mockResolvedValue({
    status: 'duplicate',
    existingPantryItemId: 'pantry-item-9',
  });
});

describe('restocking a duplicate the scanner found', () => {
  it('does not show a refused restock as added', async () => {
    mockRestockDuplicate.mockResolvedValue(false);

    await pressAddThenRestock();

    expect(mockRestockDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      'pantry-item-9',
      ONE_PACKAGE,
    );
    // The hook presents the refusal; the screen adds no second message.
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onScanAnother).not.toHaveBeenCalled();
    expect(mockSetPendingPantryScrollToTop).not.toHaveBeenCalled();
  });

  it('completes the add when the restock is accepted', async () => {
    mockRestockDuplicate.mockResolvedValue(true);

    await pressAddThenRestock();

    expect(onScanAnother).toHaveBeenCalledTimes(1);
    expect(mockSetPendingPantryScrollToTop).toHaveBeenCalledWith(true);
  });

  // The amount the add stated is what the pantry's stock of it grows by.
  it('restocks by the amount the add stated', async () => {
    mockRestockDuplicate.mockResolvedValue(true);
    const user = userEvent.setup();
    renderWithApollo(<SearchResults {...props} />);

    await user.press(screen.getByTestId('primary-btn'));

    expect(mockAddToPantry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      ONE_PACKAGE,
    );
    const opts = (promptPantryDuplicate as jest.Mock).mock.lastCall?.[0] as {
      onRestock: () => void;
    };
    await act(async () => {
      opts.onRestock();
    });

    expect(mockRestockDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      'pantry-item-9',
      ONE_PACKAGE,
    );
    expect(onScanAnother).toHaveBeenCalledTimes(1);
  });
});
