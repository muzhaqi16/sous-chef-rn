// A scan from store mode puts the product in the cart: it ticks the list line
// the product fulfils, else adds the product as a line and ticks that. The
// hooks are mocked: what is under test is what the screen does with the line
// they report, not how they find it (`matchScannedLine.test.ts`,
// `useStoreModeCart.test.ts`).

import React from 'react';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

const mockAddToShoppingList = jest.fn();
jest.mock('#features/barcode/hooks/useAddScannedItem', () => ({
  useAddScannedItem: () => ({
    addToPantry: jest.fn(),
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
  unit: null as null | { id: string; symbol: string },
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
      describePrice,
    }: {
      visible: boolean;
      item: { itemName: string; estimatedPrice: number | null } | null;
      onConfirm: (quantity: number, totalPrice: number | null) => void;
      describePrice?: (unitPrice: number) => string | null;
    }) =>
      visible && item ? (
        <Pressable testID="price-sheet" onPress={() => onConfirm(2, 7)}>
          <Text>{`${item.itemName} hint ${
            item.estimatedPrice ?? 'none'
          }`}</Text>
          <Text>{describePrice?.(3.5) ?? 'no comparison'}</Text>
        </Pressable>
      ) : null,
  };
});

jest.mock('#store/useAppStore', () => ({
  useCachedUnits: () => [],
  useAppStore: (
    selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
  ) => selector({ setPendingPantryScrollToTop: jest.fn() }),
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
  useProductBrandListings: () => ({ listings: [] }),
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

const mockShowPrices = jest.fn(() => true);
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: () => mockShowPrices(),
}));

// The price lines have their own tests; here, which list they are read for.
const mockPriceListIds: (string | undefined)[] = [];
const mockPriceUnits: ({ id: string } | undefined)[] = [];
jest.mock('#features/barcode/hooks/useStorePriceMemory', () => ({
  useStorePriceMemory: (
    _itemId: string,
    listId: string | undefined,
    unit: { id: string } | undefined,
  ) => {
    mockPriceListIds.push(listId);
    mockPriceUnits.push(unit);
    return {
      lastPaid: null,
      usual: listId ? '$7.69/kg' : null,
      typical: null,
      compareToUsual: (unitPrice: number) => `compared ${unitPrice}`,
    };
  },
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
    trackingUnit: {
      id: 'unit-jar',
      name: 'jar',
      symbol: 'jar',
      type: UnitType.Count,
    },
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
    mockCart.unit = null;
    mockCart.inCart = false;
    mockCartListIds.length = 0;
    mockTick.mockResolvedValue(true);
  });

  it('reads the cart of the list being shopped', () => {
    renderWithApollo(<SearchResults {...props} />);

    expect(mockCartListIds.at(-1)).toBe('list-1');
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });

  it('shows the price lines for the list being shopped, and none outside store mode', () => {
    const { unmount } = renderWithApollo(<SearchResults {...props} />);

    expect(mockPriceListIds.at(-1)).toBe('list-1');
    expect(screen.getByText(t('barcode.price.usual'))).toBeTruthy();
    unmount();

    renderWithApollo(<SearchResults {...props} source="shoppingList" />);

    expect(mockPriceListIds.at(-1)).toBeUndefined();
    expect(screen.queryByText(t('barcode.price.usual'))).toBeNull();
  });

  // The list's own setting: its prices still show, but nobody is asked for one.
  it('offers no add with price for a list that does not track prices', () => {
    renderWithApollo(<SearchResults {...props} />, {
      cache: seedCache([
        { __typename: 'ShoppingList', id: 'list-1', priceTracking: false },
      ]),
    });

    expect(mockPriceListIds.at(-1)).toBe('list-1');
    expect(screen.queryByTestId('alternate-btn')).toBeNull();
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });

  // Budget & prices off: the product and the add, nothing about money.
  describe('with budget and prices off', () => {
    beforeEach(() => mockShowPrices.mockReturnValue(false));
    afterEach(() => mockShowPrices.mockReturnValue(true));

    it('reads no price lines and offers no add with price', () => {
      renderWithApollo(<SearchResults {...props} />);

      expect(mockPriceListIds.at(-1)).toBeUndefined();
      expect(screen.queryByText(t('barcode.price.usual'))).toBeNull();
      expect(screen.queryByTestId('alternate-btn')).toBeNull();
      expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
    });

    it('still ticks the matched line, with no price', async () => {
      mockCart.line = LINE;
      renderWithApollo(<SearchResults {...props} />);

      await userEvent.setup().press(screen.getByTestId('primary-btn'));

      await waitFor(() =>
        expect(mockTick).toHaveBeenCalledWith('line-pb', null),
      );
    });
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

  // Two adds racing for one line could leave the priced one unrecorded.
  it('offers no add with price while an add is in flight', async () => {
    let finish!: (added: { outcome: 'kept'; rowId: string }) => void;
    mockAddToShoppingList.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    renderWithApollo(<SearchResults {...props} />);
    const priceAction = () =>
      screen.getByTestId('alternate-btn').props.accessibilityState;
    expect(priceAction()).toEqual({ disabled: false });

    await userEvent.setup().press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(priceAction()).toEqual({ disabled: true }));
    await act(async () => finish({ outcome: 'kept', rowId: 'new-1' }));
    await waitFor(() => expect(mockTick).toHaveBeenCalledWith('new-1', null));
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

  it("compares a shelf price in the unit the sheet counts: the line's, else the product's", async () => {
    const user = userEvent.setup();
    mockCart.line = LINE;
    mockCart.unit = { id: 'unit-jar', symbol: 'jar' };
    const { unmount } = renderWithApollo(<SearchResults {...props} />);
    expect(mockPriceUnits.at(-1)).toEqual({ id: 'unit-jar', symbol: 'jar' });
    await user.press(screen.getByTestId('alternate-btn'));
    expect(screen.getByText('compared 3.5')).toBeTruthy();
    unmount();

    // An unlisted product counts in its own unit.
    mockCart.line = null;
    mockCart.unit = null;
    const unlisted = renderWithApollo(<SearchResults {...props} />);
    expect(mockPriceUnits.at(-1)).toEqual(props.item.trackingUnit);
    await user.press(screen.getByTestId('alternate-btn'));
    expect(screen.getByText('compared 3.5')).toBeTruthy();
    unlisted.unmount();

    // A line with no unit of its own counts in something the usual is not on.
    mockCart.line = LINE;
    renderWithApollo(<SearchResults {...props} />);
    await user.press(screen.getByTestId('alternate-btn'));
    expect(screen.getByText('no comparison')).toBeTruthy();
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
