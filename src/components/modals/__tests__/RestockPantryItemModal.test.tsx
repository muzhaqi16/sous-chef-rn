'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RestockPantryItemModal } from '../RestockPantryItemModal';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: ({ label }: any) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({ label }: any) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#components/molecules/DatePickerField', () => ({
  DatePickerField: ({ label }: any) => {
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
jest.mock('../PantryActionModal', () => ({
  PantryActionModal: ({ title, renderActionFields }: any) => {
    const { View, Text } = require('react-native');
    const sharedState = {
      availableQuantity: 5,
      activeUnitSymbol: 'oz',
      activeUnitId: 'unit-1',
      notes: '',
      setNotes: jest.fn(),
      selectedUnit: 'weight',
      hasContentUnit: false,
    };
    return (
      <View>
        <Text>{title}</Text>
        {renderActionFields(sharedState)}
      </View>
    );
  },
}));

describe('RestockPantryItemModal', () => {
  const defaultProps = {
    visible: true,
    pantryItem: { id: '1', quantity: 5 } as any,
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
