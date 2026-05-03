import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MoveToPantryModal } from '../MoveToPantryModal';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';

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

const mockShoppingListItem = {
  id: 'sli-1',
  itemName: 'Milk',
  quantity: 2,
  unit: { id: 'u1', symbol: 'gal', name: 'Gallons' },
  unitName: 'gal',
} as unknown as ShoppingListItemDisplayFragment;

const mockPantries = [
  { id: 'p1', name: 'Kitchen Pantry', isDefault: true },
  { id: 'p2', name: 'Garage', isDefault: false },
];

describe('MoveToPantryModal', () => {
  const defaultProps = {
    visible: true,
    shoppingListItem: mockShoppingListItem,
    pantries: mockPantries,
    selectedPantryId: 'p1',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Move to Pantry title', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Move to Pantry')).toBeTruthy();
  });

  it('displays item name', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders pantry options', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Kitchen Pantry')).toBeTruthy();
    expect(screen.getByText('Garage')).toBeTruthy();
  });

  it('shows Default badge on default pantry', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders Quantity input', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('renders Storage Type section', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Storage Type')).toBeTruthy();
  });

  it('renders Expiration Date section', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Expiration Date')).toBeTruthy();
  });

  it('renders Remove from shopping list toggle', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Remove from shopping list')).toBeTruthy();
  });

  it('renders notes input', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Notes (Optional)')).toBeTruthy();
  });

  it('does not render item info when shoppingListItem is null', () => {
    render(<MoveToPantryModal {...defaultProps} shoppingListItem={null} />);
    expect(screen.queryByText('Milk')).toBeNull();
  });

  it('shows shopping list quantity with unit symbol', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText(/Shopping list quantity: 2/)).toBeTruthy();
  });

  it('uses unitName when unit.symbol is missing', () => {
    const itemWithUnitName = {
      ...mockShoppingListItem,
      unit: null,
      unitName: 'gallons',
    } as unknown as ShoppingListItemDisplayFragment;

    render(
      <MoveToPantryModal
        {...defaultProps}
        shoppingListItem={itemWithUnitName}
      />,
    );
    expect(screen.getByText(/Shopping list quantity/)).toBeTruthy();
  });

  it('shows quantity as 1 when no quantity is set', () => {
    const itemWithoutQuantity = {
      ...mockShoppingListItem,
      quantity: null,
    } as unknown as ShoppingListItemDisplayFragment;

    render(
      <MoveToPantryModal
        {...defaultProps}
        shoppingListItem={itemWithoutQuantity}
      />,
    );
    expect(screen.getByText(/Shopping list quantity: 1/)).toBeTruthy();
  });

  it('renders all storage state options', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('AMBIENT')).toBeTruthy();
    expect(screen.getByText('REFRIGERATED')).toBeTruthy();
    expect(screen.getByText('FROZEN')).toBeTruthy();
  });

  it('shows Select date text when no expiration date is set', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Select date')).toBeTruthy();
  });

  it('renders Purchase Price input', () => {
    render(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Purchase Price (per unit)')).toBeTruthy();
  });

  it('resets form when modal opens with new item', () => {
    const { rerender } = render(
      <MoveToPantryModal
        {...defaultProps}
        visible={false}
        shoppingListItem={null}
      />,
    );
    rerender(
      <MoveToPantryModal
        {...defaultProps}
        visible={true}
        shoppingListItem={mockShoppingListItem}
      />,
    );
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders with empty pantries list', () => {
    render(<MoveToPantryModal {...defaultProps} pantries={[]} />);
    // Should still render but without pantry selector
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.queryByText('Select Pantry')).toBeNull();
  });

  it('hides empty pantries section label when no pantries', () => {
    render(<MoveToPantryModal {...defaultProps} pantries={[]} />);
    expect(screen.queryByText('Kitchen Pantry')).toBeNull();
    expect(screen.queryByText('Garage')).toBeNull();
  });
});
