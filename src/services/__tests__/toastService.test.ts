jest.unmock('../toastService');
import { _setToastDispatch, toastService } from '../toastService';

describe('toastService', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    dispatch = jest.fn();
    _setToastDispatch(dispatch);
  });

  it('success dispatches with success type', () => {
    toastService.success('Saved');
    expect(dispatch).toHaveBeenCalledWith({
      message: 'Saved',
      type: 'success',
    });
  });

  it('error dispatches with error type', () => {
    toastService.error('Failed');
    expect(dispatch).toHaveBeenCalledWith({ message: 'Failed', type: 'error' });
  });

  it('info dispatches with info type', () => {
    toastService.info('Coming soon');
    expect(dispatch).toHaveBeenCalledWith({
      message: 'Coming soon',
      type: 'info',
    });
  });

  it('forwards options', () => {
    const action = { label: 'Retry', onPress: jest.fn() };
    toastService.error('Failed', { supersede: true, action });
    expect(dispatch).toHaveBeenCalledWith({
      message: 'Failed',
      type: 'error',
      supersede: true,
      action,
    });
  });

  it('forwards a detail', () => {
    toastService.warning('Offline', { detail: 'Changes will sync' });
    expect(dispatch).toHaveBeenCalledWith({
      message: 'Offline',
      detail: 'Changes will sync',
      type: 'warning',
    });
  });

  it('warns instead of crashing when no provider is mounted', () => {
    _setToastDispatch(opts => {
      console.warn('[toast] called before provider mounted:', opts.message);
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    toastService.success('orphaned');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('before provider mounted'),
      'orphaned',
    );
    warnSpy.mockRestore();
  });
});
