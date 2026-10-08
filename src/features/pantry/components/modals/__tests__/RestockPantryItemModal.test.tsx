'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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
// A labelled input that shows the error it is handed, addressed by its label.
type MockFieldProps = {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
};
const mockField = ({ label, value, onChangeText, error }: MockFieldProps) => {
  const { Text, TextInput, View } = require('react-native');
  return (
    <View>
      <Text>{label}</Text>
      <TextInput
        testID={`field-${label}`}
        value={value}
        onChangeText={onChangeText}
      />
      {error ? <Text testID={`field-${label}-error`}>{error}</Text> : null}
    </View>
  );
};
jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: (props: MockFieldProps) => mockField(props),
}));
jest.mock('#components/atoms/FormInput', () => ({
  FormInput: (props: MockFieldProps) => mockField(props),
}));
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
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
    onConfirm,
  }: {
    title: string;
    pantryItemId: string | null;
    onConfirm: (shared: RestockMockSharedState) => void;
    renderActionFields: (
      shared: RestockMockSharedState,
      pantryItem: RestockMockPantryItem,
    ) => React.ReactNode;
  }) => {
    const { View, Text, Pressable } = require('react-native');
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
        <Pressable
          testID="restock-confirm"
          onPress={() => onConfirm(sharedState)}
        />
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(screen.getByText('Total paid')).toBeTruthy();
    expect(screen.getByText('Expiration Date')).toBeTruthy();
  });

  describe('an entry that cannot be restocked', () => {
    const INVALID_PAID = 'Enter the amount paid, like 3.49, or leave it empty.';
    const type = (label: string, text: string) =>
      fireEvent.changeText(screen.getByTestId(`field-${label}`), text);

    // Negatives were sent as typed, and `4,99x` was read as 4.99.
    it.each(['-3', '4,99x'])(
      'refuses a total paid of %p on its field and does not restock',
      typed => {
        render(<RestockPantryItemModal {...defaultProps} />);
        type('Total paid', typed);
        fireEvent.press(screen.getByTestId('restock-confirm'));

        expect(screen.getByTestId('field-Total paid-error')).toHaveTextContent(
          INVALID_PAID,
        );
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      },
    );

    it('refuses a cost per unit the same way', () => {
      render(<RestockPantryItemModal {...defaultProps} />);
      type('Cost per Unit', '-3');
      fireEvent.press(screen.getByTestId('restock-confirm'));

      expect(screen.getByTestId('field-Cost per Unit-error')).toHaveTextContent(
        INVALID_PAID,
      );
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('reports an unusable quantity on its field, not through an alert', () => {
      const { alertService } = jest.requireMock('#/services/alertService');
      render(<RestockPantryItemModal {...defaultProps} />);
      type('Quantity to Add', '0');
      fireEvent.press(screen.getByTestId('restock-confirm'));

      expect(
        screen.getByTestId('field-Quantity to Add-error'),
      ).toHaveTextContent('Please enter a valid quantity');
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('says nothing before a confirm, and clears once fixed', () => {
      render(<RestockPantryItemModal {...defaultProps} />);
      type('Total paid', '-3');
      expect(screen.queryByTestId('field-Total paid-error')).toBeNull();

      fireEvent.press(screen.getByTestId('restock-confirm'));
      type('Total paid', '3.49');

      expect(screen.queryByTestId('field-Total paid-error')).toBeNull();
    });

    it('restocks with a usable total paid', () => {
      render(<RestockPantryItemModal {...defaultProps} />);
      type('Total paid', '3.49');
      fireEvent.press(screen.getByTestId('restock-confirm'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        1,
        '1',
        '',
        'unit-1',
        undefined,
        3.49,
        null,
      );
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
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
