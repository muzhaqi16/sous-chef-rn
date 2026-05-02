'use no memo';

// Mock tokenScheduler and refreshToken to break circular dependency chain
jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('../../../../apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

import { addToPantryItemsCache, removeFromPantryItemsCache } from '../utils';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
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
});
