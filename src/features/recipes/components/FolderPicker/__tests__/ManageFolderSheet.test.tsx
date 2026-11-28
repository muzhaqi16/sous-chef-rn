import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#i18n';
import { drainTimers } from '#/test-utils/drainTimers';
import { ManageFolderSheet } from '../ManageFolderSheet';

jest.mock('#components/atoms/Icon', () => ({ Icon: () => null }));

const renderSheet = (
  overrides: Partial<React.ComponentProps<typeof ManageFolderSheet>> = {},
) => {
  return render(
    <ManageFolderSheet
      visible
      onDismiss={jest.fn()}
      managingFolder="Dinner"
      otherFolders={['Breakfast']}
      showDeleteConfirm={false}
      onShowDeleteConfirm={jest.fn()}
      onRenameConfirm={jest.fn()}
      onDeleteConfirm={jest.fn()}
      onClose={jest.fn()}
      folderActionLoading={false}
      canRename
      canDelete
      {...overrides}
    />,
  );
};

const renameTo = async (name: string) => {
  const field = screen.getByPlaceholderText(
    t('folderPicker.renamePlaceholder'),
  );
  fireEvent.changeText(field, name);
  fireEvent(field, 'submitEditing');
  await drainTimers();
};

describe('ManageFolderSheet delete confirmation', () => {
  it('names the folder it is about to delete', () => {
    renderSheet({ showDeleteConfirm: true });
    expect(screen.getByText('Delete Dinner?')).toBeTruthy();
  });
});

describe('ManageFolderSheet rename', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('says on the field that a name is needed, and renames nothing', async () => {
    const onRenameConfirm = jest.fn();
    renderSheet({ onRenameConfirm });

    await renameTo('   ');

    expect(screen.getByText(t('folderPicker.nameRequired'))).toBeTruthy();
    expect(onRenameConfirm).not.toHaveBeenCalled();
  });

  it('says on the field that another folder has the name', async () => {
    const onRenameConfirm = jest.fn();
    renderSheet({ onRenameConfirm });

    await renameTo('Breakfast');

    expect(
      screen.getByText(t('folderPicker.duplicate', { name: 'Breakfast' })),
    ).toBeTruthy();
    expect(onRenameConfirm).not.toHaveBeenCalled();
  });

  it('renames to the trimmed name', async () => {
    const onRenameConfirm = jest.fn();
    renderSheet({ onRenameConfirm });

    await renameTo('  Weeknight  ');

    expect(onRenameConfirm).toHaveBeenCalledWith('Weeknight');
  });
});
