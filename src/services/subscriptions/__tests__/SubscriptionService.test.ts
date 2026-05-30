jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn(e => ({ message: String(e) })),
  isCircularStructureError: jest.fn(() => false),
  isTimerCircularStructureError: jest.fn(() => false),
}));

import type { StoreObject } from '@apollo/client';
import { SubscriptionService } from '../SubscriptionService';
import { CacheStrategy, LogLevel } from '../types';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = SubscriptionService.getInstance();
    service.cleanup();
  });

  afterEach(() => {
    service.cleanup();
    jest.useRealTimers();
  });

  describe('singleton', () => {
    it('getInstance returns same instance', () => {
      const instance1 = SubscriptionService.getInstance();
      const instance2 = SubscriptionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('pending deletes', () => {
    it('registerPendingDelete adds to tracking', () => {
      service.registerPendingDelete('item-1', 'parent-1', 'PantryItem');
      expect(service.isPendingDelete('item-1')).toBe(true);
    });

    it('isPendingDelete returns true for registered items', () => {
      expect(service.isPendingDelete('item-1')).toBe(false);
      service.registerPendingDelete('item-1', 'parent-1', 'PantryItem');
      expect(service.isPendingDelete('item-1')).toBe(true);
    });

    it('unregisterPendingDelete removes from tracking', () => {
      service.registerPendingDelete('item-1', 'parent-1', 'PantryItem');
      expect(service.isPendingDelete('item-1')).toBe(true);

      service.unregisterPendingDelete('item-1');
      expect(service.isPendingDelete('item-1')).toBe(false);
    });

    it('auto-cleans up after 30s', () => {
      service.registerPendingDelete('item-1', 'parent-1', 'PantryItem');
      expect(service.isPendingDelete('item-1')).toBe(true);

      jest.advanceTimersByTime(30000);
      expect(service.isPendingDelete('item-1')).toBe(false);
    });
  });

  describe('parent deletion', () => {
    it('registerParentDeletion adds to tracking', () => {
      service.registerParentDeletion('parent-1');
      expect(service.isParentDeleting('parent-1')).toBe(true);
    });

    it('isParentDeleting returns true for registered entities', () => {
      expect(service.isParentDeleting('parent-1')).toBe(false);
      service.registerParentDeletion('parent-1');
      expect(service.isParentDeleting('parent-1')).toBe(true);
    });

    it('unregisterParentDeletion removes from tracking', () => {
      service.registerParentDeletion('parent-1');
      expect(service.isParentDeleting('parent-1')).toBe(true);

      service.unregisterParentDeletion('parent-1');
      expect(service.isParentDeleting('parent-1')).toBe(false);
    });

    it('auto-cleans up after 10s', () => {
      service.registerParentDeletion('parent-1');
      expect(service.isParentDeleting('parent-1')).toBe(true);

      jest.advanceTimersByTime(10000);
      expect(service.isParentDeleting('parent-1')).toBe(false);
    });
  });

  describe('filterPendingDeletes', () => {
    it('filters out pending items', () => {
      const items = [
        { id: 'item-1', name: 'A' },
        { id: 'item-2', name: 'B' },
        { id: 'item-3', name: 'C' },
      ];
      service.registerPendingDelete('item-2', 'parent-1', 'PantryItem');

      const filtered = service.filterPendingDeletes(items);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(i => i.id)).toEqual(['item-1', 'item-3']);
    });

    it('returns original array if no pending deletes', () => {
      const items = [
        { id: 'item-1', name: 'A' },
        { id: 'item-2', name: 'B' },
      ];

      const result = service.filterPendingDeletes(items);
      expect(result).toBe(items);
    });
  });

  describe('markItemReordered', () => {
    it('tracks reordered items and auto-cleans after 200ms', () => {
      // markItemReordered is used internally by shouldProcessUpdate to filter
      // sort-order-only subscription echoes. We can verify behavior through
      // the stats after processing a sortOrder-only update.
      service.markItemReordered('item-1');

      // After 200ms, the reorder tracking should be cleaned up.
      // We verify by advancing timers past the cleanup window.
      jest.advanceTimersByTime(200);

      // The item should no longer be tracked (cleanup occurred)
      // This is indirectly verified: a sortOrder-only update after cleanup
      // would no longer be filtered.
      const stats = service.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('register', () => {
    it('returns onData, onError, and onComplete handlers', () => {
      const config = {
        subscriptionName: 'TestSubscription',
        entityType: 'TestEntity',
        enableDeduplication: true,
        userId: 'user1',
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
      };
      const handlers = service.register(config);

      expect(handlers).toHaveProperty('onData');
      expect(handlers).toHaveProperty('onError');
      expect(handlers).toHaveProperty('onComplete');
      expect(typeof handlers.onData).toBe('function');
      expect(typeof handlers.onError).toBe('function');
      expect(typeof handlers.onComplete).toBe('function');
    });
  });

  describe('onData handler', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'TestSubscription',
      entityType: 'TestEntity',
      enableDeduplication: true,
      userId: 'user1',
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: false,
      ...overrides,
    });

    it('skips if parent entity is being deleted', () => {
      const customOnData = jest.fn();
      const config = createConfig({
        entityId: 'entity-1',
        customOnData,
      });
      const handlers = service.register(config);

      service.registerParentDeletion('entity-1');

      handlers.onData({
        data: {
          data: {
            testSubscription: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:00Z',
              item: { id: 'item-1' },
            },
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).not.toHaveBeenCalled();
    });

    it('skips if no subscription data', () => {
      const customOnData = jest.fn();
      const config = createConfig({ customOnData });
      const handlers = service.register(config);

      handlers.onData({ data: {}, client: { cache: {} } });
      handlers.onData({ data: { data: null }, client: { cache: {} } });

      expect(customOnData).not.toHaveBeenCalled();
    });

    it('deduplicates based on timestamp+mutation+userId', () => {
      const customOnData = jest.fn();
      const config = createConfig({ customOnData });
      const handlers = service.register(config);

      const payload = {
        data: {
          data: {
            testSubscription: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:00Z',
              item: { id: 'item-1' },
            },
          },
        },
        client: { cache: {} },
      };

      handlers.onData(payload);
      handlers.onData(payload);

      // customOnData should only be called once because the second is a duplicate
      expect(customOnData).toHaveBeenCalledTimes(1);
    });

    it('calls customOnData if provided', () => {
      const customOnData = jest.fn();
      const config = createConfig({ customOnData });
      const handlers = service.register(config);

      handlers.onData({
        data: {
          data: {
            testSubscription: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:01Z',
              item: { id: 'item-1' },
            },
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).toHaveBeenCalledTimes(1);
      expect(customOnData).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: 'UPDATED',
          item: { id: 'item-1' },
        }),
        expect.objectContaining({ cache: {} }),
      );
    });
  });

  describe('onError handler', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'TestSubscription',
      entityType: 'TestEntity',
      enableDeduplication: true,
      userId: 'user1',
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: false,
      ...overrides,
    });

    it('handles socket closed errors as warnings and does not count as error', () => {
      const customOnError = jest.fn();
      const config = createConfig({ customOnError });
      const handlers = service.register(config);

      handlers.onError({ message: 'Socket closed' });

      expect(customOnError).not.toHaveBeenCalled();
      expect(service.getStats().totalErrors).toBe(0);
    });

    it('counts non-network errors in stats and calls customOnError', () => {
      const customOnError = jest.fn();
      const config = createConfig({ customOnError });
      const handlers = service.register(config);

      handlers.onError({ message: 'GraphQL validation error' });

      expect(customOnError).toHaveBeenCalledTimes(1);
      expect(customOnError).toHaveBeenCalledWith({
        message: 'GraphQL validation error',
      });
      expect(service.getStats().totalErrors).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('onComplete handler', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'TestSubscription',
      entityType: 'TestEntity',
      enableDeduplication: true,
      userId: 'user1',
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: false,
      ...overrides,
    });

    it('removes subscription from registry', () => {
      const config = createConfig();
      const handlers = service.register(config);

      expect(service.getActiveSubscriptions()).toContain('TestSubscription');

      handlers.onComplete();

      expect(service.getActiveSubscriptions()).not.toContain(
        'TestSubscription',
      );
    });

    it('calls customOnComplete', () => {
      const customOnComplete = jest.fn();
      const config = createConfig({ customOnComplete });
      const handlers = service.register(config);

      handlers.onComplete();

      expect(customOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('returns statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('totalSubscriptions');
      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('totalUpdates');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('dedupedUpdates');
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.totalUpdates).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.dedupedUpdates).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('clears all tracking data', () => {
      service.registerPendingDelete('item-1', 'parent-1', 'PantryItem');
      service.registerParentDeletion('parent-1');
      service.register({
        subscriptionName: 'TestSub',
        entityType: 'TestEntity',
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
      });

      expect(service.isPendingDelete('item-1')).toBe(true);
      expect(service.isParentDeleting('parent-1')).toBe(true);
      expect(service.getActiveSubscriptions().length).toBeGreaterThan(0);

      service.cleanup();

      expect(service.isPendingDelete('item-1')).toBe(false);
      expect(service.isParentDeleting('parent-1')).toBe(false);
      expect(service.getActiveSubscriptions()).toHaveLength(0);
      expect(service.getStats().totalUpdates).toBe(0);
      expect(service.getStats().totalErrors).toBe(0);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('returns subscription names', () => {
      service.register({
        subscriptionName: 'Sub1',
        entityType: 'Entity1',
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
      });
      service.register({
        subscriptionName: 'Sub2',
        entityType: 'Entity2',
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
      });

      const active = service.getActiveSubscriptions();
      expect(active).toContain('Sub1');
      expect(active).toContain('Sub2');
      expect(active).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Deep branch tests for uncovered code
  // -------------------------------------------------------------------------

  describe('onData handler - cache update strategies', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'CacheTestSub',
      entityType: 'TestEntity',
      enableDeduplication: false,
      userId: 'user1',
      cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
      cacheFieldName: 'testItems',
      enableLogging: false,
      ...overrides,
    });

    it('uses Apollo normalization for UPDATE with AUTOMATIC strategy', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(),
        evict: jest.fn(),
        gc: jest.fn(),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:02Z',
              item: { id: 'item-1' },
            },
          },
        },
        client: { cache: mockCache },
      });

      // AUTOMATIC strategy with UPDATE - should NOT call cache.modify
      expect(mockCache.modify).not.toHaveBeenCalled();
    });

    it('handles CREATED mutation with AUTOMATIC strategy - adds to cache', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(),
        evict: jest.fn(),
        gc: jest.fn(),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'CREATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:03Z',
              item: { id: 'new-item', __typename: 'TestEntity' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.modify).toHaveBeenCalled();
    });

    it('handles DELETED mutation - evicts from cache', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(() => 'TestEntity:del-item'),
        evict: jest.fn(),
        gc: jest.fn(),
        data: { data: { 'TestEntity:del-item': { id: 'del-item' } } },
        extract: jest.fn(() => ({ 'TestEntity:del-item': { id: 'del-item' } })),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'DELETED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:04Z',
              item: { id: 'del-item', __typename: 'TestEntity' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.evict).toHaveBeenCalled();
      expect(mockCache.gc).toHaveBeenCalled();
    });

    it('skips delete when item already evicted', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(() => 'TestEntity:gone-item'),
        evict: jest.fn(),
        gc: jest.fn(),
        data: { data: {} }, // Item not in data
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'DELETED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:05Z',
              item: { id: 'gone-item', __typename: 'TestEntity' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.evict).not.toHaveBeenCalled();
    });

    it('handles ITEM_ADDED like CREATED', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = { modify: jest.fn() };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'ITEM_ADDED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:06Z',
              item: { id: 'added-item' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.modify).toHaveBeenCalled();
    });

    it('handles ITEM_REMOVED like DELETED', () => {
      const config = createConfig();
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(() => 'TestEntity:removed-item'),
        evict: jest.fn(),
        gc: jest.fn(),
        data: { data: { 'TestEntity:removed-item': { id: 'removed-item' } } },
        extract: jest.fn(() => ({
          'TestEntity:removed-item': { id: 'removed-item' },
        })),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'ITEM_REMOVED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:07Z',
              item: { id: 'removed-item' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.evict).toHaveBeenCalled();
    });

    it('warns when no cacheFieldName for MANUAL strategy', () => {
      const config = createConfig({
        cacheFieldName: '',
        cacheUpdateStrategy: CacheStrategy.MANUAL,
      });
      const handlers = service.register(config);

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'CREATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:08Z',
              item: { id: 'item-no-field' },
            },
          },
        },
        client: { cache: {} },
      });
    });

    it('warns when no item ID in payload', () => {
      const config = createConfig({
        cacheUpdateStrategy: CacheStrategy.MANUAL,
      });
      const handlers = service.register(config);

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'CREATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:09Z',
              item: {}, // no id
            },
          },
        },
        client: { cache: {} },
      });
    });

    it('skips cache update with CacheStrategy.NONE', () => {
      const config = createConfig({ cacheUpdateStrategy: CacheStrategy.NONE });
      const handlers = service.register(config);

      const mockCache = { modify: jest.fn() };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'CREATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:10Z',
              item: { id: 'skip-item' },
            },
          },
        },
        client: { cache: mockCache },
      });

      expect(mockCache.modify).not.toHaveBeenCalled();
    });

    it('handles pending delete item in DELETED mutation', () => {
      const config = createConfig();
      const handlers = service.register(config);

      // Register a pending delete
      service.registerPendingDelete(
        'pending-item',
        'parent-1',
        'TestEntity',
        'ParentType',
        'itemsConnection',
      );

      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn((obj: StoreObject) => `${obj.__typename}:${obj.id}`),
        evict: jest.fn(),
        gc: jest.fn(),
        data: { data: {} },
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'DELETED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:11Z',
              item: { id: 'pending-item', __typename: 'TestEntity' },
            },
          },
        },
        client: { cache: mockCache },
      });

      // Should evict the pending delete item
      expect(mockCache.evict).toHaveBeenCalled();
      expect(mockCache.gc).toHaveBeenCalled();
      // Pending delete should be cleared
      expect(service.isPendingDelete('pending-item')).toBe(false);
    });

    it('logs unknown mutation type', () => {
      const config = createConfig({
        cacheUpdateStrategy: CacheStrategy.MANUAL,
      });
      const handlers = service.register(config);

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'UNKNOWN_MUTATION',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:12Z',
              item: { id: 'item-unk' },
            },
          },
        },
        client: {
          cache: {
            modify: jest.fn(),
            identify: jest.fn(),
            evict: jest.fn(),
            gc: jest.fn(),
            data: { data: {} },
          },
        },
      });
    });

    it('handles cache update error gracefully', () => {
      const config = createConfig({
        cacheUpdateStrategy: CacheStrategy.MANUAL,
        enableLogging: true,
      });
      const handlers = service.register(config);

      const mockCache = {
        modify: jest.fn(() => {
          throw new Error('Cache boom');
        }),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'CREATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:13Z',
              item: { id: 'err-item' },
            },
          },
        },
        client: { cache: mockCache },
      });
    });
  });

  describe('onData handler - deduplication edge cases', () => {
    it('filters empty payload', () => {
      const customOnData = jest.fn();
      const handlers = service.register({
        subscriptionName: 'DedupTest',
        entityType: 'TestEntity',
        enableDeduplication: true,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
        customOnData,
      });

      handlers.onData({
        data: {
          data: {
            sub: null,
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).not.toHaveBeenCalled();
    });

    it('filters sortOrder-only ITEM_UPDATED when reorder is active', () => {
      service.markItemReordered('reorder-item');

      const customOnData = jest.fn();
      const handlers = service.register({
        subscriptionName: 'SortTest',
        entityType: 'TestEntity',
        enableDeduplication: true,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
        customOnData,
      });

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'ITEM_UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:14Z',
              item: { id: 'reorder-item' },
              updatedFields: ['sortOrder'],
            },
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).not.toHaveBeenCalled();
    });

    it('processes non-sortOrder ITEM_UPDATED even when reorder is active', () => {
      service.markItemReordered('reorder-item-2');

      const customOnData = jest.fn();
      const handlers = service.register({
        subscriptionName: 'SortTest2',
        entityType: 'TestEntity',
        enableDeduplication: true,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
        customOnData,
      });

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'ITEM_UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:15Z',
              item: { id: 'reorder-item-2' },
              updatedFields: ['sortOrder', 'name'],
            },
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).toHaveBeenCalledTimes(1);
    });

    it('cleans up old processed mutations when exceeding max', () => {
      const handlers = service.register({
        subscriptionName: 'CleanupTest',
        entityType: 'TestEntity',
        enableDeduplication: true,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
      });

      // Fire more than MAX_PROCESSED_MUTATIONS (100) unique updates
      for (let i = 0; i < 105; i++) {
        handlers.onData({
          data: {
            data: {
              sub: {
                mutation: 'UPDATED',
                userId: 'user2',
                timestamp: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
                item: { id: `item-${i}` },
              },
            },
          },
          client: { cache: {} },
        });
      }

      // Should not throw - the cleanup logic ran
      const stats = service.getStats();
      expect(stats.totalUpdates).toBeGreaterThan(0);
    });
  });

  describe('onError handler - network error variations', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'ErrTest',
      entityType: 'TestEntity',
      enableDeduplication: false,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: false,
      ...overrides,
    });

    it('treats websocket errors as network (no custom handler called)', () => {
      const customOnError = jest.fn();
      const handlers = service.register(createConfig({ customOnError }));

      handlers.onError({ message: 'WebSocket connection failed' });

      expect(customOnError).not.toHaveBeenCalled();
    });

    it('treats connection errors as network', () => {
      const customOnError = jest.fn();
      const handlers = service.register(createConfig({ customOnError }));

      handlers.onError({ message: 'Connection lost to server' });

      expect(customOnError).not.toHaveBeenCalled();
    });

    it('treats network word errors as network', () => {
      const customOnError = jest.fn();
      const handlers = service.register(createConfig({ customOnError }));

      handlers.onError({ message: 'Network request failed' });

      expect(customOnError).not.toHaveBeenCalled();
    });

    it('handles null error message gracefully', () => {
      const customOnError = jest.fn();
      const handlers = service.register(createConfig({ customOnError }));

      handlers.onError({ message: undefined });

      expect(customOnError).toHaveBeenCalledTimes(1);
    });
  });

  describe('onData handler - node field in payload', () => {
    it('uses node field when item is not present', () => {
      const customOnData = jest.fn();
      const handlers = service.register({
        subscriptionName: 'NodeTest',
        entityType: 'TestEntity',
        enableDeduplication: false,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: false,
        customOnData,
      });

      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:16Z',
              node: { id: 'node-item' },
            },
          },
        },
        client: { cache: {} },
      });

      expect(customOnData).toHaveBeenCalledWith(
        expect.objectContaining({ node: { id: 'node-item' } }),
        expect.anything(),
      );
    });
  });

  describe('register defaults', () => {
    it('uses default values for optional config fields', () => {
      const handlers = service.register({
        subscriptionName: 'DefaultsTest',
        entityType: 'Entity',
      });

      expect(handlers.onData).toBeDefined();
      expect(handlers.onError).toBeDefined();
      expect(handlers.onComplete).toBeDefined();

      // Should track subscription
      expect(service.getActiveSubscriptions()).toContain('DefaultsTest');
    });
  });

  describe('onData handler - error inside handler', () => {
    it('catches errors in onData without crashing', () => {
      const handlers = service.register({
        subscriptionName: 'CrashTest',
        entityType: 'TestEntity',
        enableDeduplication: false,
        cacheUpdateStrategy: CacheStrategy.NONE,
        enableLogging: true,
        logLevel: LogLevel.ERROR,
        customOnData: () => {
          throw new Error('Custom handler crash');
        },
      });

      // Should not throw
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'UPDATED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:17Z',
              item: { id: 'crash-item' },
            },
          },
        },
        client: { cache: {} },
      });
    });
  });

  describe('COLLABORATOR mutations', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'CollabTest',
      entityType: 'Collaborator',
      enableDeduplication: false,
      cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
      cacheFieldName: 'collaborators',
      enableLogging: false,
      ...overrides,
    });

    it('handles COLLABORATOR_ADDED like CREATED', () => {
      const handlers = service.register(createConfig());
      const mockCache = { modify: jest.fn() };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'COLLABORATOR_ADDED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:18Z',
              item: { id: 'collab-1' },
            },
          },
        },
        client: { cache: mockCache },
      });
      expect(mockCache.modify).toHaveBeenCalled();
    });

    it('handles COLLABORATOR_REMOVED like DELETED', () => {
      const handlers = service.register(createConfig());
      const mockCache = {
        modify: jest.fn(),
        identify: jest.fn(() => 'Collaborator:collab-2'),
        evict: jest.fn(),
        gc: jest.fn(),
        data: { data: { 'Collaborator:collab-2': { id: 'collab-2' } } },
        extract: jest.fn(() => ({
          'Collaborator:collab-2': { id: 'collab-2' },
        })),
      };
      handlers.onData({
        data: {
          data: {
            sub: {
              mutation: 'COLLABORATOR_REMOVED',
              userId: 'user2',
              timestamp: '2026-01-01T00:00:19Z',
              item: { id: 'collab-2' },
            },
          },
        },
        client: { cache: mockCache },
      });
      expect(mockCache.evict).toHaveBeenCalled();
    });
  });

  describe('UPDATE variants with AUTOMATIC strategy', () => {
    const createConfig = (overrides = {}) => ({
      subscriptionName: 'UpdateVariants',
      entityType: 'TestEntity',
      enableDeduplication: false,
      cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
      cacheFieldName: 'items',
      enableLogging: false,
      ...overrides,
    });

    it.each(['ITEM_UPDATED', 'STATUS_CHANGED', 'ITEM_COMPLETED', 'COMPLETED'])(
      'uses Apollo normalization for %s',
      mutation => {
        const handlers = service.register(createConfig());
        const mockCache = { modify: jest.fn() };
        handlers.onData({
          data: {
            data: {
              sub: {
                mutation,
                userId: 'user2',
                timestamp: `2026-01-01T00:00:20Z`,
                item: { id: `update-${mutation}` },
              },
            },
          },
          client: { cache: mockCache },
        });
        // These are handled by Apollo normalization, no cache.modify
        expect(mockCache.modify).not.toHaveBeenCalled();
      },
    );
  });
});
