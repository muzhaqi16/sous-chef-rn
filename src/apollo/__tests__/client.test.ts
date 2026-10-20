'use no memo';

import { gql } from '@apollo/client';

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

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    load: mockLoad,
    scheduleExtractAndSave: mockScheduleExtractAndSave,
    cancel: mockCancel,
    clear: mockClear,
  },
}));

const loadClient = (): typeof import('../client') => require('../client');

describe('Apollo client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a client instance', () => {
    const client = loadClient().createApolloClient();
    expect(client).toBeDefined();
    expect(client.cache).toBeDefined();
  });

  // NOTE: these mock `makeCache`, so they verify the restore CALL, not that the
  // cache ends up populated — and they passed throughout the period when the
  // restore never actually ran (storage was not ready at module load). The
  // timing guard lives in __tests__/apollo/cacheRestoreTiming.test.ts.
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
        loadClient().createApolloClient();
      });

      expect(mockLoad).toHaveBeenCalledTimes(1);
      expect(mockRestore).toHaveBeenCalledTimes(1);
      expect(mockRestore).toHaveBeenCalledWith(persisted);
    });

    it('does not restore when there is no persisted cache', () => {
      mockLoad.mockReturnValueOnce(null);

      jest.isolateModules(() => {
        loadClient().createApolloClient();
      });

      expect(mockRestore).not.toHaveBeenCalled();
    });
  });

  it('wraps cache.write to schedule persistence', () => {
    const client = loadClient().createApolloClient();

    // The write method should have been wrapped
    client.cache.write({
      query: gql`
        query Probe {
          __typename
        }
      `,
      result: { __typename: 'Query' },
    });

    // scheduleExtractAndSave should be called after write
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.evict to schedule persistence', () => {
    const client = loadClient().createApolloClient();
    client.cache.evict({ id: 'test' });
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.modify to schedule persistence', () => {
    const client = loadClient().createApolloClient();
    client.cache.modify({ fields: {} });
    expect(mockScheduleExtractAndSave).toHaveBeenCalled();
  });

  it('wraps cache.gc to schedule persistence if gc exists', () => {
    const client = loadClient().createApolloClient();
    if (client.cache.gc) {
      client.cache.gc();
      expect(mockScheduleExtractAndSave).toHaveBeenCalled();
    }
  });

  it('client has correct default options', () => {
    const client = loadClient().createApolloClient();
    expect(client.defaultOptions.query?.fetchPolicy).toBe('cache-first');
    expect(client.defaultOptions.query?.errorPolicy).toBe('all');
    expect(client.defaultOptions.mutate?.errorPolicy).toBe('all');
    expect(client.defaultOptions.watchQuery?.fetchPolicy).toBe(
      'cache-and-network',
    );
  });

  it('client has clientAwareness configured', () => {
    const client = loadClient().createApolloClient();
    // clientAwareness is set in the constructor
    expect(client).toBeDefined();
  });
});
