'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../../../src/components/molecules/DynamicFormFields';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('#features/catalog/ui/autocomplete/ItemAutocompleteField', () => ({
  ItemAutocompleteField: () => null,
}));
jest.mock('#features/catalog/ui/autocomplete/BrandAutocompleteField', () => ({
  BrandAutocompleteField: () => null,
}));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));
jest.mock('#features/catalog/ui/autocomplete/CategoryAutocompleteField', () => ({
  CategoryAutocompleteField: () => null,
}));
jest.mock('#features/catalog/ui/autocomplete/StorageLocationAutocompleteField', () => ({
  StorageLocationAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: { label: string }) => {
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
    const CustomInput = (props: { label: string }) => {
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
