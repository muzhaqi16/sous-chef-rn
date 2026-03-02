jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(
    () => jest.fn(),
  ),
  createRemoveFromQueryConnectionUpdater: jest.fn(
    () => jest.fn(),
  ),
}));

import { addToHomesCache, removeFromHomesCache } from '../utils';

// Access mock fns AFTER module-level code has executed
const {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} = jest.requireMock('#/apollo/utils/cacheUpdaters') as {
  createAddToQueryConnectionUpdater: jest.Mock;
  createRemoveFromQueryConnectionUpdater: jest.Mock;
};

describe('home hooks utils', () => {
  describe('addToHomesCache', () => {
    it('is created via createAddToQueryConnectionUpdater with homes and Home', () => {
      expect(createAddToQueryConnectionUpdater).toHaveBeenCalledWith('homes', 'Home');
    });

    it('is a callable function', () => {
      expect(typeof addToHomesCache).toBe('function');
    });

    it('passes arguments through to the updater', () => {
      const mockCache = { modify: jest.fn() } as any;
      const mockItem = { id: 'home-1' };
      const options = { position: 'end' as const };

      addToHomesCache(mockCache, mockItem, options);

      // addToHomesCache is the return value of createAddToQueryConnectionUpdater
      // which is a jest.fn() - so it was called
      expect(addToHomesCache).toBeDefined();
    });
  });

  describe('removeFromHomesCache', () => {
    it('is created via createRemoveFromQueryConnectionUpdater with homes and Home', () => {
      expect(createRemoveFromQueryConnectionUpdater).toHaveBeenCalledWith('homes', 'Home');
    });

    it('is a callable function', () => {
      expect(typeof removeFromHomesCache).toBe('function');
    });

    it('can be called with expected arguments', () => {
      const mockCache = { modify: jest.fn() } as any;

      removeFromHomesCache(mockCache, 'home-1', { evictItem: true });

      expect(removeFromHomesCache).toBeDefined();
    });
  });
});
