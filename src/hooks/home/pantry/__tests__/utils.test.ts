'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('../../../../apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(
    () =>
      jest.fn(),
  ),
  createRemoveFromParentConnectionUpdater: jest.fn(
    () =>
      jest.fn(),
  ),
}));

import {
  addToPantryItemsCache,
  removeFromPantryItemsCache,
  batchAddToPantryItemsCache,
} from '../utils';
import { createAddToParentConnectionUpdater, createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

describe('pantry/utils', () => {
  describe('addToPantryItemsCache', () => {
    it('is created with correct arguments', () => {
      expect(createAddToParentConnectionUpdater).toHaveBeenCalledWith(
        'Pantry',
        'itemsConnection',
        'PantryItem',
      );
    });

    it('is a function', () => {
      expect(typeof addToPantryItemsCache).toBe('function');
    });
  });

  describe('removeFromPantryItemsCache', () => {
    it('is created with correct arguments', () => {
      expect(createRemoveFromParentConnectionUpdater).toHaveBeenCalledWith(
        'Pantry',
        'itemsConnection',
        'PantryItem',
      );
    });

    it('is a function', () => {
      expect(typeof removeFromPantryItemsCache).toBe('function');
    });
  });

  describe('batchAddToPantryItemsCache', () => {
    it('does nothing when parentCacheId is not found', () => {
      const mockCache = {
        identify: jest.fn(() => undefined),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [{ id: 'item-1' }]);

      expect(mockCache.modify).not.toHaveBeenCalled();
    });

    it('does nothing when newItems is empty', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', []);

      expect(mockCache.modify).not.toHaveBeenCalled();
    });

    it('calls cache.modify with correct id when items are present', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [{ id: 'item-1' }]);

      expect(mockCache.modify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'Pantry:pantry-1',
        }),
      );
    });

    it('itemsConnection field modifier adds new edges and updates totalCount', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [
        { id: 'item-1' },
        { id: 'item-2' },
      ]);

      const modifyCall = mockCache.modify.mock.calls[0][0];
      const itemsConnectionFn = modifyCall.fields.itemsConnection;

      const existingConnection = {
        edges: [],
        totalCount: 0,
      };

      const helpers = {
        readField: jest.fn((field: string, ref: any) => ref?.id),
        toReference: jest.fn((item: any) => ({ __ref: `PantryItem:${item.id}`, id: item.id })),
      };

      const result = itemsConnectionFn(existingConnection, helpers);

      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('itemsConnection field modifier skips duplicate items', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [{ id: 'item-1' }]);

      const modifyCall = mockCache.modify.mock.calls[0][0];
      const itemsConnectionFn = modifyCall.fields.itemsConnection;

      const existingEdge = { node: { __ref: 'PantryItem:item-1', id: 'item-1' } };
      const existingConnection = {
        edges: [existingEdge],
        totalCount: 1,
      };

      const helpers = {
        readField: jest.fn(() => 'item-1'),
        toReference: jest.fn((item: any) => ({ __ref: `PantryItem:${item.id}` })),
      };

      const result = itemsConnectionFn(existingConnection, helpers);

      // No new edges, returns existing connection unchanged
      expect(result).toBe(existingConnection);
    });

    it('includes stats updater when updateStats option is true', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [{ id: 'item-1' }], {
        updateStats: true,
      });

      const modifyCall = mockCache.modify.mock.calls[0][0];
      expect(modifyCall.fields.stats).toBeDefined();

      // Test the stats modifier function
      const statsFn = modifyCall.fields.stats;

      // Returns null for null input
      expect(statsFn(null)).toBeNull();

      // Returns ref unchanged
      const ref = { __ref: 'PantryStats:1' };
      expect(statsFn(ref)).toBe(ref);

      // Updates totalItems for plain objects
      const stats = { totalItems: 5 };
      expect(statsFn(stats)).toEqual({ totalItems: 6 });
    });

    it('does not include stats updater when updateStats is not set', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [{ id: 'item-1' }]);

      const modifyCall = mockCache.modify.mock.calls[0][0];
      expect(modifyCall.fields.stats).toBeUndefined();
    });
  });
});
