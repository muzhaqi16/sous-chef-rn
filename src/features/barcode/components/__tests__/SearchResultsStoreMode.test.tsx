// A scan from store mode puts the product in the cart: it ticks the list line
// the product fulfils, else adds the product as a line and ticks that. The
// hooks are mocked: what is under test is what the screen does with the line
// they report, not how they find it (`matchScannedLine.test.ts`,
// `useStoreModeCart.test.ts`).

import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

const mockAddToShoppingList = jest.fn();
jest.mock('#features/barcode/hooks/useAddScannedItem', () => ({
  useAddScannedItem: () => ({
    addToPantry: jest.fn(),
    restockDuplicate: jest.fn(),
    addToShoppingList: (...args: unknown[]) => mockAddToShoppingList(...args),
  }),
}));

const mockTick = jest.fn();
const mockCart = {
  line: null as null | {
    id: string;
    itemName: string;
    requestedQuantity: number;
    unitName: string | null;
    estimatedPrice: number | null;
  },
  inCart: false,
};
const mockCartListIds: (string | undefined)[] = [];
jest.mock('#features/shoppingList/hooks/useStoreModeCart', () => ({
  useStoreModeCart: (listId: string | undefined) => {
    mockCartListIds.push(listId);
    return {
      ...mockCart,
      tick: (...args: unknown[]) => mockTick(...args),
    };
  },
}));

// The sheet confirms 2 for $7.00 when pressed; its own form is pinned in
// `PurchaseAmountSheet.test.tsx`.
jest.mock('#features/shoppingList/ui/PurchaseAmountSheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    PurchaseAmountSheet: ({
      visible,
      item,
      onConfirm,
    }: {
      visible: boolean;
      item: { itemName: string; estimatedPrice: number | null } | null;
      onConfirm: (quantity: number, totalPrice: number | null) => void;
    }) =>
      visible && item ? (
        <Pressable testID="price-sheet" onPress={() => onConfirm(2, 7)}>
          <Text>{`${item.itemName} hint ${
            item.estimatedPrice ?? 'none'
          }`}</Text>
        </Pressable>
      ) : null,
  };
});

jest.mock('#store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
  ) => selector({ setPendingPantryScrollToTop: jest.fn() }),
}));
jest.mock('../ProductResultCard', () =>
  require('#/test-utils/searchResultsStubs'),
);
jest.mock('../ActionButtons', () => require('#/test-utils/searchResultsStubs'));

// Alerts have their own tests; here the household has nothing to check.
jest.mock('#features/barcode/hooks/useProductDietaryAlerts', () => ({
  useProductDietaryAlerts: () => ({
    check: 'none',
    alerts: [],
    alternatives: [],
  }),
}));

const onScanAnother = jest.fn();
const props: SearchResultsProps = {
  item: {
    id: 'jif-creamy',
    conceptIds: ['peanut-butter'],
    name: 'Jif Creamy',
    upc: '051500255162',
    canEdit: false,
    canSuggest: true,
    trackingUnit: { id: 'unit-jar', name: 'jar', symbol: 'jar' },
  },
  onScanAnother,
  source: 'storeMode',
  shoppingListId: 'list-1',
};

const LINE = {
  id: 'line-pb',
  itemName: 'Peanut butter',
  requestedQuantity: 1,
  unitName: 'jar',
  estimatedPrice: 3.49,
};

describe('SearchResults from store mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCart.line = null;
    mockCart.inCart = false;
    mockCartListIds.length = 0;
    mockTick.mockResolvedValue(true);
  });

  it('reads the cart of the list being shopped', () => {
    renderWithApollo(<SearchResults {...props} />);

    expect(mockCartListIds.at(-1)).toBe('list-1');
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });

  it('ticks the matched line with no price', async () => {
    mockCart.line = LINE;
    renderWithApollo(<SearchResults {...props} />);

    await userEvent.setup().press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(mockTick).toHaveBeenCalledWith('line-pb', null));
    expect(mockAddToShoppingList).not.toHaveBeenCalled();
    expect(onScanAnother).toHaveBeenCalled();
  });

  it('adds an unlisted product as a line and ticks that line', async () => {
    mockAddToShoppingList.mockResolvedValue({
      outcome: 'kept',
      rowId: 'new-1',
    });
    renderWithApollo(<SearchResults {...props} />);

    await userEvent.setup().press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(mockTick).toHaveBeenCalledWith('new-1', null));
    expect(mockAddToShoppingList).toHaveBeenCalledWith(props.item);
  });

  it('says so when the new line is refused, and ticks nothing', async () => {
    const alert = jest.spyOn(alertService, 'alert').mockImplementation();
    mockAddToShoppingList.mockResolvedValue({
      outcome: 'reverted',
      rowId: null,
    });
    renderWithApollo(<SearchResults {...props} />);

    await userEvent.setup().press(screen.getByTestId('primary-btn'));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        t('labels.error'),
        t('errors.addItemFailedRetry'),
      ),
    );
    expect(mockTick).not.toHaveBeenCalled();
    expect(onScanAnother).not.toHaveBeenCalled();
  });

  it('records what the shelf price sheet took', async () => {
    mockCart.line = LINE;
    renderWithApollo(<SearchResults {...props} />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('alternate-btn'));
    // The suggestion is the sheet's hint, never a recorded price.
    expect(screen.getByText('Peanut butter hint 3.49')).toBeTruthy();
    await user.press(screen.getByTestId('price-sheet'));

    await waitFor(() =>
      expect(mockTick).toHaveBeenCalledWith('line-pb', {
        quantity: 2,
        totalPrice: 7,
      }),
    );
  });

  it('prices an unlisted product as one of its own unit, with no hint', async () => {
    mockAddToShoppingList.mockResolvedValue({
      outcome: 'kept',
      rowId: 'new-1',
    });
    renderWithApollo(<SearchResults {...props} />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('alternate-btn'));
    expect(screen.getByText('Jif Creamy hint none')).toBeTruthy();
    await user.press(screen.getByTestId('price-sheet'));

    await waitFor(() =>
      expect(mockTick).toHaveBeenCalledWith('new-1', {
        quantity: 2,
        totalPrice: 7,
      }),
    );
  });

  it('offers nothing to add for a product already in the cart', () => {
    mockCart.inCart = true;
    renderWithApollo(<SearchResults {...props} />);

    const primary = screen.getByTestId('primary-btn');
    expect(screen.getByText(t('barcode.alreadyInCart'))).toBeTruthy();
    expect(primary.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.queryByTestId('alternate-btn')).toBeNull();
  });

  it('stays put when the tick is refused', async () => {
    mockCart.line = LINE;
    mockTick.mockResolvedValue(false);
    renderWithApollo(<SearchResults {...props} />);

    await userEvent.setup().press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(mockTick).toHaveBeenCalled());
    expect(onScanAnother).not.toHaveBeenCalled();
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });
});
