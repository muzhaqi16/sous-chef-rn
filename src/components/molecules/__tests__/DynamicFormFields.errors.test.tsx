import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { DynamicFormFields, type FieldDef } from '../DynamicFormFields';
import { drainTimers } from '#/test-utils/drainTimers';

type Values = { note: string; name: string };

const FIELDS: FieldDef<Values>[] = [
  { name: 'note', label: 'Note', component: FormTextArea },
  { name: 'name', label: 'Name', component: FormInput },
];

const Harness: React.FC = () => {
  const form = useForm<Values>({ defaultValues: { note: '', name: '' } });
  React.useEffect(() => {
    form.setError('note', { type: 'required', message: 'Tell us more' });
    form.setError('name', { type: 'required', message: 'Name it' });
  }, [form]);
  return (
    <DynamicFormFields<Values>
      fields={FIELDS}
      control={form.control}
      errors={form.formState.errors}
    />
  );
};

// The input atoms print their own message through FormFieldWrapper.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DynamicFormFields error messages', () => {
  it('shows a text area’s message once', async () => {
    render(<Harness />);
    await drainTimers();
    expect(screen.getAllByText('Tell us more')).toHaveLength(1);
  });

  it('shows a text input’s message once', async () => {
    render(<Harness />);
    await drainTimers();
    expect(screen.getAllByText('Name it')).toHaveLength(1);
  });
});
