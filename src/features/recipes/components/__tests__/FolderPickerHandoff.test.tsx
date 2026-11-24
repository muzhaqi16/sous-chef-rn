import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { settledInAct } from '#/test-utils/settledInAct';
import { FolderPicker } from '#features/recipes/components/FolderPicker';

// The real sheets over the shared gorhom mock, which presents and dismisses,
// and reports a dismissal a microtask later as gorhom does.

const renderPicker = () => {
  const onCancel = jest.fn();
  render(
    <FolderPicker
      visible
      folders={['Dinner', 'Lunch']}
      selectedFolder={null}
      onSelect={jest.fn()}
      onCancel={onCancel}
      onRenameFolder={jest.fn(async () => true)}
      onDeleteFolder={jest.fn(async () => true)}
      protectedFolders={[]}
      onSelectedFolderMoved={jest.fn()}
    />,
  );
  return { onCancel };
};

describe('FolderPicker hand-off to the manage sheet', () => {
  it('swaps the picker for the manage sheet, and back, without cancelling', async () => {
    const { onCancel } = renderPicker();
    expect(screen.getByText('Select Folder')).toBeTruthy();

    await settledInAct(() =>
      fireEvent(screen.getByText('Dinner'), 'longPress'),
    );

    expect(screen.getByText('Manage Folder')).toBeTruthy();
    expect(screen.queryByText('Select Folder')).toBeNull();

    await settledInAct(() => fireEvent.press(screen.getByLabelText('Close')));

    expect(screen.getByText('Select Folder')).toBeTruthy();
    expect(screen.queryByText('Manage Folder')).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
