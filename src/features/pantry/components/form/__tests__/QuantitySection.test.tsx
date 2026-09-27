import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { Text as SaveButton } from '#components/atoms/Text';
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
      error,
      testID,
    }: {
      label: string;
      value?: string;
      error?: string;
      testID?: string;
    }) => (
      <View testID={testID || 'fraction-input'}>
        <Text>{label}</Text>
        {value ? <Text>{value}</Text> : null}
        {error ? <Text>{error}</Text> : null}
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
      error,
      testID,
    }: {
      label: string;
      value?: string;
      error?: string;
      testID?: string;
    }) => (
      <View testID={testID || 'unit-autocomplete'}>
        <Text>{label}</Text>
        {value ? <Text>{value}</Text> : null}
        {error ? <Text>{error}</Text> : null}
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
  const { control } = useForm<PantryItemFormData>({
    defaultValues: {
      quantityInput: '1',
      unit: '',
      minQuantity: '',
      restockQuantity: '',
    },
  });

  return <QuantitySection control={control} {...overrides} />;
}

// A save reports a refusal with `setError` while the submit runs: the resolver
// has just replaced `errors`, and `setError` then updates that object in
// place. Module scope, so the React Compiler memoizes it as it does the form.
function Reporting() {
  const { control, handleSubmit, setError } = useForm<PantryItemFormData>({
    defaultValues: { quantityInput: '1', unit: 'pc' },
    resolver: values => Promise.resolve({ values, errors: {} }),
    mode: 'onChange',
  });
  const save = handleSubmit(async () => {
    await Promise.resolve();
    setError(
      'unit',
      { type: 'server', message: 'Already tracked in carton.' },
      { shouldFocus: false },
    );
    setError(
      'quantityInput',
      { type: 'server', message: 'Enter how much you have.' },
      { shouldFocus: false },
    );
  });
  return (
    <>
      <QuantitySection control={control} />
      <SaveButton
        onPress={() => {
          void save();
        }}
      >
        save
      </SaveButton>
    </>
  );
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

  it('shows an error a save reports on its field', async () => {
    render(<Reporting />);

    fireEvent.press(screen.getByText('save'));

    expect(await screen.findByText('Already tracked in carton.')).toBeTruthy();
    expect(screen.getByText('Enter how much you have.')).toBeTruthy();
  });

  it('passes testID props through', () => {
    render(<Wrapper testID="qty-input" unitTestID="unit-picker" />);
    expect(screen.getByTestId('qty-input')).toBeTruthy();
    expect(screen.getByTestId('unit-picker')).toBeTruthy();
  });
});
