import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#i18n';
import { StorageType } from '#graphql/generated/schemaTypes';
import { AddStorageLocationSheet } from '../AddStorageLocationSheet';

const onClose = jest.fn();
const onCreateLocation = jest.fn(() => Promise.resolve());

const sheet = (visible = true) => (
  <AddStorageLocationSheet
    visible={visible}
    onClose={onClose}
    onCreateLocation={onCreateLocation}
    creating={false}
  />
);

const nameInput = () =>
  screen.getByPlaceholderText(t('addStorageLocation.namePlaceholder'));
const create = () =>
  userEvent.setup().press(screen.getByLabelText(t('labels.create')));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AddStorageLocationSheet', () => {
  it('names the sheet and the field', () => {
    render(sheet());
    expect(screen.getByText(t('labels.addLocation'))).toBeTruthy();
    expect(screen.getByText(t('addStorageLocation.locationName'))).toBeTruthy();
    expect(screen.getByText(/You can edit details later/)).toBeTruthy();
  });

  it('closes without creating', async () => {
    render(sheet());
    fireEvent.changeText(nameInput(), 'Kitchen');
    await userEvent.setup().press(screen.getByLabelText(t('labels.close')));
    expect(onClose).toHaveBeenCalled();
    expect(onCreateLocation).not.toHaveBeenCalled();
  });

  it('creates the location under the name typed, trimmed, then closes', async () => {
    render(sheet());
    fireEvent.changeText(nameInput(), '  Kitchen  ');
    await create();
    expect(onCreateLocation).toHaveBeenCalledWith({
      name: 'Kitchen',
      type: StorageType.Custom,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for a name on the field when created without one', async () => {
    render(sheet());
    await create();
    expect(
      screen.getByText(t('addStorageLocation.nameRequired')),
    ).toBeOnTheScreen();
    expect(onCreateLocation).not.toHaveBeenCalled();
  });

  it('creates from the keyboard', async () => {
    render(sheet());
    await userEvent
      .setup()
      .type(nameInput(), 'Garage', { submitEditing: true });
    expect(onCreateLocation).toHaveBeenCalledWith({
      name: 'Garage',
      type: StorageType.Custom,
    });
  });

  it('offers Create for a name too short, and says why on the field', async () => {
    render(sheet());
    fireEvent.changeText(nameInput(), 'K');
    expect(screen.getByLabelText(t('labels.create'))).toBeEnabled();
    await create();
    expect(screen.getByText(t('commonValidation.nameMin'))).toBeOnTheScreen();
    expect(onCreateLocation).not.toHaveBeenCalled();
  });

  it('stays open on a refused create, saying so on the field', async () => {
    onCreateLocation.mockRejectedValueOnce(new Error('refused'));
    render(sheet());
    fireEvent.changeText(nameInput(), 'Kitchen');
    await create();
    expect(
      screen.getByText(t('addStorageLocation.createFailed')),
    ).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens fresh: the name and its error go with the closing', async () => {
    const view = render(sheet());
    await create();
    expect(
      screen.getByText(t('addStorageLocation.nameRequired')),
    ).toBeOnTheScreen();

    view.rerender(sheet(false));
    view.rerender(sheet());

    expect(nameInput()).toHaveDisplayValue('');
    expect(screen.queryByText(t('addStorageLocation.nameRequired'))).toBeNull();
  });
});
