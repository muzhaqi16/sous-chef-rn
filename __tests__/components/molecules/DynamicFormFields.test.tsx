'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../../../src/components/molecules/DynamicFormFields';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/molecules/AutocompleteField/ItemAutocompleteField', () => ({
  ItemAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/AutocompleteField/BrandAutocompleteField', () => ({
  BrandAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/AutocompleteField/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/AutocompleteField/CategoryAutocompleteField', () => ({
  CategoryAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/AutocompleteField/StorageLocationAutocompleteField', () => ({
  StorageLocationAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

type TestForm = { name: string };

function Wrapper({ fields }: { fields: FieldDef<TestForm>[] }) {
  const { control, formState: { errors } } = useForm<TestForm>({
    defaultValues: { name: '' },
  });
  return <DynamicFormFields fields={fields} control={control} errors={errors} />;
}

describe('DynamicFormFields', () => {
  it('renders without crashing with empty fields', () => {
    const { toJSON } = render(<Wrapper fields={[]} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a field with no component (empty fragment)', () => {
    const fields: FieldDef<TestForm>[] = [
      { name: 'name', label: 'Name', placeholder: 'Enter name' },
    ];
    const { toJSON } = render(<Wrapper fields={fields} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders field with custom component', () => {
    const CustomInput = (props: any) => {
      const { Text } = require('react-native');
      return <Text testID="custom">{props.label}</Text>;
    };
    const fields: FieldDef<TestForm>[] = [
      { name: 'name', label: 'Custom Field', component: CustomInput },
    ];
    const { getByText } = render(<Wrapper fields={fields} />);
    expect(getByText('Custom Field')).toBeTruthy();
  });
});
