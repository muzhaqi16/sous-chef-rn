import { alertService, type AlertButton } from '#/services/alertService';
import { storeApi } from '#store';
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

  /**
   * During an outage every failing mutation used to write a console error and a
   * telemetry error event — one settings session against a down API produced
   * 228, all describing the same known condition.
   */
  describe('reporting during a known outage', () => {
    const setApiUnavailable = (unavailable: boolean) => {
      storeApi.setState({
        isOnline: !unavailable,
        apiReachable: true,
      } as Partial<ReturnType<typeof storeApi.getState>>);
    };

    afterEach(() => setApiUnavailable(false));

    it('skips the report for a network error while the API is unavailable', () => {
      setApiUnavailable(true);
      handleMutationErrorAlert(new Error('Network request failed'), {
        operation: 'Update Settings',
      });

      expect(errorService.reportError).not.toHaveBeenCalled();
      // The user still gets told — only the report is suppressed.
      expect(alertService.alert).toHaveBeenCalled();
    });

    it('still reports a non-network error while the API is unavailable', () => {
      setApiUnavailable(true);
      handleMutationErrorAlert(new Error('Validation failed: name required'), {
        operation: 'Update Settings',
      });

      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('reports a network error normally while the API is reachable', () => {
      setApiUnavailable(false);
      handleMutationErrorAlert(new Error('Network request failed'), {
        operation: 'Update Settings',
      });

      expect(errorService.reportError).toHaveBeenCalled();
    });
  });
});
