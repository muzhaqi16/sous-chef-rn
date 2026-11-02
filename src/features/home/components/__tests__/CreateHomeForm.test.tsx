import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import { CreateHomeForm } from '#features/home/components/CreateHomeForm';
import { homeTestIDs } from '#features/home/testIDs';
import { drainTimers } from '#/test-utils/drainTimers';

const nameError = kitTestIDs.inputError(homeTestIDs.createHomeNameInput);

const renderForm = (
  props: Partial<React.ComponentProps<typeof CreateHomeForm>> = {},
) => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <CreateHomeForm
      joinCodeAvailable
      requireVerifiedEmail={() => true}
      onSubmit={onSubmit}
      onCancel={jest.fn()}
      isCreating={false}
      {...props}
    />,
  );
  return { onSubmit };
};

const typeName = (name: string) =>
  fireEvent.changeText(
    screen.getByTestId(homeTestIDs.createHomeNameInput),
    name,
  );
const pressCreate = () =>
  fireEvent.press(screen.getByTestId(homeTestIDs.createHomeSubmitButton));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CreateHomeForm', () => {
  // The API refuses these names; the field says so and nothing is sent.
  it('reports a missing name on the field and creates nothing', async () => {
    const { onSubmit } = renderForm();

    typeName(' \t ');
    pressCreate();

    await drainTimers();
    expect(screen.getByTestId(nameError)).toHaveTextContent(
      'Please enter a home name',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports a name over the API’s cap on the field and creates nothing', async () => {
    const { onSubmit } = renderForm();

    typeName('a'.repeat(101));
    pressCreate();

    await drainTimers();
    expect(screen.getByTestId(nameError)).toHaveTextContent(
      'Keep the name to 100 characters',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('creates a home under its cleaned name, whatever its script', async () => {
    const { onSubmit } = renderForm();

    typeName('  Shtëpia \t e  Re ');
    pressCreate();

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      name: 'Shtëpia e Re',
      allowJoinCode: true,
    });
  });

  it('takes a name at the cap', async () => {
    const { onSubmit } = renderForm();

    typeName('a'.repeat(100));
    pressCreate();

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(screen.queryByTestId(nameError)).toBeNull();
  });

  it('asks for a verified address before turning a join code on', () => {
    const requireVerifiedEmail = jest.fn().mockReturnValue(false);
    renderForm({ joinCodeAvailable: false, requireVerifiedEmail });

    fireEvent.press(screen.getByText('Allow others to join with a code'));

    expect(requireVerifiedEmail).toHaveBeenCalledTimes(1);
  });

  it('sends the join code turned off', async () => {
    const { onSubmit } = renderForm();

    typeName('Our Flat');
    fireEvent.press(screen.getByText('Allow others to join with a code'));
    pressCreate();

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      name: 'Our Flat',
      allowJoinCode: false,
    });
  });
});
