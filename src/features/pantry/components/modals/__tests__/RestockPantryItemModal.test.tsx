'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RestockPantryItemModal } from '#features/pantry/components/modals/RestockPantryItemModal';

// Minimal stand-ins for the props the mocked PantryActionModal feeds back to
// `renderActionFields`; matches exactly what this stub constructs.
type RestockMockSharedState = {
  trackingQuantity: number;
  trackingUnitSymbol: string;
  trackingUnitId: string;
  activeUnitSymbol: string;
  activeUnitId: string;
  isConvertedUnit: boolean;
  selectedUnitInfo: {
    unitId: string;
    unitSymbol: string;
    unitName: string;
    unitType: string;
    isTrackingUnit: boolean;
    conversionConfidence: number | null;
  };
  setSelectedUnitInfo: jest.Mock;
  notes: string;
  setNotes: jest.Mock;
  itemId: string;
  defaultUnit: null;
};
type RestockMockPantryItem = { id: string; quantity: number } | null;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#components/molecules/DatePickerField', () => ({
  DatePickerField: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (v: string) => parseFloat(v) || null,
}));
jest.mock('#/utils/formatQuantity', () => ({
  formatQuantity: (v: number) => v.toString(),
}));
jest.mock('#features/pantry/components/modals/PantryActionModal', () => ({
  PantryActionModal: ({
    title,
    renderActionFields,
    pantryItemId,
  }: {
    title: string;
    pantryItemId: string | null;
    renderActionFields: (
      shared: RestockMockSharedState,
      pantryItem: RestockMockPantryItem,
    ) => React.ReactNode;
  }) => {
    const { View, Text } = require('react-native');
    const sharedState: RestockMockSharedState = {
      trackingQuantity: 5,
      trackingUnitSymbol: 'oz',
      trackingUnitId: 'unit-1',
      activeUnitSymbol: 'oz',
      activeUnitId: 'unit-1',
      isConvertedUnit: false,
      selectedUnitInfo: {
        unitId: 'unit-1',
        unitSymbol: 'oz',
        unitName: 'Ounces',
        unitType: 'WEIGHT',
        isTrackingUnit: true,
        conversionConfidence: null,
      },
      setSelectedUnitInfo: jest.fn(),
      notes: '',
      setNotes: jest.fn(),
      itemId: 'item-1',
      defaultUnit: null,
    };
    const fakePantryItem: RestockMockPantryItem = pantryItemId
      ? { id: pantryItemId, quantity: 5 }
      : null;
    return (
      <View>
        <Text>{title}</Text>
        {fakePantryItem
          ? renderActionFields(sharedState, fakePantryItem)
          : null}
      </View>
    );
  },
}));
jest.mock('#features/pantry/hooks/useConversionPreview', () => ({
  useConversionPreview: () => ({
    previewText: null,
    availableInSelectedUnit: null,
    previewLoading: false,
    availableLoading: false,
  }),
}));

describe('RestockPantryItemModal', () => {
  const defaultProps = {
    visible: true,
    pantryItemId: '1',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders with title Restock Item', () => {
    render(<RestockPantryItemModal {...defaultProps} />);
    expect(screen.getByText('Restock Item')).toBeTruthy();
  });

  it('shows quantity to add input', () => {
    render(<RestockPantryItemModal {...defaultProps} />);
    expect(screen.getByText('Quantity to Add')).toBeTruthy();
  });

  it('shows cost and expiration fields', () => {
    render(<RestockPantryItemModal {...defaultProps} />);
    expect(screen.getByText('Cost per Unit')).toBeTruthy();
    expect(screen.getByText('Total Cost')).toBeTruthy();
    expect(screen.getByText('Expiration Date')).toBeTruthy();
  });
});
