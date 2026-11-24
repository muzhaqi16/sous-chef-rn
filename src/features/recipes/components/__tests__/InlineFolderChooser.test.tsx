import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { InlineFolderChooser } from '../InlineFolderChooser';

const onSelect = jest.fn();
const onCreateFolder = jest.fn();

const renderChooser = () =>
  render(
    <InlineFolderChooser
      folders={['Dinner', 'Lunch']}
      selectedFolder={null}
      onSelect={onSelect}
      onCreateFolder={onCreateFolder}
    />,
  );

const openCreateRow = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByText(t('labels.createNewFolder')));
const nameInput = () =>
  screen.getByPlaceholderText(t('labels.enterFolderName'));
const create = () => screen.getByText(t('labels.create'));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InlineFolderChooser', () => {
  it('creates a folder under the trimmed name and closes the row', async () => {
    const user = userEvent.setup();
    renderChooser();
    await openCreateRow(user);

    fireEvent.changeText(nameInput(), '  Soups  ');
    await user.press(create());

    expect(onCreateFolder).toHaveBeenCalledWith('Soups');
    expect(screen.getByText(t('labels.createNewFolder'))).toBeOnTheScreen();
  });

  it('asks for a name on the field when created without one', async () => {
    const user = userEvent.setup();
    renderChooser();
    await openCreateRow(user);

    fireEvent.changeText(nameInput(), '   ');
    await user.press(create());

    expect(screen.getByText(t('folderPicker.nameRequired'))).toBeOnTheScreen();
    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(nameInput()).toBeOnTheScreen();
  });

  it('opens the create row empty each time', async () => {
    const user = userEvent.setup();
    renderChooser();
    await openCreateRow(user);
    fireEvent.changeText(nameInput(), 'Draft');

    await user.press(screen.getByText('Lunch'));
    expect(onSelect).toHaveBeenCalledWith('Lunch');
    await openCreateRow(user);

    expect(nameInput().props.defaultValue).toBe('');
  });
});
