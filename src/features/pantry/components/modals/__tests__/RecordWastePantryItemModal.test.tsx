'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { RecordWastePantryItemModal } from '#features/pantry/components/modals/RecordWastePantryItemModal';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';

// The mock supplies a simplified subset of the real shared state / pantry item
// that the consumer's renderActionFields reads. Pick the fields it provides plus
// a partial selectedUnitInfo.
type MockSharedState = Pick<
  PantryActionSharedState,
  | 'trackingQuantity'
  | 'trackingUnitSymbol'
  | 'trackingUnitId'
  | 'activeUnitSymbol'
  | 'activeUnitId'
  | 'isConvertedUnit'
  | 'setSelectedUnitInfo'
  | 'notes'
  | 'setNotes'
  | 'defaultUnit'
> & {
  selectedUnitInfo: {
    unitId: string;
    unitSymbol: string;
    unitName: string;
    unitType: string;
    isTrackingUnit: boolean;
    conversionConfidence: number | null;
  };
  itemId: string;
};
type MockPantryItem = { id: string; quantity: number };

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: (props: {
    value: string;
    onChangeText: (text: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="fraction-input"
        value={props.value}
        onChangeText={props.onChangeText}
      />
    );
  },
}));
jest.mock('#components/atoms/FormInput', () => ({
  FormInput: (props: {
    value?: string;
    onChangeText?: (text: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="form-input"
        value={props.value}
        onChangeText={props.onChangeText}
      />
    );
  },
}));
jest.mock('#components/molecules/FormCheckbox', () => ({
  FormCheckbox: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
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
      shared: MockSharedState,
      pantryItem: MockPantryItem,
    ) => React.ReactNode;
  }) => {
    const { View, Text } = require('react-native');
    const sharedState = {
      trackingQuantity: 10,
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
    const fakePantryItem = pantryItemId
      ? { id: pantryItemId, quantity: 10 }
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
jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (v: string) => parseFloat(v) || null,
}));
jest.mock('#/utils/formatQuantity', () => ({
  formatQuantity: (v: number) => v.toString(),
}));

describe('RecordWastePantryItemModal', () => {
  const defaultProps = {
    visible: true,
    pantryItemId: '1',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders with title Record Waste', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Record Waste')).toBeTruthy();
  });

  it('shows waste reason options when expanded', async () => {
    const user = userEvent.setup();
    render(<RecordWastePantryItemModal {...defaultProps} />);
    // Collapsed by default — only selected value visible in header
    expect(screen.getByText('Expired')).toBeTruthy();
    // Expand the collapsible picker
    await user.press(screen.getByText('Waste Reason *'));
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('shows sustainability checkboxes', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Composted')).toBeTruthy();
    expect(screen.getByText('Recycled (packaging)')).toBeTruthy();
  });
});
