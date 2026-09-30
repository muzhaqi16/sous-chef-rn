'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RestockPantryItemModal } from '#features/pantry/components/modals/RestockPantryItemModal';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';
import { eggsShared } from '#/test-utils/pantryActionShared';

// Minimal stand-ins for the props the mocked PantryActionModal feeds back to
// `renderActionFields`; matches exactly what this stub constructs.
type RestockMockSharedState = {
  trackingQuantity: number;
  trackingUnitSymbol: string;
  trackingUnitId: string;
  activeUnitSymbol: string;
  activeUnitId: string;
  displayAsFractionOf: () => boolean | null;
  isConvertedUnit: boolean;
  exactFactor: number | null;
  showStock: (held: number) => {
    quantity: number;
    unitSymbol: string;
    displayAsFraction: boolean | null;
  };
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

/** Replaces the mocked shell's shared state, for a test that needs another stack. */
let mockSharedOverride: Partial<PantryActionSharedState> = {};

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
      displayAsFractionOf: () => null,
      isConvertedUnit: false,
      exactFactor: 1,
      showStock: held => ({
        quantity: held,
        unitSymbol: 'oz',
        displayAsFraction: null,
      }),
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
    Object.assign(sharedState, mockSharedOverride);
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

  describe('on a stack of pieces shown in dozens', () => {
    afterEach(() => {
      mockSharedOverride = {};
    });

    it('reads the new total in dozens when it is a common fraction of one', () => {
      mockSharedOverride = eggsShared(36, 'doz');
      render(<RestockPantryItemModal {...defaultProps} />);
      expect(screen.getByText('New quantity: 4 doz')).toBeTruthy();
    });

    it('reads any other total in pieces, never a decimal of a dozen', () => {
      mockSharedOverride = eggsShared(11, 'doz');
      render(<RestockPantryItemModal {...defaultProps} />);
      expect(screen.getByText('New quantity: 23 pc')).toBeTruthy();
    });
  });
});
