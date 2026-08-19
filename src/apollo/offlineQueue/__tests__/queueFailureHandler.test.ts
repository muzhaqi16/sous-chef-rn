import {
  handleQueueFailure,
  registerQueueFailureHandler,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import type { FailedMutationInfo } from '../types';

jest.mock('#/apollo/client', () => ({ client: { cache: {} } }));
jest.mock('#/apollo/utils/cacheUpdaters', () => ({ safeEvict: jest.fn() }));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: { clearEntity: jest.fn() },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

const failure = (
  overrides: Partial<FailedMutationInfo> = {},
): FailedMutationInfo => ({
  mutationId: 'q1',
  operationName: 'UpdatePantryItem',
  entityType: 'PantryItem',
  entityId: 'item-1',
  error: {
    type: 'server',
    message: 'UpdatePantryItem rejected: ValidationError on field quantity',
    code: 'VALIDATION_ERROR',
    timestamp: 0,
    retryable: false,
  },
  ...overrides,
});

beforeEach(jest.clearAllMocks);

describe('queue failure handler', () => {
  it('is registered with the queue', () => {
    const spy = jest.spyOn(queueManager, 'setFailureHandler');
    registerQueueFailureHandler();
    // The whole defect was that nothing ever called this: the queue invoked a
    // handler that was always null, so a rejected local change stayed on screen.
    expect(spy).toHaveBeenCalledWith(handleQueueFailure);
    spy.mockRestore();
  });

  it('withdraws the locally-applied change from the cache', () => {
    handleQueueFailure(failure());
    expect(safeEvict).toHaveBeenCalledWith(
      expect.anything(),
      'PantryItem',
      'item-1',
    );
  });

  it('clears the persisted optimistic value so it cannot come back', () => {
    // Restoration replays persisted optimistic fields on the next launch; a
    // withdrawn change left behind there would reappear over server data.
    handleQueueFailure(failure());
    expect(optimisticDataPersistence.clearEntity).toHaveBeenCalledWith(
      'PantryItem',
      'item-1',
    );
  });

  it('tells the person', () => {
    handleQueueFailure(failure());
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('shows the app’s own words, never the server’s', () => {
    handleQueueFailure(failure());
    const [message] = (toastService.error as jest.Mock).mock.calls[0];
    expect(message).not.toContain('UpdatePantryItem');
    expect(message).not.toContain('ValidationError');
    expect(message).not.toContain('VALIDATION_ERROR');
  });

  it('still tells the person when the entity cannot be identified', () => {
    // An operation with no single entity, or one already evicted. Nothing to
    // withdraw, but silence would leave them believing the change stuck.
    handleQueueFailure(failure({ entityType: null, entityId: null }));

    expect(safeEvict).not.toHaveBeenCalled();
    expect(optimisticDataPersistence.clearEntity).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });
});
