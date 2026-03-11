import { QueueStatus } from '../types';

// Mock the store module
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
    getInitialState: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock queueStore
jest.mock('../queueStore', () => ({
  queueStore: {
    getMutationsForUser: jest.fn(() => []),
    clearAllQueues: jest.fn(),
    clearQueueForUser: jest.fn(() => 2),
    updateMutation: jest.fn(() => true),
    getQueueStats: jest.fn(() => ({
      total: 5,
      pending: 2,
      processing: 1,
      failed: 1,
      authErrors: 1,
    })),
  },
}));

// Mock queueManager
jest.mock('../queueManager', () => ({
  queueManager: {
    processQueue: jest.fn(() => Promise.resolve()),
    getStats: jest.fn(() => ({
      total: 5,
      pending: 2,
      processing: 1,
      failed: 1,
      authErrors: 1,
    })),
  },
}));

// Mock the logger
jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the Apollo client for queueManager imports
jest.mock('../../client', () => ({
  client: { mutate: jest.fn() },
}));

// Mock generateId
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'gen-id'),
}));

// Now import the module under test
import { queueDebug } from '../queueDebug';
import { queueStore } from '../queueStore';
import { queueManager } from '../queueManager';
import { useStore } from '#store';

const mockedGetState = useStore.getState as jest.Mock;

describe('queueDebug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // viewQueue
  // -------------------------------------------------------------------------
  describe('viewQueue', () => {
    it('logs queue contents for authenticated user', () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
      });
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue([
        {
          id: 'mut-1',
          operationName: 'AddItem',
          status: QueueStatus.PENDING,
          createdAt: Date.now(),
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: 'mut-2',
          operationName: 'UpdateItem',
          status: QueueStatus.FAILED,
          createdAt: Date.now(),
          retryCount: 2,
          maxRetries: 3,
          lastError: { message: 'Server error' },
        },
      ]);

      queueDebug.viewQueue();

      expect(queueStore.getMutationsForUser).toHaveBeenCalledWith('user-1');
      // Should log header info
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Offline Mutation Queue'),
      );
    });

    it('logs "No authenticated user" when no user', () => {
      mockedGetState.mockReturnValue({ user: null });

      queueDebug.viewQueue();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No authenticated user'),
      );
      expect(queueStore.getMutationsForUser).not.toHaveBeenCalled();
    });

    it('logs "(empty)" when queue has no mutations', () => {
      mockedGetState.mockReturnValue({ user: { id: 'user-1' } });
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue([]);

      queueDebug.viewQueue();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('empty'));
    });
  });

  // -------------------------------------------------------------------------
  // getQueueStats
  // -------------------------------------------------------------------------
  describe('getQueueStats', () => {
    it('logs stats for authenticated user', () => {
      mockedGetState.mockReturnValue({ user: { id: 'user-1' } });

      queueDebug.getQueueStats();

      expect(queueManager.getStats).toHaveBeenCalledWith('user-1');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Queue Statistics'),
      );
    });

    it('logs stats for a specific user', () => {
      mockedGetState.mockReturnValue({ user: { id: 'user-1' } });

      queueDebug.getQueueStats('user-2');

      expect(queueManager.getStats).toHaveBeenCalledWith('user-2');
    });

    it('logs error when no user available', () => {
      mockedGetState.mockReturnValue({ user: null });

      queueDebug.getQueueStats();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No user specified'),
      );
    });

    it('logs oldest mutation age in minutes', () => {
      mockedGetState.mockReturnValue({ user: { id: 'user-1' } });
      (queueManager.getStats as jest.Mock).mockReturnValue({
        total: 3,
        pending: 1,
        processing: 0,
        failed: 0,
        authErrors: 0,
        oldestMutationAge: 300000, // 5 minutes
      });

      queueDebug.getQueueStats();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Oldest'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // clearQueue
  // -------------------------------------------------------------------------
  describe('clearQueue', () => {
    it('calls clearAllQueues and logs confirmation', () => {
      queueDebug.clearQueue();

      expect(queueStore.clearAllQueues).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Queue cleared'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // clearQueueForUser
  // -------------------------------------------------------------------------
  describe('clearQueueForUser', () => {
    it('clears queue for the specified user', () => {
      queueDebug.clearQueueForUser('user-1');

      expect(queueStore.clearQueueForUser).toHaveBeenCalledWith('user-1');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 2 mutations'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // processQueue
  // -------------------------------------------------------------------------
  describe('processQueue', () => {
    it('triggers queue processing and logs', async () => {
      await queueDebug.processQueue();

      expect(queueManager.processQueue).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Manually processing queue'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Queue processing complete'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // retryFailedMutations
  // -------------------------------------------------------------------------
  describe('retryFailedMutations', () => {
    it('resets failed mutations to pending with retryCount 0', () => {
      const failedMutations = [
        { id: 'fail-1', status: QueueStatus.FAILED, retryCount: 3 },
        { id: 'fail-2', status: QueueStatus.FAILED, retryCount: 2 },
      ];
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue(
        failedMutations,
      );
      mockedGetState.mockReturnValue({ isOnline: true });

      queueDebug.retryFailedMutations('user-1');

      expect(queueStore.getMutationsForUser).toHaveBeenCalledWith(
        'user-1',
        QueueStatus.FAILED,
      );
      expect(queueStore.updateMutation).toHaveBeenCalledWith('fail-1', {
        status: QueueStatus.PENDING,
        retryCount: 0,
      });
      expect(queueStore.updateMutation).toHaveBeenCalledWith('fail-2', {
        status: QueueStatus.PENDING,
        retryCount: 0,
      });
      // Should trigger processing since online
      expect(queueManager.processQueue).toHaveBeenCalled();
    });

    it('does not trigger processing when offline', () => {
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue([
        { id: 'fail-1', status: QueueStatus.FAILED },
      ]);
      mockedGetState.mockReturnValue({ isOnline: false });

      queueDebug.retryFailedMutations('user-1');

      expect(queueStore.updateMutation).toHaveBeenCalled();
      expect(queueManager.processQueue).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Still offline'),
      );
    });

    it('handles no failed mutations', () => {
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue([]);
      mockedGetState.mockReturnValue({ isOnline: true });

      queueDebug.retryFailedMutations('user-1');

      expect(queueStore.updateMutation).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Retrying 0 failed mutations'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // viewQueueForUser
  // -------------------------------------------------------------------------
  describe('viewQueueForUser', () => {
    it('logs queue contents for specific user', () => {
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue([
        {
          operationName: 'AddItem',
          status: QueueStatus.PENDING,
        },
      ]);

      queueDebug.viewQueueForUser('user-1');

      expect(queueStore.getMutationsForUser).toHaveBeenCalledWith('user-1');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Queue for user user-1'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // exportQueue
  // -------------------------------------------------------------------------
  describe('exportQueue', () => {
    it('exports queue as JSON string', () => {
      mockedGetState.mockReturnValue({ user: { id: 'user-1' } });
      const mutations = [{ id: 'mut-1', operationName: 'AddItem' }];
      (queueStore.getMutationsForUser as jest.Mock).mockReturnValue(mutations);

      const result = queueDebug.exportQueue();

      expect(result).toBe(JSON.stringify(mutations, null, 2));
    });

    it('returns empty string when no user', () => {
      mockedGetState.mockReturnValue({ user: null });

      const result = queueDebug.exportQueue();

      expect(result).toBe('');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No authenticated user'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // simulateOffline / simulateOnline
  // -------------------------------------------------------------------------
  describe('network simulation', () => {
    it('simulateOffline calls setOffline', () => {
      const setOffline = jest.fn();
      mockedGetState.mockReturnValue({ setOffline });

      queueDebug.simulateOffline();

      expect(setOffline).toHaveBeenCalled();
    });

    it('simulateOnline calls setOnline and triggers processing', () => {
      const setOnline = jest.fn();
      mockedGetState.mockReturnValue({ setOnline });

      queueDebug.simulateOnline();

      expect(setOnline).toHaveBeenCalled();
      expect(queueManager.processQueue).toHaveBeenCalled();
    });
  });
});
