import { Alert } from 'react-native';
import {
  withVersionConflictHandling,
  withMutationErrorHandling,
  withGenericErrorHandling,
  composeErrorHandlers,
  handleVersionConflictAlert,
  handleMutationErrorAlert,
} from '../errorHandlers';

// Mock dependencies
jest.mock('../errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  getErrorMessage: jest.fn((err: any) => err?.message || 'Unknown error'),
}));

const { handleVersionConflict } = require('../errors/versionConflict');
const { errorService } = require('#/services/errorService');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('withVersionConflictHandling', () => {
  it('returns the result on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const wrapped = withVersionConflictHandling(fn);
    expect(await wrapped()).toBe('ok');
  });

  it('shows alert and returns false on version conflict', async () => {
    handleVersionConflict.mockReturnValue(true);
    const fn = jest.fn().mockRejectedValue(new Error('conflict'));
    const wrapped = withVersionConflictHandling(fn, { itemName: 'Item' });
    const result = await wrapped();
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Item Updated',
      'Version conflict message',
      expect.any(Array),
    );
  });

  it('re-throws non-version-conflict errors', async () => {
    handleVersionConflict.mockReturnValue(false);
    const fn = jest.fn().mockRejectedValue(new Error('other'));
    const wrapped = withVersionConflictHandling(fn);
    await expect(wrapped()).rejects.toThrow('other');
  });

  it('calls onRefresh when version conflict alert Refresh is pressed', async () => {
    handleVersionConflict.mockReturnValue(true);
    const onRefresh = jest.fn();
    const fn = jest.fn().mockRejectedValue(new Error('conflict'));
    const wrapped = withVersionConflictHandling(fn, { onRefresh });
    await wrapped();
    // Simulate pressing "Refresh"
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const refreshButton = buttons.find((b: any) => b.text === 'Refresh');
    refreshButton.onPress();
    expect(onRefresh).toHaveBeenCalled();
  });
});

describe('withMutationErrorHandling', () => {
  it('returns the result on success', async () => {
    const fn = jest.fn().mockResolvedValue('data');
    const wrapped = withMutationErrorHandling(fn, { operation: 'Test' });
    expect(await wrapped()).toBe('data');
  });

  it('shows alert and returns false on error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withMutationErrorHandling(fn, { operation: 'Test' });
    const result = await wrapped();
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'fail');
    expect(errorService.reportError).toHaveBeenCalled();
  });

  it('uses custom message when provided', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withMutationErrorHandling(fn, {
      operation: 'Test',
      customMessage: 'Custom error',
    });
    await wrapped();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Custom error');
  });

  it('suppresses alert when showAlert is false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withMutationErrorHandling(fn, {
      operation: 'Test',
      showAlert: false,
    });
    await wrapped();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('withGenericErrorHandling', () => {
  it('returns the result on success', async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const wrapped = withGenericErrorHandling(fn, 'Oops');
    expect(await wrapped()).toBe(42);
  });

  it('shows alert with provided message on error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('x'));
    const wrapped = withGenericErrorHandling(fn, 'Failed');
    const result = await wrapped();
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed');
  });
});

describe('composeErrorHandlers', () => {
  it('applies handlers in order', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const order: number[] = [];

    const handler1 = (inner: any) => async (...args: any[]) => {
      order.push(1);
      return inner(...args);
    };
    const handler2 = (inner: any) => async (...args: any[]) => {
      order.push(2);
      return inner(...args);
    };

    const composed = composeErrorHandlers(fn, [handler1, handler2]);
    await composed();
    // handler2 wraps handler1's result, so handler2 runs first at call time
    expect(order).toEqual([2, 1]);
  });
});

describe('handleVersionConflictAlert', () => {
  it('returns true and shows alert for version conflict', () => {
    handleVersionConflict.mockReturnValue(true);
    const result = handleVersionConflictAlert(new Error('conflict'));
    expect(result).toBe(true);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('returns false for non-version-conflict errors', () => {
    handleVersionConflict.mockReturnValue(false);
    const result = handleVersionConflictAlert(new Error('other'));
    expect(result).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('handleMutationErrorAlert', () => {
  it('shows alert and reports error', () => {
    handleMutationErrorAlert(new Error('boom'), { operation: 'Test' });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'boom');
    expect(errorService.reportError).toHaveBeenCalled();
  });

  it('suppresses alert when showAlert is false', () => {
    handleMutationErrorAlert(new Error('boom'), {
      operation: 'Test',
      showAlert: false,
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
