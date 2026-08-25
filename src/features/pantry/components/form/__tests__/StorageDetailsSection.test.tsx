import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm, type FieldValues } from 'react-hook-form';
import { StorageDetailsSection } from '../StorageDetailsSection';
import type { FieldDef } from '#components/molecules/DynamicFormFields';
import type { PantryItemFormData } from '../PantryItemForm';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';

jest.mock('#components/molecules/DynamicFormFields', () => {
  const { View, Text } = require('react-native');
  return {
    DynamicFormFields: ({ fields }: { fields: FieldDef<FieldValues>[] }) => (
      <View testID="dynamic-fields">
        {fields.map((f: FieldDef<FieldValues>) => (
          <Text key={String(f.name)}>{f.label}</Text>
        ))}
      </View>
    ),
    FieldDef: {},
  };
});

jest.mock('#components/molecules/FormTextArea', () => ({
  FormTextArea: 'FormTextArea',
}));

jest.mock('#components/molecules/DatePickerField', () => {
  const { View, Text } = require('react-native');
  return {
    DatePickerField: ({
      label,
      placeholder,
    }: {
      label?: string;
      placeholder?: string;
    }) => (
      <View testID="date-picker">
        <Text>{label}</Text>
        <Text>{placeholder}</Text>
      </View>
    ),
  };
});

function Wrapper(
  overrides: Partial<React.ComponentProps<typeof StorageDetailsSection>>,
) {
  const {
    control,
    formState: { errors },
  } = useForm<PantryItemFormData>({
    defaultValues: {
      location: '',
      notes: '',
      storageState: StorageState.Ambient,
    },
  });

  return (
    <StorageDetailsSection
      control={control}
      errors={errors}
      storageState={StorageState.Ambient}
      condition={ItemCondition.Good}
      onStorageStateChange={jest.fn()}
      onConditionChange={jest.fn()}
      onDateChange={jest.fn()}
      {...overrides}
    />
  );
}

describe('StorageDetailsSection', () => {
  it('renders section title', () => {
    render(<Wrapper />);
    expect(screen.getByText('Storage Details')).toBeTruthy();
  });

  it('renders storage state options', () => {
    render(<Wrapper />);
    expect(screen.getByText('Storage State')).toBeTruthy();
    // Each StorageState value renders as a selectable pill.
    expect(screen.getByText('Refrigerated')).toBeTruthy();
  });

  it('renders date picker', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('date-picker')).toBeTruthy();
    expect(screen.getByText('Expiration Date')).toBeTruthy();
  });

  it('renders location field', () => {
    render(<Wrapper />);
    expect(screen.getByText('Location')).toBeTruthy();
  });

  it('renders the notes field label', () => {
    render(<Wrapper />);
    expect(screen.getByText('Storage Notes')).toBeTruthy();
  });
});
