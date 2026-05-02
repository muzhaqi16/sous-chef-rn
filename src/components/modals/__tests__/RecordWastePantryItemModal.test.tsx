'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RecordWastePantryItemModal } from '../RecordWastePantryItemModal';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: (props: any) => {
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
jest.mock('#components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
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
  FormCheckbox: ({ label }: any) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('../PantryActionModal', () => ({
  PantryActionModal: ({ title, renderActionFields }: any) => {
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
    return (
      <View>
        <Text>{title}</Text>
        {renderActionFields(sharedState)}
      </View>
    );
  },
}));
jest.mock('#hooks/pantry/useConversionPreview', () => ({
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
    pantryItem: { id: '1', quantity: 10 } as any,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders with title Record Waste', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Record Waste')).toBeTruthy();
  });

  it('shows waste reason options when expanded', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    // Collapsed by default — only selected value visible in header
    expect(screen.getByText('Expired')).toBeTruthy();
    // Expand the collapsible picker
    fireEvent.press(screen.getByText('Waste Reason *'));
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('shows sustainability checkboxes', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Composted')).toBeTruthy();
    expect(screen.getByText('Recycled (packaging)')).toBeTruthy();
  });
});
