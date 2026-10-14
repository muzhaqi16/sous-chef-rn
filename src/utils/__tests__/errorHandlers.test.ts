import { errorService } from '#/services/errorService';
import { storeApi } from '#store';
import { OfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { reportMutationFailure } from '../errorHandlers';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';

jest.mock('#/services/errorService');

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * During an outage, reporting every failing mutation writes a console error
 * and a telemetry error event apiece — one settings session against a down API
 * produces 228, all describing the same known condition.
 */
describe('reportMutationFailure during a known outage', () => {
  const setApiUnavailable = (unavailable: boolean) => {
    storeApi.setState({
      isOnline: !unavailable,
      // `null` is what losing the link leaves behind: nothing has been tried
      // since, so the API's state is unknown. `true` means a probe PROVED it
      // reachable, which outranks NetInfo and is not an outage at all.
      apiReachable: unavailable ? null : true,
    } as Partial<ReturnType<typeof storeApi.getState>>);
  };

  afterEach(() => setApiUnavailable(false));

  it('skips the report for a network error while the API is unavailable', () => {
    setApiUnavailable(true);
    reportMutationFailure(
      new NetworkRequestError('Network request failed'),
      'Update',
    );

    expect(errorService.reportError).not.toHaveBeenCalled();
  });

  it('skips the report for an offline rejection while the API is unavailable', () => {
    setApiUnavailable(true);
    reportMutationFailure(new OfflineRejectedError('Update'), 'Update');

    expect(errorService.reportError).not.toHaveBeenCalled();
  });

  it('still reports a non-network error while the API is unavailable', () => {
    setApiUnavailable(true);
    reportMutationFailure(
      new Error('Validation failed: name required'),
      'Update',
    );

    expect(errorService.reportError).toHaveBeenCalled();
  });

  it('reports a network error normally while the API is reachable', () => {
    setApiUnavailable(false);
    reportMutationFailure(
      new NetworkRequestError('Network request failed'),
      'Update',
    );

    expect(errorService.reportError).toHaveBeenCalled();
  });
});
