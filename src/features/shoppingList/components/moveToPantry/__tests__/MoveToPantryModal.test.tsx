import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ViewProps } from 'react-native';
import { MoveToPantryModal } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal';
import {
  type MockedResponse,
  renderWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MoveToPantryPurchaseInfoDocument } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal.generated';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        surface: '#FFF',
        surfaceVariant: '#F5F5F5',
        border: '#CCC',
        white: '#FFF',
        error: '#FF0000',
        background: '#FFF',
      },
      spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24 },
    },
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetFormScrollView: (props: ViewProps) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/molecules/Header', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    // Actions are rendered, not just the title: the confirm tap is the only way
    // to observe what the sheet sends.
    Header: ({
      title,
      rightActions = [],
    }: {
      title: string;
      rightActions?: Array<{ icon: string; onPress: () => void }>;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, title),
        ...rightActions.map((action, index) =>
          R.createElement(
            RN.Text,
            {
              key: index,
              testID: `header-action-${action.icon}`,
              onPress: action.onPress,
            },
            action.icon,
          ),
        ),
      ),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FractionInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          testID: 'move-to-pantry-quantity',
          value,
          onChangeText,
        }),
      ),
  };
});

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
  const RN = require('react-native');
  return {
    UnitAutocompleteField: () =>
      require('react').createElement(RN.View, {
        testID: 'unit-autocomplete',
      }),
  };
});

jest.mock('#components/molecules/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          testID: `move-to-pantry-field-${label}`,
          value,
          onChangeText,
          placeholder,
        }),
      ),
  };
});

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (input: string) => {
    const val = parseFloat(input);
    return isNaN(val) ? null : val;
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: () =>
      require('react').createElement(RN.View, { testID: 'date-picker' }),
  };
});

const ITEM_ID = 'sli-1';

function makeCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      __typename: 'ShoppingListItem',
      id: ITEM_ID,
      itemName: 'Milk',
      quantity: 2,
      unitName: 'gal',
      unit: {
        __typename: 'Unit',
        id: 'u1',
        symbol: 'gal',
        name: 'Gallons',
      },
      ...overrides,
    },
  ]);
}

const mockPantries = [
  { id: 'p1', name: 'Kitchen Pantry', isDefault: true },
  { id: 'p2', name: 'Garage', isDefault: false },
];

describe('MoveToPantryModal', () => {
  const defaultProps = {
    visible: true,
    shoppingListItemId: ITEM_ID,
    pantries: mockPantries,
    selectedPantryId: 'p1',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Move to Pantry title', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Move to Pantry')).toBeTruthy();
  });

  it('displays item name', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders pantry options', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Kitchen Pantry')).toBeTruthy();
    expect(screen.getByText('Garage')).toBeTruthy();
  });

  it('shows Default badge on default pantry', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders Quantity input', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('renders Storage Type section', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Storage Type')).toBeTruthy();
  });

  it('renders Expiration Date section', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Expiration Date')).toBeTruthy();
  });

  it('renders Remove from shopping list toggle', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Remove from shopping list')).toBeTruthy();
  });

  it('renders notes input', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Notes (Optional)')).toBeTruthy();
  });

  it('does not render item info when shoppingListItemId is null', () => {
    renderWithApollo(
      <MoveToPantryModal {...defaultProps} shoppingListItemId={null} />,
      { cache: makeCache() },
    );
    expect(screen.queryByText('Milk')).toBeNull();
  });

  it('shows shopping list quantity with unit symbol', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText(/Shopping list quantity: 2/)).toBeTruthy();
  });

  it('uses unitName when unit.symbol is missing', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache({ unit: null, unitName: 'gallons' }),
    });
    expect(screen.getByText(/Shopping list quantity/)).toBeTruthy();
  });

  it('shows quantity as 1 when no quantity is set', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache({ quantity: null }),
    });
    expect(screen.getByText(/Shopping list quantity: 1/)).toBeTruthy();
  });

  it('renders all storage state options', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Ambient')).toBeTruthy();
    expect(screen.getByText('Refrigerated')).toBeTruthy();
    expect(screen.getByText('Frozen')).toBeTruthy();
  });

  it('shows Select date text when no expiration date is set', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Select date')).toBeTruthy();
  });

  it('asks for the total paid, the same question Mark Purchased asks', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Total price')).toBeTruthy();
  });

  describe('seeding from the recorded purchase', () => {
    // A line requested as 2 but BOUGHT as 5 for $2.95 the whole lot.
    const purchaseMock = (
      purchasedQuantity: number | null,
      purchasedPrice: number | null,
    ): MockedResponse => ({
      request: {
        query: MoveToPantryPurchaseInfoDocument,
        variables: { id: ITEM_ID },
      },
      result: {
        data: {
          shoppingListItem: {
            __typename: 'ShoppingListItem',
            id: ITEM_ID,
            purchasesConnection: {
              __typename: 'PurchaseConnection',
              edges: [
                {
                  __typename: 'PurchaseEdge',
                  node: {
                    __typename: 'Purchase',
                    id: 'pu1',
                    unitId: 'u-purchase',
                    unitSymbol: 'lb',
                  },
                },
              ],
            },
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
              purchasedQuantity,
              purchasedPrice,
              purchaseDate: '2026-08-30T00:00:00Z',
              purchasedBy: null,
            },
          },
        },
      },
    });

    // Mounted closed, then opened: the seed runs on the closed -> open
    // transition, which is the lifecycle the sheet actually sees.
    const openWithPurchase = (
      purchasedQuantity: number | null,
      purchasedPrice: number | null,
      onConfirm = jest.fn(),
    ) => {
      const { rerender } = renderWithApollo(
        <MoveToPantryModal
          {...defaultProps}
          visible={false}
          onConfirm={onConfirm}
        />,
        {
          cache: makeCache(),
          operationMocks: [purchaseMock(purchasedQuantity, purchasedPrice)],
        },
      );
      rerender(
        <MoveToPantryModal
          {...defaultProps}
          visible={true}
          onConfirm={onConfirm}
        />,
      );
      return onConfirm;
    };

    it('prefills the amounts that were bought, not the ones requested', async () => {
      openWithPurchase(5, 0.59);

      await waitFor(() =>
        expect(screen.getByText('Purchased: 5 gal')).toBeTruthy(),
      );
      expect(screen.getByTestId('move-to-pantry-quantity').props.value).toBe(
        '5',
      );
      // The field shows the TOTAL; the API stores the $0.59 per unit.
      expect(
        screen.getByTestId('move-to-pantry-field-Total price').props.value,
      ).toBe('2.95');
    });

    it('sends the per-unit price the API expects', async () => {
      const onConfirm = openWithPurchase(5, 0.59);
      await waitFor(() =>
        expect(screen.getByText('Purchased: 5 gal')).toBeTruthy(),
      );

      fireEvent.press(screen.getByTestId('header-action-checkmark'));
      const sent = onConfirm.mock.calls[0][0];
      expect(sent.actualQuantity).toBe(5);
      // Unrounded on purpose (`unitPriceFromTotal`): the server rounds the
      // PRODUCT, so a total that does not divide evenly still comes back whole.
      expect(sent.actualPrice).toBeCloseTo(0.59, 10);
    });

    it('holds the per-unit price when fewer units are stocked', async () => {
      const onConfirm = openWithPurchase(5, 0.59);
      await waitFor(() =>
        expect(screen.getByText('Purchased: 5 gal')).toBeTruthy(),
      );

      fireEvent.changeText(screen.getByTestId('move-to-pantry-quantity'), '3');

      // The total follows the quantity; the unit price is what was paid.
      expect(
        screen.getByTestId('move-to-pantry-field-Total price').props.value,
      ).toBe('1.77');

      fireEvent.press(screen.getByTestId('header-action-checkmark'));
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ actualQuantity: 3, actualPrice: 0.59 }),
      );
    });

    it('takes the unit from the purchase when the line carries none', async () => {
      // `purchaseInfo` has the amounts but no unit, and a line's own unit is
      // nullable — `Purchase.unitId` is not.
      const onConfirm = jest.fn();
      const { rerender } = renderWithApollo(
        <MoveToPantryModal
          {...defaultProps}
          visible={false}
          onConfirm={onConfirm}
        />,
        {
          cache: makeCache({ unit: null, unitName: null }),
          operationMocks: [purchaseMock(5, 0.59)],
        },
      );
      rerender(
        <MoveToPantryModal
          {...defaultProps}
          visible={true}
          onConfirm={onConfirm}
        />,
      );

      await waitFor(() =>
        expect(screen.getByText('Purchased: 5 ')).toBeTruthy(),
      );
      fireEvent.press(screen.getByTestId('header-action-checkmark'));
      expect(onConfirm.mock.calls[0][0].actualUnitId).toBe('u-purchase');
    });

    it('falls back to the requested quantity when nothing was recorded', async () => {
      openWithPurchase(null, null);

      await waitFor(() =>
        expect(screen.getByText('Shopping list quantity: 2 gal')).toBeTruthy(),
      );
      expect(screen.getByTestId('move-to-pantry-quantity').props.value).toBe(
        '2',
      );
      expect(
        screen.getByTestId('move-to-pantry-field-Total price').props.value,
      ).toBe('');
    });
  });

  it('resets form when modal opens with new item', () => {
    const cache = makeCache();
    const { rerender } = renderWithApollo(
      <MoveToPantryModal
        {...defaultProps}
        visible={false}
        shoppingListItemId={null}
      />,
      { cache },
    );
    rerender(
      <MoveToPantryModal
        {...defaultProps}
        visible={true}
        shoppingListItemId={ITEM_ID}
      />,
    );
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders with empty pantries list', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} pantries={[]} />, {
      cache: makeCache(),
    });
    // Should still render but without pantry selector
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.queryByText('Select Pantry')).toBeNull();
  });

  it('hides empty pantries section label when no pantries', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} pantries={[]} />, {
      cache: makeCache(),
    });
    expect(screen.queryByText('Kitchen Pantry')).toBeNull();
    expect(screen.queryByText('Garage')).toBeNull();
  });
});
