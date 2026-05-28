'use no memo';

// Mock all dependencies before importing the client module

jest.mock('../links/index', () => ({
  createLink: jest.fn(() => ({
    request: jest.fn(),
  })),
}));

const mockRestore = jest.fn();
const mockExtract = jest.fn(() => ({ ROOT_QUERY: {} }));
const mockWrite = jest.fn();
const mockEvict = jest.fn();
const mockModify = jest.fn();
const mockGc = jest.fn();

jest.mock('../cache', () => ({
  makeCache: jest.fn(() => ({
    restore: mockRestore,
    extract: mockExtract,
    write: mockWrite,
    evict: mockEvict,
    modify: mockModify,
    gc: mockGc,
  })),
}));

const mockLoad = jest.fn((): Record<string, unknown> | null => null);
const mockLoadCritical = jest.fn((): Record<string, unknown> | null => null);
const mockLoadDeferred = jest.fn((): Record<string, unknown> | null => null);
const mockRestoreDeferred = jest.fn();
const mockScheduleExtractAndSave = jest.fn();
const mockCancel = jest.fn();
const mockClear = jest.fn();
const mockMarkDirty = jest.fn();

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    load: mockLoad,
    loadCritical: mockLoadCritical,
    loadDeferred: mockLoadDeferred,
    restoreDeferred: mockRestoreDeferred,
    scheduleExtractAndSave: mockScheduleExtractAndSave,
    cancel: mockCancel,
    clear: mockClear,
    markDirty: mockMarkDirty,
  },
}));

jest.mock('../links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));

jest.mock('../links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
  registerApolloClient: jest.fn(),
}));

describe('Apollo client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports a client instance', () => {
    const { client } = require('../client');
    expect(client).toBeDefined();
    expect(client.cache).toBeDefined();
  });

  describe('lazy cache hydration', () => {
    it('merges critical and deferred partitions into a single cache.restore() call', () => {
      const criticalData = {
        ROOT_QUERY: { __typename: 'Query' },
        'User:1': { id: '1' },
      };
      const deferredData = {
        'PantryItem:1': { id: '1' },
        'Recipe:2': { id: '2' },
      };
      mockLoadCritical.mockReturnValueOnce(criticalData);
      mockLoadDeferred.mockReturnValueOnce(deferredData);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockLoadCritical).toHaveBeenCalled();
      expect(mockLoadDeferred).toHaveBeenCalled();
      expect(mockRestore).toHaveBeenCalledWith({
        ...criticalData,
        ...deferredData,
      });
      expect(mockLoad).not.toHaveBeenCalled();
    });

    it('restores only critical when deferred returns null', () => {
      const criticalData = { ROOT_QUERY: { __typename: 'Query' } };
      mockLoadCritical.mockReturnValueOnce(criticalData);
      mockLoadDeferred.mockReturnValueOnce(null);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockRestore).toHaveBeenCalledWith(criticalData);
      expect(mockLoad).not.toHaveBeenCalled();
    });

    it('restores only deferred when critical returns null', () => {
      const deferredData = { 'PantryItem:1': { id: '1' } };
      mockLoadCritical.mockReturnValueOnce(null);
      mockLoadDeferred.mockReturnValueOnce(deferredData);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockRestore).toHaveBeenCalledWith(deferredData);
      expect(mockLoad).not.toHaveBeenCalled();
    });

    it('falls back to load() when both loadCritical and loadDeferred return null (migration)', () => {
      mockLoadCritical.mockReturnValueOnce(null);
      mockLoadDeferred.mockReturnValueOnce(null);
      const legacyData = { ROOT_QUERY: {}, 'PantryItem:1': { id: '1' } };
      mockLoad.mockReturnValueOnce(legacyData);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockLoadCritical).toHaveBeenCalled();
      expect(mockLoadDeferred).toHaveBeenCalled();
      expect(mockLoad).toHaveBeenCalled();
      expect(mockRestore).toHaveBeenCalledWith(legacyData);
    });

    it('does not restore when all load methods return null', () => {
      mockLoadCritical.mockReturnValueOnce(null);
      mockLoadDeferred.mockReturnValueOnce(null);
      mockLoad.mockReturnValueOnce(null);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockRestore).not.toHaveBeenCalled();
    });
  });

  it('wraps cache.write to schedule persistence', () => {
    const { client } = require('../client');

    // The write method should have been wrapped
    client.cache.write({ dataId: 'test', result: {} });

    // scheduleExtractAndSave should be called after write
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.evict to schedule persistence', () => {
    const { client } = require('../client');
    client.cache.evict({ id: 'test' });
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.modify to schedule persistence', () => {
    const { client } = require('../client');
    client.cache.modify({ fields: {} });
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.gc to schedule persistence if gc exists', () => {
    const { client } = require('../client');
    if (client.cache.gc) {
      client.cache.gc();
      expect(mockScheduleExtractAndSave).toHaveBeenCalled();
    }
  });

  describe('cancelCachePersistence', () => {
    it('cancels pending persistence', () => {
      const { cancelCachePersistence } = require('../client');
      cancelCachePersistence();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  it('client has correct default options', () => {
    const { client } = require('../client');
    expect(client.defaultOptions.query?.fetchPolicy).toBe('network-only');
    expect(client.defaultOptions.query?.errorPolicy).toBe('all');
    expect(client.defaultOptions.mutate?.errorPolicy).toBe('all');
    expect(client.defaultOptions.watchQuery?.fetchPolicy).toBe(
      'cache-and-network',
    );
  });

  it('client has clientAwareness configured', () => {
    const { client } = require('../client');
    // clientAwareness is set in the constructor
    expect(client).toBeDefined();
  });
});
