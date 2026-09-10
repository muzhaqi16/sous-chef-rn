import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { ItemInformationSection } from '../ItemInformationSection';
import type { PantryItemFormData } from '../PantryItemForm';

jest.mock('#components/molecules/DynamicFormFields', () => {
  const { View, Text } = require('react-native');
  return {
    DynamicFormFields: ({
      fields,
    }: {
      fields: Array<{ name: string; label: string }>;
    }) => (
      <View testID="dynamic-fields">
        {fields.map(f => (
          <Text key={f.name}>{f.label}</Text>
        ))}
      </View>
    ),
    FieldDef: {},
  };
});

jest.mock('#components/atoms/FormInput', () => ({
  FormInput: 'FormInput',
}));

// Helper wrapper to provide react-hook-form control
function Wrapper(
  overrides: Partial<React.ComponentProps<typeof ItemInformationSection>> = {},
) {
  const {
    control,
    formState: { errors },
  } = useForm<PantryItemFormData>({
    defaultValues: {
      itemName: '',
      category: '',
      brand: '',
    },
  });

  return (
    <ItemInformationSection control={control} errors={errors} {...overrides} />
  );
}

describe('ItemInformationSection', () => {
  it('renders section title', () => {
    render(<Wrapper />);
    expect(screen.getByText('Item Information')).toBeTruthy();
  });

  it('renders the edit fields', () => {
    // There is no `add` variant: the form this section belongs to is
    // edit-only.
    render(<Wrapper />);
    expect(screen.getByTestId('dynamic-fields')).toBeTruthy();
    expect(screen.getByText('Item Name')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Brand (optional)')).toBeTruthy();
  });

  it('renders with suggested brands', () => {
    const suggestedBrands = [
      { id: 'b1', name: 'Brand A' },
      { id: 'b2', name: 'Brand B' },
    ];
    render(<Wrapper suggestedBrands={suggestedBrands} />);
    expect(screen.getByTestId('dynamic-fields')).toBeTruthy();
  });
});
