'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
    return <TextInput testID="fraction-input" value={props.value} onChangeText={props.onChangeText} />;
  },
}));
jest.mock('#components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { TextInput } = require('react-native');
    return <TextInput testID="form-input" value={props.value} onChangeText={props.onChangeText} />;
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
      availableQuantity: 10,
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

  it('shows waste reason options', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('shows sustainability checkboxes', () => {
    render(<RecordWastePantryItemModal {...defaultProps} />);
    expect(screen.getByText('Composted')).toBeTruthy();
    expect(screen.getByText('Recycled (packaging)')).toBeTruthy();
  });
});
