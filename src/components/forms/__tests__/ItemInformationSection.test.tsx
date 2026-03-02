import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { ItemInformationSection } from '../ItemInformationSection';

jest.mock('#components/molecules/DynamicFormFields', () => {
  const { View, Text } = require('react-native');
  return {
    DynamicFormFields: ({ fields }: any) => (
      <View testID="dynamic-fields">
        {fields.map((f: any) => (
          <Text key={f.name}>{f.label}</Text>
        ))}
      </View>
    ),
    FieldDef: {},
  };
});

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: 'FormInput',
}));

// Helper wrapper to provide react-hook-form control
function Wrapper(overrides: any) {
  const { control, formState: { errors } } = useForm({
    defaultValues: {
      itemName: '',
      category: '',
      brand: '',
    },
  });

  return (
    <ItemInformationSection
      control={control}
      errors={errors}
      mode="add"
      {...overrides}
    />
  );
}

describe('ItemInformationSection', () => {
  it('renders section title', () => {
    render(<Wrapper />);
    expect(screen.getByText('Item Information')).toBeTruthy();
  });

  it('renders add mode fields', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByTestId('dynamic-fields')).toBeTruthy();
    expect(screen.getByText('Item Name')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Brand')).toBeTruthy();
  });

  it('renders edit mode fields', () => {
    render(<Wrapper mode="edit" />);
    expect(screen.getByText('Item Name')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
    // Edit mode brand label has "(optional)"
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
