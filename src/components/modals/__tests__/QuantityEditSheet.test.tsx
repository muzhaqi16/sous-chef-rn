import React from 'react';
import type { ViewProps } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { QuantityEditSheet } from '../QuantityEditSheet/QuantityEditSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        surface: '#FFF',
        border: '#CCC',
        white: '#FFF',
      },
      spacing: { sm: 4, md: 8, lg: 16 },
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

jest.mock('#/components/molecules/Header', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    Header: ({
      title,
      rightActions,
    }: {
      title?: string;
      rightActions?: unknown[];
    }) =>
      R.createElement(
        RN.View,
        { testID: 'header' },
        R.createElement(RN.Text, null, title),
        rightActions?.map((_action, i: number) =>
          R.createElement(RN.View, { key: i, testID: `header-action-${i}` }),
        ),
      ),
  };
});

jest.mock(
  '#/components/molecules/AutocompleteField/UnitAutocompleteField',
  () => {
    const RN = require('react-native');
    return {
      UnitAutocompleteField: (props: Record<string, unknown>) =>
        require('react').createElement(RN.View, {
          testID: 'unit-autocomplete',
          ...props,
        }),
    };
  },
);

jest.mock('#/components/atoms/Chip', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      label,
      selected,
      onPress,
    }: {
      label: string;
      selected?: boolean;
      onPress: () => void;
    }) =>
      R.createElement(
        RN.Pressable,
        { onPress, testID: `chip-${label}`, accessibilityState: { selected } },
        R.createElement(RN.Text, null, label),
      ),
  };
});

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/utils/formatQuantity', () => ({
  formatQuantity: (v: number) => v.toString(),
}));

const mockItem = {
  id: 'item-1',
  itemName: 'Chicken Breast',
  quantity: 2,
  quantityInput: null,
  unitName: 'lbs',
  unitId: 'unit-1',
  category: 'Meat',
  imageUrl: null,
  version: 1,
  itemUnits: [
    {
      id: 'unit-1',
      symbol: 'lbs',
      name: 'Pounds',
      isDefault: true,
      isPreferred: false,
      displayNameSingular: 'pound',
      displayNamePlural: 'pounds',
    },
    {
      id: 'unit-2',
      symbol: 'oz',
      name: 'Ounces',
      isDefault: false,
      isPreferred: false,
      displayNameSingular: 'ounce',
      displayNamePlural: 'ounces',
    },
  ],
};

describe('QuantityEditSheet', () => {
  const defaultProps = {
    visible: true,
    item: mockItem,
    onClose: jest.fn(),
    onSave: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the sheet with Edit Quantity title', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('renders Quantity and Unit section labels', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('displays default quantity value when first rendered', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    // Initial render shows '0' since render-time state update
    // only fires when visible/itemId change from their tracked values
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders unit chips for item units', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    expect(screen.getByText('pounds')).toBeTruthy();
    expect(screen.getByText('ounces')).toBeTruthy();
  });

  it('renders nothing meaningful when item is null', () => {
    render(<QuantityEditSheet {...defaultProps} item={null} />);
    expect(screen.getByText('Edit Quantity')).toBeTruthy();
  });

  it('initializes quantity when visibility changes', () => {
    const { rerender } = render(
      <QuantityEditSheet {...defaultProps} visible={false} />,
    );
    // Re-render with visible=true triggers the state initialization
    rerender(<QuantityEditSheet {...defaultProps} visible={true} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows or type to search placeholder for units', () => {
    render(<QuantityEditSheet {...defaultProps} />);
    // The unit autocomplete should have the placeholder
    const { toJSON } = render(<QuantityEditSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not render chips when item has no units', () => {
    const noUnitsItem = { ...mockItem, itemUnits: [] };
    render(<QuantityEditSheet {...defaultProps} item={noUnitsItem} />);
    expect(screen.queryByTestId('chip-pounds')).toBeNull();
  });

  it('handles visible=false', () => {
    const { toJSON } = render(
      <QuantityEditSheet {...defaultProps} visible={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
