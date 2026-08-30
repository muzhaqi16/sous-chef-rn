import {
  handleQueueFailure,
  registerQueueFailureHandler,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { restoreItemToShoppingListAfterMoveToPantry } from '#/apollo/utils/shoppingListCacheUpdaters';
import { toastService } from '#/services/toastService';
import { queueStore } from '../queueStore';
import type { FailedMutationInfo } from '../types';

jest.mock('#/apollo/client', () => ({ client: { cache: {} } }));
// The two factories are called at MODULE scope by `pantryCacheUpdaters`, which
// `queueManager` now reaches through `queueReplayReconcilers`. A factory
// omitting them makes this suite fail to load, not fail an assertion — so they
// return a jest.fn() rather than being left undefined.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  safeEvict: jest.fn(),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));
jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  restoreItemToShoppingListAfterMoveToPantry: jest.fn(),
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: { clearEntity: jest.fn() },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock('../queueStore', () => ({
  queueStore: { removeMutation: jest.fn() },
}));

const failure = (
  overrides: Partial<FailedMutationInfo> = {},
): FailedMutationInfo => ({
  mutationId: 'q1',
  operationName: 'UpdatePantryItem',
  entityType: 'PantryItem',
  entityId: 'item-1',
  variables: {},
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

  describe('withdrawing an unlink', () => {
    const movedItem = failure({
      operationName: 'MoveShoppingItemToPantry',
      entityType: 'PantryItem',
      entityId: 'pantry-1',
      variables: {
        input: { shoppingListItemId: 'sli-1', removeFromList: true },
      },
    });

    it('puts the shopping row back when a move is permanently refused', () => {
      // The evict withdraws the pantry row the move CREATED. Nothing else can
      // restore the shopping row it UNLINKED, and without this the item is in
      // neither list — observed on device on a move that timed out, retried and
      // came back NotFound.
      handleQueueFailure(movedItem);

      expect(restoreItemToShoppingListAfterMoveToPantry).toHaveBeenCalledWith(
        expect.anything(),
        'sli-1',
      );
    });

    it('leaves the list alone when the move never unlinked anything', () => {
      handleQueueFailure(
        failure({
          operationName: 'MoveShoppingItemToPantry',
          variables: {
            input: { shoppingListItemId: 'sli-1', removeFromList: false },
          },
        }),
      );

      expect(restoreItemToShoppingListAfterMoveToPantry).not.toHaveBeenCalled();
    });

    it('has no unlink to withdraw for an ordinary create', () => {
      handleQueueFailure(failure());
      expect(restoreItemToShoppingListAfterMoveToPantry).not.toHaveBeenCalled();
    });

    it('still tells the person when the withdrawal throws', () => {
      (
        restoreItemToShoppingListAfterMoveToPantry as jest.Mock
      ).mockImplementationOnce(() => {
        throw new Error('cache gone');
      });

      expect(() => handleQueueFailure(movedItem)).not.toThrow();
      expect(toastService.error).toHaveBeenCalledTimes(1);
    });
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

describe('queue failure handler — dequeue and sole ownership', () => {
  it('removes the withdrawn entry from the queue', () => {
    // Left behind, it sits as FAILED until `cleanupTerminal` ages it out a day
    // later, padding every drain scan and persisted write until then.
    handleQueueFailure(failure({ mutationId: 'q-42' }));
    expect(queueStore.removeMutation).toHaveBeenCalledWith('q-42');
  });

  it('dequeues even when the entity cannot be identified', () => {
    handleQueueFailure(
      failure({
        mutationId: 'q-43',
        entityType: undefined,
        entityId: undefined,
      }),
    );
    expect(safeEvict).not.toHaveBeenCalled();
    expect(queueStore.removeMutation).toHaveBeenCalledWith('q-43');
  });

  it('is the only thing in the app that registers a failure handler', () => {
    // `setFailureHandler` is last-write-wins. A second registration at module
    // scope in App.tsx loses silently: effects run after imports, so this module
    // always wins and App.tsx's handler reads as live while being dead. One
    // owner, asserted.
    const { execSync } = require('child_process');
    const hits = execSync(
      "grep -rn '\\.setFailureHandler(' src App.tsx --include='*.ts' --include='*.tsx' " +
        "| grep -v '__tests__' || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);

    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('queueFailureHandler.ts');
  });
});
