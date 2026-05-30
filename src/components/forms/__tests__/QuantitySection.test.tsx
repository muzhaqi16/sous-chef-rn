import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { QuantitySection } from '../QuantitySection';

jest.mock('#components/molecules/FormInput', () => {
  const { View, Text } = require('react-native');
  return {
    FormInput: ({ label, value }: { label: string; value?: string }) => (
      <View testID={`form-input-${label}`}>
        <Text>{label}</Text>
        {value ? <Text>{value}</Text> : null}
      </View>
    ),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const { View, Text } = require('react-native');
  return {
    FractionInput: ({
      label,
      value,
      testID,
    }: {
      label: string;
      value?: string;
      testID?: string;
    }) => (
      <View testID={testID || 'fraction-input'}>
        <Text>{label}</Text>
        {value ? <Text>{value}</Text> : null}
      </View>
    ),
  };
});

jest.mock(
  '#components/molecules/AutocompleteField/UnitAutocompleteField',
  () => {
    const { View, Text } = require('react-native');
    return {
      UnitAutocompleteField: ({
        label,
        value,
        testID,
      }: {
        label: string;
        value?: string;
        testID?: string;
      }) => (
        <View testID={testID || 'unit-autocomplete'}>
          <Text>{label}</Text>
          {value ? <Text>{value}</Text> : null}
        </View>
      ),
    };
  },
);

jest.mock('#components/molecules/FieldRow', () => {
  const { View } = require('react-native');
  return {
    FieldRow: ({ children }: any) => <View testID="field-row">{children}</View>,
  };
});

function Wrapper(overrides: any) {
  const {
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      quantityInput: '1',
      unit: '',
      minQuantity: '',
      restockQuantity: '',
    },
  });

  return (
    <QuantitySection
      control={control}
      errors={errors}
      mode="add"
      {...overrides}
    />
  );
}

describe('QuantitySection', () => {
  it('renders section title for add mode', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByText('Quantity & Unit')).toBeTruthy();
  });

  it('renders section title for edit mode', () => {
    render(<Wrapper mode="edit" />);
    expect(screen.getByText('Quantity & Stock')).toBeTruthy();
  });

  it('renders quantity label for add mode', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByText('Quantity *')).toBeTruthy();
  });

  it('renders quantity label for edit mode', () => {
    render(<Wrapper mode="edit" />);
    expect(screen.getByText('Current Quantity')).toBeTruthy();
  });

  it('renders unit autocomplete field', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('renders low stock setting fields', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByText('Alert When Below')).toBeTruthy();
    expect(screen.getByText('Restock To')).toBeTruthy();
  });

  it('renders field rows', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getAllByTestId('field-row')).toHaveLength(2);
  });

  it('passes testID props through', () => {
    render(<Wrapper mode="add" testID="qty-input" unitTestID="unit-picker" />);
    expect(screen.getByTestId('qty-input')).toBeTruthy();
    expect(screen.getByTestId('unit-picker')).toBeTruthy();
  });
});
