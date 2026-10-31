import {
  handleQueueFailure,
  registerQueueFailureHandler,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import {
  restoreReceiptCheckInListLines,
  withdrawReceiptCheckIn,
} from '#features/receipts/offline/receiptCheckIn';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { queueStore } from '../queueStore';
import type { FailedMutationInfo } from '../types';
import { classifyError } from '../queueErrorPolicy';
import { subjectTypeOf } from '../queuedSubject';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import type { ApolloClient } from '@apollo/client';
import { registerApolloClient } from '#/apollo/clientRegistry';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UpdateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';

const client = {
  cache: {},
  refetchQueries: jest.fn(() => Promise.resolve([])),
} as unknown as jest.Mocked<ApolloClient>;
registerApolloClient(client);
jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));
jest.mock('#features/receipts/offline/receiptCheckIn', () => ({
  ...jest.requireActual('#features/receipts/offline/receiptCheckIn'),
  restoreReceiptCheckInListLines: jest.fn(),
  withdrawReceiptCheckIn: jest.fn(),
}));
// These factories are called at MODULE scope by the pantry and home cache
// updaters, which `queueManager` reaches through `queueReplayReconcilers`. A
// factory omitting one makes this suite fail to LOAD, not fail an assertion —
// so each returns a jest.fn() rather than being left undefined.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  // Real for what this suite does not assert on, so an updater a module in the
  // queue's import graph builds at load exists.
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  safeEvict: jest.fn(),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromQueryConnectionUpdater: jest.fn(() => jest.fn()),
}));
jest.mock('#features/shoppingList/cache/moveToPantry', () => ({
  restoreItemToShoppingListAfterMoveToPantry: jest.fn(),
}));
jest.mock('#features/shoppingList/cache/purchase', () => ({
  writePurchaseInfo: jest.fn(),
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    clearEntity: jest.fn(),
    clearEntityById: jest.fn(),
  },
}));
const mockDrop = jest.fn();
jest.mock('#/apollo/pendingWrites/pendingWrites', () => ({
  pendingWritesOf: () => ({ drop: mockDrop }),
}));
jest.mock('../queueStore', () => ({
  queueStore: {
    removeMutation: jest.fn(),
    // No signed-in queue, so nothing is pending and the reread runs.
    getCurrentUserId: jest.fn(() => null),
    getQueueStats: jest.fn(() => ({
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      authErrors: 0,
    })),
  },
}));

const failure = (
  overrides: Partial<FailedMutationInfo> = {},
): FailedMutationInfo => ({
  mutationId: 'q1',
  operationName: operationNameOf(UpdatePantryItemDocument),
  entityType: 'PantryItem',
  entityId: 'item-1',
  subjectType: 'PantryItem',
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

  describe('a removal the queue kept because its entry merged', () => {
    const registeredNotice = () => {
      const spy = jest.spyOn(queueManager, 'setRemovalKeptHandler');
      registerQueueFailureHandler();
      const [[notice]] = spy.mock.calls as [[(type: string | null) => void]];
      spy.mockRestore();
      return notice;
    };

    it('is told to the person, naming the entry that stays', () => {
      registeredNotice()('ShoppingListItem');

      expect(toastService.info).toHaveBeenCalledWith(
        t('errors.queuedRemovalKeptResource', {
          resource: t('errors.resourceNames.ShoppingListItem'),
        }),
      );
      expect(toastService.error).not.toHaveBeenCalled();
    });

    it('is told without a name when the entry has none', () => {
      const notice = registeredNotice();
      notice(null);
      notice('NoSuchEntity');

      expect(toastService.info).toHaveBeenNthCalledWith(
        1,
        t('errors.queuedRemovalKept'),
      );
      expect(toastService.info).toHaveBeenNthCalledWith(
        2,
        t('errors.queuedRemovalKept'),
      );
    });
  });

  describe('a write with a local write', () => {
    const withLocalWrite = () =>
      failure({
        operationName: operationNameOf(CreateReceiptCheckInDocument),
        pendingWriteId: 'write-1',
      });

    it('drops its layer, and evicts nothing', () => {
      handleQueueFailure(withLocalWrite());

      expect(mockDrop).toHaveBeenCalledWith('write-1');
      expect(safeEvict).not.toHaveBeenCalled();
      expect(optimisticDataPersistence.clearEntity).not.toHaveBeenCalled();
      expect(withdrawReceiptCheckIn).not.toHaveBeenCalled();
    });

    it('still tells the person and leaves the queue', () => {
      handleQueueFailure(withLocalWrite());

      expect(toastService.error).toHaveBeenCalledTimes(1);
      expect(queueStore.removeMutation).toHaveBeenCalledWith('q1');
    });
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
    const checkIn = failure({
      operationName: operationNameOf(CreateReceiptCheckInDocument),
      variables: { input: { lines: [] } },
    });

    it('puts the list lines back when a check-in is permanently refused', () => {
      handleQueueFailure(checkIn);

      expect(restoreReceiptCheckInListLines).toHaveBeenCalledWith(
        expect.anything(),
        checkIn.variables,
      );
    });

    it('has no unlink to withdraw for an ordinary write', () => {
      handleQueueFailure(failure());
      expect(restoreReceiptCheckInListLines).not.toHaveBeenCalled();
    });

    it('still tells the person when the withdrawal throws', () => {
      (restoreReceiptCheckInListLines as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('cache gone');
        },
      );

      expect(() => handleQueueFailure(checkIn)).not.toThrow();
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

  describe('naming what was not saved', () => {
    const toldAfter = (overrides: Partial<FailedMutationInfo>) => {
      handleQueueFailure(failure(overrides));
      const [message] = (toastService.error as jest.Mock).mock.calls[0];
      return message;
    };

    it('names the entity a refused change was to', () => {
      expect(toldAfter({})).toBe(
        t('errors.queuedChangeRejectedResource', {
          resource: t('errors.resourceNames.PantryItem'),
        }),
      );
    });

    // A removal evicts its row, and a stored edit can outlive its row's cache.
    it("names it from the write's input when the cache does not hold the row", () => {
      const message = toldAfter({
        operationName: operationNameOf(UpdateMealPlanItemDocument),
        entityType: null,
        entityId: 'meal-1',
        subjectType: subjectTypeOf({ mutation: UpdateMealPlanItemDocument }),
      });

      expect(message).toBe(
        t('errors.queuedChangeRejectedResource', {
          resource: t('errors.resourceNames.MealPlanItem'),
        }),
      );
      expect(message).toContain('meal plan item');
    });

    it.each([null, 'NoSuchEntity'])(
      'says a change was not saved when nothing names it (%s)',
      subjectType => {
        expect(toldAfter({ entityType: null, subjectType })).toBe(
          t('errors.queuedChangeRejected'),
        );
      },
    );
  });

  // "Someone got there first" is a different thing for the user to know than
  // "this failed", and the resource map already names the entity.
  it('names the entity when a newer change overwrote this one', () => {
    handleQueueFailure(
      failure({
        error: {
          type: 'conflict',
          message: 'Version conflict',
          code: 'VERSION_CONFLICT',
          timestamp: 0,
          retryable: false,
        },
      }),
    );

    const [message] = (toastService.error as jest.Mock).mock.calls[0];
    expect(message).toContain('pantry item');
    expect(message).not.toBe(t('errors.queuedChangeRejected'));
    expect(safeEvict).toHaveBeenCalledWith(
      expect.anything(),
      'PantryItem',
      'item-1',
    );
  });

  it('falls back to the generic overwrite copy with no entity', () => {
    handleQueueFailure(
      failure({
        entityType: null,
        entityId: null,
        subjectType: null,
        error: {
          type: 'conflict',
          message: 'Version conflict',
          code: 'VERSION_CONFLICT',
          timestamp: 0,
          retryable: false,
        },
      }),
    );

    const [message] = (toastService.error as jest.Mock).mock.calls[0];
    expect(message).toBe(t('errors.queuedChangeOverwritten'));
  });

  it('gives a RESOURCE_VERSION_CONFLICT refusal the overwrite copy', () => {
    const error = classifyError(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Resource was modified by another request',
            extensions: { code: TopLevelErrorCode.ResourceVersionConflict },
          },
        ],
      }),
    );

    handleQueueFailure(
      failure({ entityType: null, entityId: null, subjectType: null, error }),
    );

    const [message] = (toastService.error as jest.Mock).mock.calls[0];
    expect(message).toBe(t('errors.queuedChangeOverwritten'));
  });

  it('clears what the withdrawn write persisted even with no typename', () => {
    // The cache was purged, so the typename cannot be read back — but the id
    // came off the queue entry. Left behind, the optimistic value is re-applied
    // over the server's on the next restoration pass.
    handleQueueFailure(failure({ entityType: null, entityId: 'item-7' }));

    expect(optimisticDataPersistence.clearEntityById).toHaveBeenCalledWith(
      'item-7',
    );
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

describe('queue failure handler — a withdrawn row is read back', () => {
  const settle = () => new Promise(resolve => setImmediate(resolve));
  let whenIdle: jest.SpyInstance;

  beforeEach(() => {
    whenIdle = jest.spyOn(queueManager, 'whenIdle').mockResolvedValue();
  });
  afterEach(() => whenIdle.mockRestore());

  it('re-reads once the drain settles, so a refused update shows the server value', async () => {
    // The evict drops the refused local value; without a read the row the
    // server still holds is missing from its list until an unrelated refetch.
    handleQueueFailure(
      failure({
        operationName: operationNameOf(UpdateShoppingListItemDocument),
        entityType: 'ShoppingListItem',
        entityId: 'sli-1',
      }),
    );
    expect(client.refetchQueries).not.toHaveBeenCalled();

    await settle();

    expect(whenIdle).toHaveBeenCalled();
    expect(client.refetchQueries).toHaveBeenCalledWith({ include: 'active' });
  });

  it('re-reads once for every withdrawal in the same pass', async () => {
    handleQueueFailure(failure({ mutationId: 'q-a' }));
    handleQueueFailure(failure({ mutationId: 'q-b' }));

    await settle();

    expect(client.refetchQueries).toHaveBeenCalledTimes(1);
  });

  it('reports a withdrawal step that throws', () => {
    (withdrawReceiptCheckIn as jest.Mock).mockImplementationOnce(() => {
      throw new Error('cache gone');
    });

    handleQueueFailure(
      failure({
        operationName: operationNameOf(CreateReceiptCheckInDocument),
        variables: { input: { pantryId: 'pantry-1' } },
      }),
    );

    expect(errorService.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: expect.stringContaining('CreateReceiptCheckIn'),
      }),
    );
  });
});
