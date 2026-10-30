jest.unmock('../toastService');
jest.unmock('../alertService');
import { alertService } from '../alertService';
import {
  _resetToastMoments,
  _setToastDispatch,
  lastTroubleAt,
  toastService,
} from '../toastService';

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

describe('the trouble a person has seen', () => {
  beforeEach(() => {
    _resetToastMoments();
    _setToastDispatch(jest.fn());
  });

  it('is an error or a warning toast, never a success or info', () => {
    toastService.success('Saved');
    toastService.info('Synced');
    expect(lastTroubleAt()).toBeNull();

    toastService.warning('Offline');
    expect(lastTroubleAt()).not.toBeNull();
    _resetToastMoments();
    toastService.error('Failed');
    expect(lastTroubleAt()).not.toBeNull();
  });

  it('is any alert, which reports what went wrong', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    alertService.alert('Could not save');
    expect(lastTroubleAt()).not.toBeNull();
    jest.restoreAllMocks();
  });
});
