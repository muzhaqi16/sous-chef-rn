import {
  handleQueueFailure,
  registerQueueFailureHandler,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { revertIntent } from '#/apollo/write/applyIntent';
import { toastService } from '#/services/toastService';
import { queueStore } from '../queueStore';
import type { FailedMutationInfo } from '../types';

jest.mock('#/apollo/client', () => ({ client: { cache: {} } }));
jest.mock('#/apollo/utils/cacheUpdaters', () => ({ safeEvict: jest.fn() }));
jest.mock('#/apollo/write/applyIntent', () => ({ revertIntent: jest.fn() }));
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
    // `setFailureHandler` is last-write-wins. App.tsx used to register a second
    // handler at module scope; effects run after imports, so this module always
    // won and App.tsx's read as live while being dead. One owner, asserted.
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

  describe('a write that changed several entities', () => {
    // A batch move takes N rows out of a list in ONE mutation. Undoing only one
    // of them leaves the rest gone from the list and never on the server —
    // which is what the queue did while an entry could hold a single intent.
    const intentFor = (id: string) => ({
      target: { __typename: 'ShoppingListItem', id },
      lifecycle: 'remove' as const,
      patch: {},
      inverse: {},
      convergence: 'absolute' as const,
    });

    it('undoes every one of them, last first', () => {
      const intents = [intentFor('a'), intentFor('b'), intentFor('c')];

      handleQueueFailure(failure({ intents }));

      expect(revertIntent).toHaveBeenCalledTimes(3);
      // Reverse order: a write that depended on an earlier one is undone while
      // that one still stands.
      expect((revertIntent as jest.Mock).mock.calls.map(([, i]) => i)).toEqual([
        intents[2],
        intents[1],
        intents[0],
      ]);
      // The intents own the undo, so the blunt evict must not also fire.
      expect(safeEvict).not.toHaveBeenCalled();
    });
  });

  it('still evicts when the only intent describes nothing', () => {
    // A context-only intent — `useConvertExpiredBatchesToWaste` files one
    // because the server resolves the effect and there is no local value to
    // write. Treating it as the undo made the withdrawal a no-op under a
    // "we couldn't save this" toast, with the row keeping whatever it had.
    handleQueueFailure(
      failure({
        intents: [
          {
            target: { __typename: 'PantryItem', id: 'item-1' },
            patch: {},
            inverse: {},
            convergence: 'relative',
          },
        ],
      }),
    );

    expect(revertIntent).not.toHaveBeenCalled();
    expect(safeEvict).toHaveBeenCalledWith(
      expect.anything(),
      'PantryItem',
      'item-1',
    );
  });
});
