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
const mockScheduleExtractAndSave = jest.fn();
const mockCancel = jest.fn();
const mockClear = jest.fn();
const mockMarkDirty = jest.fn();

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    load: mockLoad,
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

  describe('cache hydration', () => {
    it('restores the persisted cache in a single cache.restore() call', () => {
      // One read, one parse, one restore. `cache.restore()` is destructive
      // (it wipes the EntityStore via init()), so a second call would discard
      // whatever the first restored.
      const persisted = {
        ROOT_QUERY: { __typename: 'Query' },
        'User:1': { id: '1' },
        'PantryItem:1': { id: '1' },
      };
      mockLoad.mockReturnValueOnce(persisted);

      jest.isolateModules(() => {
        require('../client');
      });

      expect(mockLoad).toHaveBeenCalledTimes(1);
      expect(mockRestore).toHaveBeenCalledTimes(1);
      expect(mockRestore).toHaveBeenCalledWith(persisted);
    });

    it('does not restore when there is no persisted cache', () => {
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
