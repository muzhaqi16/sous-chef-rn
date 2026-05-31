import { alertService, type AlertButton } from '#/services/alertService';
import {
  handleVersionConflictAlert,
  handleMutationErrorAlert,
} from '../errorHandlers';

jest.mock('../errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  getErrorMessage: jest.fn(
    (err: unknown) =>
      (err instanceof Error ? err.message : '') || 'Unknown error',
  ),
}));

const { handleVersionConflict } = require('../errors/versionConflict');
const { errorService } = require('#/services/errorService');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleVersionConflictAlert', () => {
  it('returns true and shows alert for version conflict', () => {
    handleVersionConflict.mockReturnValue(true);
    const result = handleVersionConflictAlert(new Error('conflict'));
    expect(result).toBe(true);
    expect(alertService.alert).toHaveBeenCalled();
  });

  it('returns false for non-version-conflict errors', () => {
    handleVersionConflict.mockReturnValue(false);
    const result = handleVersionConflictAlert(new Error('other'));
    expect(result).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('calls onRefresh when the user presses Refresh', () => {
    handleVersionConflict.mockReturnValue(true);
    const onRefresh = jest.fn();
    handleVersionConflictAlert(new Error('conflict'), { onRefresh });
    const buttons = (alertService.alert as jest.Mock).mock.calls[0][2];
    const refreshButton = buttons.find(
      (b: AlertButton) => b.text === 'Refresh',
    );
    refreshButton.onPress();
    expect(onRefresh).toHaveBeenCalled();
  });

  it('uses customMessage when provided', () => {
    handleVersionConflict.mockReturnValue(true);
    handleVersionConflictAlert(new Error('conflict'), {
      customMessage: 'Custom message',
    });
    expect(alertService.alert).toHaveBeenCalledWith(
      'Item Updated',
      'Custom message',
      expect.any(Array),
    );
  });
});

describe('handleMutationErrorAlert', () => {
  it('shows alert and reports error', () => {
    handleMutationErrorAlert(new Error('boom'), { operation: 'Test' });
    expect(alertService.alert).toHaveBeenCalledWith('Error', 'boom');
    expect(errorService.reportError).toHaveBeenCalled();
  });

  it('suppresses alert when showAlert is false', () => {
    handleMutationErrorAlert(new Error('boom'), {
      operation: 'Test',
      showAlert: false,
    });
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(errorService.reportError).toHaveBeenCalled();
  });

  it('uses customMessage when provided', () => {
    handleMutationErrorAlert(new Error('boom'), {
      operation: 'Test',
      customMessage: 'Custom error',
    });
    expect(alertService.alert).toHaveBeenCalledWith('Error', 'Custom error');
  });
});
