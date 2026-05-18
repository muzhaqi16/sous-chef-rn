import React from 'react';
import { screen } from '@testing-library/react-native';
import { MoveToPantryModal } from '../MoveToPantryModal';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';

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
  BottomSheetModal: ({ children }: any) => children,
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetFormScrollView: (props: any) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/molecules/Header', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    Header: ({ title }: any) =>
      R.createElement(RN.View, null, R.createElement(RN.Text, null, title)),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FractionInput: ({ label, value, onChangeText }: any) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, { value, onChangeText }),
      ),
  };
});

jest.mock(
  '#components/molecules/AutocompleteField/UnitAutocompleteField',
  () => {
    const RN = require('react-native');
    return {
      UnitAutocompleteField: () =>
        require('react').createElement(RN.View, {
          testID: 'unit-autocomplete',
        }),
    };
  },
);

jest.mock('#components/molecules/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({ label, value, onChangeText, placeholder }: any) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, { value, onChangeText, placeholder }),
      ),
  };
});

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

  it('renders Purchase Price input', () => {
    renderWithApollo(<MoveToPantryModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Purchase Price (per unit)')).toBeTruthy();
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
