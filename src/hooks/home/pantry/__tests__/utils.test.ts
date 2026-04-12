'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('../../../../apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  createBatchAddToConnectionUpdater: jest.fn(() => jest.fn()),
  incrementNestedCounter: jest.fn(),
}));

import {
  addToPantryItemsCache,
  removeFromPantryItemsCache,
  batchAddToPantryItemsCache,
} from '../utils';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  createBatchAddToConnectionUpdater,
  incrementNestedCounter,
} from '#/apollo/utils/cacheUpdaters';

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
    it('is created with correct factory arguments', () => {
      expect(createBatchAddToConnectionUpdater).toHaveBeenCalledWith(
        'Pantry',
        'itemsConnection',
        'PantryItem',
      );
    });

    it('delegates to the batch factory', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };
      const mockBatchFn = (createBatchAddToConnectionUpdater as jest.Mock).mock
        .results[0].value;

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [
        { id: 'item-1' },
      ]);

      expect(mockBatchFn).toHaveBeenCalledWith(mockCache, 'pantry-1', [
        { id: 'item-1' },
      ]);
    });

    it('calls incrementNestedCounter when updateStats is true', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };

      batchAddToPantryItemsCache(
        mockCache as any,
        'pantry-1',
        [{ id: 'item-1' }, { id: 'item-2' }],
        {
          updateStats: true,
        },
      );

      expect(incrementNestedCounter).toHaveBeenCalledWith(
        mockCache,
        'Pantry',
        'pantry-1',
        'stats',
        'totalItems',
        2,
      );
    });

    it('does not call incrementNestedCounter when updateStats is not set', () => {
      const mockCache = {
        identify: jest.fn(() => 'Pantry:pantry-1'),
        modify: jest.fn(),
      };
      (incrementNestedCounter as jest.Mock).mockClear();

      batchAddToPantryItemsCache(mockCache as any, 'pantry-1', [
        { id: 'item-1' },
      ]);

      expect(incrementNestedCounter).not.toHaveBeenCalled();
    });
  });
});
