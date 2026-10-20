import { destructiveConfirm } from '../destructiveConfirm';

describe('destructiveConfirm', () => {
  it('offers Cancel first, then the destructive action that runs the work', () => {
    const onConfirm = jest.fn();

    const [cancel, confirm] = destructiveConfirm('Delete', onConfirm);

    expect(cancel).toEqual({ text: 'Cancel', style: 'cancel' });
    expect(confirm).toMatchObject({ text: 'Delete', style: 'destructive' });
    confirm?.onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
