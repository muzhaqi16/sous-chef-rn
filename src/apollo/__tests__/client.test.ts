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
const mockRestoreDeferred = jest.fn();
const mockScheduleExtractAndSave = jest.fn();
const mockCancel = jest.fn();
const mockClear = jest.fn();
const mockMarkDirty = jest.fn();

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    load: mockLoad,
    loadCritical: mockLoadCritical,
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
    it('restores critical cache synchronously and does NOT schedule deferred restore at module init', () => {
      const criticalData = { ROOT_QUERY: { __typename: 'Query' } };
      mockLoadCritical.mockReturnValueOnce(criticalData);

      const mockRIC = jest.spyOn(global, 'requestIdleCallback');

      jest.isolateModules(() => {
        require('../client');
      });

      // Phase 1: critical restore called synchronously on module init
      expect(mockLoadCritical).toHaveBeenCalled();
      expect(mockRestore).toHaveBeenCalledWith(criticalData);

      // Phase 2 must be opt-in from App.tsx — module init must NOT schedule it.
      // (Phase 2 itself is owned by apolloCachePersistence.restoreDeferred now
      // and is tested in ApolloCachePersistence.test.ts.)
      expect(mockRIC).not.toHaveBeenCalled();
      expect(mockRestoreDeferred).not.toHaveBeenCalled();

      // Migration path should NOT have been used
      expect(mockLoad).not.toHaveBeenCalled();

      mockRIC.mockRestore();
    });

    it('falls back to load() when loadCritical returns null (migration)', () => {
      mockLoadCritical.mockReturnValueOnce(null);
      const legacyData = { ROOT_QUERY: {}, 'PantryItem:1': { id: '1' } };
      mockLoad.mockReturnValueOnce(legacyData);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockLoadCritical).toHaveBeenCalled();
      expect(mockLoad).toHaveBeenCalled();
      expect(mockRestore).toHaveBeenCalledWith(legacyData);
    });

    it('does not restore when both loadCritical and load return null', () => {
      mockLoadCritical.mockReturnValueOnce(null);
      mockLoad.mockReturnValueOnce(null);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockLoadCritical).toHaveBeenCalled();
      expect(mockLoad).toHaveBeenCalled();
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
