import { toastService, useToastService, showErrorToast } from '../toastService';

describe('toastService', () => {
  let showToast: jest.Mock;

  beforeEach(() => {
    showToast = jest.fn();
    toastService.init(showToast);
  });

  describe('init', () => {
    it('registers the toast callback', () => {
      toastService.success('test');
      expect(showToast).toHaveBeenCalledWith('test', 'success', undefined);
    });
  });

  describe('success', () => {
    it('calls showToast with success type', () => {
      toastService.success('Item saved');
      expect(showToast).toHaveBeenCalledWith('Item saved', 'success', undefined);
    });

    it('passes options', () => {
      const opts: { duration: number; position: 'top' } = { duration: 5000, position: 'top' };
      toastService.success('Done', opts);
      expect(showToast).toHaveBeenCalledWith('Done', 'success', opts);
    });
  });

  describe('error', () => {
    it('calls showToast with error type', () => {
      toastService.error('Failed');
      expect(showToast).toHaveBeenCalledWith('Failed', 'error', undefined);
    });
  });

  describe('info', () => {
    it('calls showToast with info type', () => {
      toastService.info('Coming soon');
      expect(showToast).toHaveBeenCalledWith('Coming soon', 'info', undefined);
    });
  });

  describe('warning', () => {
    it('calls showToast with warning type', () => {
      toastService.warning('Unsaved changes');
      expect(showToast).toHaveBeenCalledWith('Unsaved changes', 'warning', undefined);
    });
  });

  describe('when not initialized', () => {
    it('logs a warning instead of crashing', () => {
      // Create a fresh instance via the class
      const freshService = Object.create(toastService);
      freshService.showToastFn = null;
      freshService.success('test');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not initialized'),
        expect.any(String),
      );
    });
  });

  describe('errorWithAction', () => {
    it('calls error with action options', () => {
      const action = { label: 'Retry', onPress: jest.fn() };
      toastService.errorWithAction('Failed', action);
      expect(showToast).toHaveBeenCalledWith(
        'Failed',
        'error',
        expect.objectContaining({ action }),
      );
    });
  });

  describe('successWithAction', () => {
    it('calls success with action options', () => {
      const action = { label: 'View', onPress: jest.fn() };
      toastService.successWithAction('Created', action);
      expect(showToast).toHaveBeenCalledWith(
        'Created',
        'success',
        expect.objectContaining({ action }),
      );
    });
  });

  describe('useToastService', () => {
    it('returns the singleton', () => {
      expect(useToastService()).toBe(toastService);
    });
  });

  describe('showErrorToast', () => {
    it('shows error message', () => {
      showErrorToast({ message: 'Something went wrong' });
      expect(showToast).toHaveBeenCalledWith('Something went wrong', 'error', undefined);
    });
  });
});
