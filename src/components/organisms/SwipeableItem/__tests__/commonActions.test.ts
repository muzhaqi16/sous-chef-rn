import { deleteAction, editAction, resolveRowActions } from '../commonActions';
import type { ItemSwipeActionsFactory } from '../types';

const setup = () => {
  const onDelete = jest.fn();
  const onEdit = jest.fn();
  const factory: ItemSwipeActionsFactory = () => ({
    left: [editAction(onEdit)],
    right: [{ ...deleteAction(onDelete), removesRow: true }],
  });
  return { factory, onDelete, onEdit };
};

describe('resolveRowActions', () => {
  it('hands a row-removing action to the list to run', () => {
    const { factory, onDelete } = setup();
    const onRemoveRow = jest.fn();

    const [remove] =
      resolveRowActions(factory, 'item-1', onRemoveRow)?.right ?? [];
    remove?.onPress();

    expect(onRemoveRow).toHaveBeenCalledWith(onDelete);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('leaves an action that keeps the row alone', () => {
    const { factory, onEdit } = setup();
    const onRemoveRow = jest.fn();

    const [edit] =
      resolveRowActions(factory, 'item-1', onRemoveRow)?.left ?? [];
    edit?.onPress();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRemoveRow).not.toHaveBeenCalled();
  });

  it('runs a row-removing action directly when no list takes it', () => {
    const { factory, onDelete } = setup();

    const [remove] =
      resolveRowActions(factory, 'item-1', undefined)?.right ?? [];
    remove?.onPress();

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
