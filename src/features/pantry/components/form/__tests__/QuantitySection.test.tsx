import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { QuantitySection } from '../QuantitySection';
import type { PantryItemFormData } from '../PantryItemForm';

jest.mock('#components/atoms/FormInput', () => {
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

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
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
});

jest.mock('#components/atoms/FieldRow', () => {
  const { View } = require('react-native');
  return {
    FieldRow: ({ children }: { children?: React.ReactNode }) => (
      <View testID="field-row">{children}</View>
    ),
  };
});

function Wrapper(
  overrides: Partial<React.ComponentProps<typeof QuantitySection>>,
) {
  const {
    control,
    formState: { errors },
  } = useForm<PantryItemFormData>({
    defaultValues: {
      quantityInput: '1',
      unit: '',
      minQuantity: '',
      restockQuantity: '',
    },
  });

  return <QuantitySection control={control} errors={errors} {...overrides} />;
}

describe('QuantitySection', () => {
  // The `add` variant is gone with the form's unreachable add mode.
  it('renders the section title', () => {
    render(<Wrapper />);
    expect(screen.getByText('Quantity & Stock')).toBeTruthy();
  });

  it('renders the quantity label', () => {
    render(<Wrapper />);
    expect(screen.getByText('Current Quantity')).toBeTruthy();
  });

  it('renders unit autocomplete field', () => {
    render(<Wrapper />);
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('renders low stock setting fields', () => {
    render(<Wrapper />);
    expect(screen.getByText('Alert When Below')).toBeTruthy();
    expect(screen.getByText('Restock To')).toBeTruthy();
  });

  it('renders field rows', () => {
    render(<Wrapper />);
    expect(screen.getAllByTestId('field-row')).toHaveLength(2);
  });

  it('passes testID props through', () => {
    render(<Wrapper testID="qty-input" unitTestID="unit-picker" />);
    expect(screen.getByTestId('qty-input')).toBeTruthy();
    expect(screen.getByTestId('unit-picker')).toBeTruthy();
  });
});
