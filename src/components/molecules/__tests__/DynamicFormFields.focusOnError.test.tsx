import React from 'react';
import { TextInput } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string } from 'yup';
import { DynamicFormFields, type FieldDef } from '../DynamicFormFields';

type Values = { name: string; email: string };

/** focus() spies keyed by testID, so the focused field can be observed. */
let focusSpies: Record<string, jest.Mock>;

/** Stands in for an input atom: hands its ref a handle exposing `focus`. */
function SpyInput({
  testID,
  ref,
}: {
  testID?: string;
  ref?: React.Ref<{ focus: () => void }>;
}) {
  React.useImperativeHandle(ref, () => ({
    focus: focusSpies[testID ?? ''] ?? jest.fn(),
  }));
  return <TextInput testID={testID} />;
}

const FIELDS: FieldDef<Values>[] = [
  {
    name: 'name',
    label: 'Name',
    component: SpyInput,
    props: { testID: 'f-name' },
  },
  {
    name: 'email',
    label: 'Email',
    component: SpyInput,
    props: { testID: 'f-email' },
  },
];

const schema = object({
  name: string().defined(),
  email: string().required('Required'),
});

function Harness() {
  const form = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: { name: '', email: '' },
  });
  return (
    <>
      <DynamicFormFields<Values>
        fields={FIELDS}
        control={form.control}
        errors={form.formState.errors}
      />
      <Pressable onPress={form.handleSubmit(jest.fn())}>
        <Text>Save</Text>
      </Pressable>
    </>
  );
}

describe('DynamicFormFields focus on a failed submit', () => {
  beforeEach(() => {
    focusSpies = { 'f-name': jest.fn(), 'f-email': jest.fn() };
  });

  // react-hook-form focuses through the ref each field's `Controller` hands out.
  it('focuses the first field in error, not the one before it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.press(screen.getByText('Save'));

    expect(focusSpies['f-email']).toHaveBeenCalled();
    expect(focusSpies['f-name']).not.toHaveBeenCalled();
  });
});
