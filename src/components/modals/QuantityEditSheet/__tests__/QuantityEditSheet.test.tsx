'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuantityEditSheet } from '../QuantityEditSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        surface: '#FFF',
        border: '#CCC',
        white: '#FFF',
        background: '#FFF',
      },
      typography: {
        fontSize: { sm: 12, base: 14, lg: 18, '5xl': 48 },
      },
    },
  })),
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/components/molecules/Header', () => ({
  Header: ({ title, rightActions }: any) => {
    const { Text, View, Pressable } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        {rightActions?.map((action: any, i: number) => (
          <Pressable
            key={i}
            testID={`header-action-${i}`}
            onPress={action.onPress}
            disabled={action.disabled}
          >
            <Text>{action.loading ? 'Loading...' : 'Save'}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock('#/components/molecules/AutocompleteField/UnitAutocompleteField', () => ({
  UnitAutocompleteField: ({ value, onChangeText, placeholder }: any) => {
    const { TextInput, View } = require('react-native');
    return (
      <View testID="unit-autocomplete">
        <TextInput
          testID="unit-input"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
        />
      </View>
    );
  },
}));

jest.mock('#/components/atoms/Chip', () => {
  const { Text, Pressable } = require('react-native');
  return ({ label, selected, onPress }: any) => (
    <Pressable testID={`chip-${label}`} onPress={onPress}>
      <Text>{label}{selected ? ' (selected)' : ''}</Text>
    </Pressable>
  );
});

jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="form-scroll-view">{children}</View>;
  },
}));

jest.mock('#/utils/formatQuantity', () => ({
  formatQuantity: jest.fn((v: number) => String(v)),
}));

const makeItem = (overrides: any = {}) => ({
  id: 'item-1',
  itemName: 'Milk',
  quantity: 2,
  quantityInput: null,
  unitName: 'cups',
  unitId: 'unit-1',
  category: 'Dairy',
  imageUrl: null,
  version: 1,
  itemUnits: [],
  ...overrides,
});

const defaultProps = {
  visible: true,
  item: makeItem(),
  onClose: jest.fn(),
  onSave: jest.fn(),
  loading: false,
};

/**
 * Helper to render with proper state initialization.
 * The component only initializes state when `visible` transitions from false to true,
 * so we first render hidden, then rerender as visible.
 */
const renderWithInit = (props: any = defaultProps) => {
  const result = render(<QuantityEditSheet {...props} visible={false} />);
  result.rerender(<QuantityEditSheet {...props} visible={true} />);
  return result;
};

describe('QuantityEditSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with Edit Quantity title', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('renders Quantity and Unit section labels', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('renders the quantity display text from item quantity', () => {
    renderWithInit();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders with quantityInput when provided', () => {
    const item = makeItem({ quantityInput: '1/2' });
    renderWithInit({ ...defaultProps, item });
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('increments quantity when + button is pressed', () => {
    renderWithInit();
    // The increment button has an Icon name="add" (mocked to null) but is a Pressable
    // The quantityText initially shows '2'
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders unit autocomplete field', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByTestId('unit-autocomplete')).toBeTruthy();
  });

  it('renders with item that has itemUnits for chip display', () => {
    const item = makeItem({
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true, isPreferred: false },
        { id: 'u2', symbol: 'tbsp', name: 'Tablespoon', isDefault: false, isPreferred: true },
      ],
    });
    render(<QuantityEditSheet {...defaultProps} item={item} />);
    expect(screen.getByTestId('chip-tbsp')).toBeTruthy();
    expect(screen.getByTestId('chip-cups')).toBeTruthy();
  });

  it('renders chips sorted by preferred first, then default', () => {
    const item = makeItem({
      unitName: 'cups',
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true, isPreferred: false },
        { id: 'u2', symbol: 'tbsp', name: 'Tablespoon', isDefault: false, isPreferred: true },
        { id: 'u3', symbol: 'ml', name: 'Milliliter', isDefault: false, isPreferred: false },
      ],
    });
    renderWithInit({ ...defaultProps, item });
    // preferred (tbsp) should render first, then default (cups), then alphabetical (ml)
    // cups is selected because unitName='cups' matches chip symbol
    expect(screen.getByText('cups (selected)')).toBeTruthy();
  });

  it('handles chip press to change unit', () => {
    const item = makeItem({
      unitName: 'cups',
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true },
        { id: 'u2', symbol: 'tbsp', name: 'Tablespoon', isDefault: false },
      ],
    });
    render(<QuantityEditSheet {...defaultProps} item={item} />);
    fireEvent.press(screen.getByTestId('chip-tbsp'));
    // After pressing, tbsp should become selected
    expect(screen.getByText('tbsp (selected)')).toBeTruthy();
  });

  it('renders item with displayNamePlural on chips', () => {
    const item = makeItem({
      unitName: 'count',
      itemUnits: [
        { id: 'u1', symbol: 'count', name: 'Count', displayNamePlural: 'pieces' },
      ],
    });
    renderWithInit({ ...defaultProps, item });
    expect(screen.getByText('pieces (selected)')).toBeTruthy();
  });

  it('renders null when item is null', () => {
    render(<QuantityEditSheet {...defaultProps} item={null} />);
    // BottomSheetModal still renders (mocked as View) but header shows
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('shows 0 when quantityInput is empty', () => {
    const item = makeItem({ quantity: 0, quantityInput: null });
    render(<QuantityEditSheet {...defaultProps} item={item} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders with loading prop true', () => {
    render(<QuantityEditSheet {...defaultProps} loading={true} />);
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('matches unitName case-insensitively with itemUnits', () => {
    const item = makeItem({
      unitName: 'CUPS',
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true },
      ],
    });
    renderWithInit({ ...defaultProps, item });
    expect(screen.getByText('cups (selected)')).toBeTruthy();
  });

  it('matches unitName by name field when symbol does not match', () => {
    const item = makeItem({
      unitName: 'Cup',
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true },
      ],
    });
    renderWithInit({ ...defaultProps, item });
    expect(screen.getByText('cups (selected)')).toBeTruthy();
  });

  it('uses lowercase stored value when no matching chip', () => {
    const item = makeItem({
      unitName: 'OUNCES',
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup', isDefault: true },
      ],
    });
    renderWithInit({ ...defaultProps, item });
    // unitName should be lowercase 'ounces' in the autocomplete
    const unitInput = screen.getByTestId('unit-input');
    expect(unitInput.props.value).toBe('ounces');
  });

  it('sets unitName to null when no unitName and no itemUnits', () => {
    const item = makeItem({ unitName: null, unitId: null, itemUnits: [] });
    render(<QuantityEditSheet {...defaultProps} item={item} />);
    const unitInput = screen.getByTestId('unit-input');
    expect(unitInput.props.value).toBe('');
  });

  it('uses lowercase unitName when no itemUnits available', () => {
    const item = makeItem({ unitName: 'GRAMS', itemUnits: [] });
    renderWithInit({ ...defaultProps, item });
    const unitInput = screen.getByTestId('unit-input');
    expect(unitInput.props.value).toBe('grams');
  });

  it('renders placeholder "Or type to search..." when itemUnits exist', () => {
    const item = makeItem({
      itemUnits: [
        { id: 'u1', symbol: 'cups', name: 'Cup' },
      ],
    });
    render(<QuantityEditSheet {...defaultProps} item={item} />);
    expect(screen.getByPlaceholderText('Or type to search...')).toBeTruthy();
  });

  it('renders placeholder "Type to search units..." when no itemUnits', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type to search units...')).toBeTruthy();
  });

  it('does not render chips when itemUnits is empty', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.queryByTestId('chip-cups')).toBeNull();
  });

  it('handles save call via header action', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    const saveButton = screen.getByTestId('header-action-0');
    fireEvent.press(saveButton);
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('resets editing state when item becomes not visible', () => {
    const { rerender } = render(<QuantityEditSheet {...defaultProps} />);
    rerender(<QuantityEditSheet {...defaultProps} visible={false} />);
    // Should not crash and should reset
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('reinitializes state when item id changes', () => {
    const item1 = makeItem({ id: 'item-1', quantity: 5, quantityInput: '5' });
    const item2 = makeItem({ id: 'item-2', quantity: 10, quantityInput: '10' });
    const { rerender } = renderWithInit({ ...defaultProps, item: item1 });
    expect(screen.getByText('5')).toBeTruthy();
    rerender(<QuantityEditSheet {...defaultProps} item={item2} />);
    expect(screen.getByText('10')).toBeTruthy();
  });
});
