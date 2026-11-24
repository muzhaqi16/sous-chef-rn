import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
      renameValue="Dinner"
      onRenameValueChange={jest.fn()}
      showDeleteConfirm
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

describe('ManageFolderSheet delete confirmation', () => {
  it('names the folder it is about to delete', () => {
    renderSheet();
    expect(screen.getByText('Delete Dinner?')).toBeTruthy();
  });
});
