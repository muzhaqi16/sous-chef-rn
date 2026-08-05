import React from 'react';
import { TextInput } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { DynamicFormFields, type FieldDef } from '../DynamicFormFields';

type Values = { name: string; email: string; password: string };

/** focus() spies keyed by testID, so a chained focus can be observed. */
let focusSpies: Record<string, jest.Mock>;

/**
 * Stands in for the real input atoms. Hands the parent a handle exposing
 * `focus`, the way a TextInput does, and passes the remaining props through so
 * returnKeyType / onSubmitEditing can be read off the rendered element.
 */
const SpyInput: React.FC<{
  testID?: string;
  ref?: React.Ref<TextInput>;
  label?: string;
  error?: unknown;
}> = ({ testID, ref, label: _label, error: _error, ...rest }) => {
  const focus = focusSpies[testID ?? ''];

  React.useEffect(() => {
    const handle = { focus } as unknown as TextInput;
    if (typeof ref === 'function') {
      ref(handle);
    } else if (ref) {
      (ref as React.RefObject<TextInput | null>).current = handle;
    }
  }, [ref, focus]);

  return <TextInput testID={testID} {...rest} />;
};

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
  {
    name: 'password',
    label: 'Password',
    component: SpyInput,
    props: { testID: 'f-password' },
  },
];

const Harness: React.FC<{ focusChaining?: boolean }> = ({ focusChaining }) => {
  const form = useForm<Values>({
    defaultValues: { name: '', email: '', password: '' },
  });
  return (
    <DynamicFormFields<Values>
      fields={FIELDS}
      control={form.control}
      errors={form.formState.errors}
      focusChaining={focusChaining}
    />
  );
};

describe('DynamicFormFields focus chaining', () => {
  beforeEach(() => {
    focusSpies = {
      'f-name': jest.fn(),
      'f-email': jest.fn(),
      'f-password': jest.fn(),
    };
  });

  it('gives every field but the last a "next" return key', () => {
    render(<Harness focusChaining />);

    expect(screen.getByTestId('f-name').props.returnKeyType).toBe('next');
    expect(screen.getByTestId('f-email').props.returnKeyType).toBe('next');
  });

  it('leaves the last field on "done" so it does not chain past the end', () => {
    render(<Harness focusChaining />);

    expect(screen.getByTestId('f-password').props.returnKeyType).toBe('done');
    expect(
      screen.getByTestId('f-password').props.onSubmitEditing,
    ).toBeUndefined();
  });

  it('keeps the keyboard up while focus moves on', () => {
    render(<Harness focusChaining />);

    // Without this the keyboard closes and reopens between fields.
    expect(screen.getByTestId('f-name').props.submitBehavior).toBe('submit');
  });

  it('moves focus to the next field when the return key is pressed', () => {
    render(<Harness focusChaining />);

    screen.getByTestId('f-name').props.onSubmitEditing();
    expect(focusSpies['f-email']).toHaveBeenCalled();

    screen.getByTestId('f-email').props.onSubmitEditing();
    expect(focusSpies['f-password']).toHaveBeenCalled();
  });

  it('changes nothing for forms that do not opt in', () => {
    // The pantry/onboarding forms share this component and must keep the
    // plain per-field keyboard behaviour.
    render(<Harness />);

    expect(screen.getByTestId('f-name').props.returnKeyType).toBeUndefined();
    expect(screen.getByTestId('f-name').props.onSubmitEditing).toBeUndefined();
    expect(focusSpies['f-email']).not.toHaveBeenCalled();
  });
});
