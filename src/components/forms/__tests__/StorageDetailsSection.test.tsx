import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { StorageDetailsSection } from '../StorageDetailsSection';

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

jest.mock('#components/molecules/FormTextArea', () => ({
  FormTextArea: 'FormTextArea',
}));

jest.mock('#components/molecules/SegmentedControl', () => {
  const { View, Text } = require('react-native');
  return {
    SegmentedControl: ({ label, value }: any) => (
      <View testID="segmented-control">
        <Text>{label}</Text>
        <Text>{value}</Text>
      </View>
    ),
  };
});

jest.mock('#components/molecules/DatePickerField', () => {
  const { View, Text } = require('react-native');
  return {
    DatePickerField: ({ label, placeholder }: any) => (
      <View testID="date-picker">
        <Text>{label}</Text>
        <Text>{placeholder}</Text>
      </View>
    ),
  };
});

jest.mock('#generated', () => ({
  StorageState: {
    Ambient: 'AMBIENT',
    Refrigerated: 'REFRIGERATED',
    Frozen: 'FROZEN',
  },
}));

function Wrapper(overrides: any) {
  const { control, formState: { errors } } = useForm({
    defaultValues: {
      location: '',
      notes: '',
      storageState: 'AMBIENT',
    },
  });

  return (
    <StorageDetailsSection
      control={control}
      errors={errors}
      mode="add"
      storageState="AMBIENT"
      onStorageStateChange={jest.fn()}
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

  it('renders segmented control for storage state', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('segmented-control')).toBeTruthy();
    expect(screen.getByText('Storage State')).toBeTruthy();
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

  it('renders notes field label for add mode', () => {
    render(<Wrapper mode="add" />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('renders notes field label for edit mode', () => {
    render(<Wrapper mode="edit" />);
    expect(screen.getByText('Storage Notes')).toBeTruthy();
  });
});
