import { setupGlobalErrorHandler } from '../globalErrorHandler';
import { Telemetry } from '#/services/telemetry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackError: jest.fn(),
    increment: jest.fn(),
  },
}));

describe('globalErrorHandler', () => {
  const originalGetGlobalHandler = ErrorUtils.getGlobalHandler;
  const originalSetGlobalHandler = ErrorUtils.setGlobalHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    ErrorUtils.getGlobalHandler = jest.fn(() => jest.fn());
    ErrorUtils.setGlobalHandler = jest.fn();
  });

  afterEach(() => {
    ErrorUtils.getGlobalHandler = originalGetGlobalHandler;
    ErrorUtils.setGlobalHandler = originalSetGlobalHandler;
  });

  it('installs a global error handler', () => {
    setupGlobalErrorHandler();
    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('calls Telemetry.trackError when handler is invoked', () => {
    setupGlobalErrorHandler();
    const handler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    const error = new Error('Test crash');
    handler(error, true);
    expect(Telemetry.trackError).toHaveBeenCalledWith(error, {
      source: 'global_handler',
      is_fatal: true,
    });
  });

  it('increments error counter', () => {
    setupGlobalErrorHandler();
    const handler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    handler(new Error('Test'), false);
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'app_unhandled_exceptions_total',
      1,
      { fatal: 'false' },
    );
  });

  it('forwards to previous handler', () => {
    const previousHandler = jest.fn();
    (ErrorUtils.getGlobalHandler as jest.Mock).mockReturnValue(previousHandler);
    setupGlobalErrorHandler();
    const handler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    const error = new Error('Test');
    handler(error, false);
    expect(previousHandler).toHaveBeenCalledWith(error, false);
  });
});
