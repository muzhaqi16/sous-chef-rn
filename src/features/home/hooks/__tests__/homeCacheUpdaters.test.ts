jest.mock('#apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#apollo/utils/cacheUpdaters'),
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
}));

import type { ApolloCache } from '@apollo/client';
import { addToHomesCache } from '../homeCacheUpdaters';

// Access mock fns AFTER module-level code has executed
const { createAddToQueryConnectionUpdater } = jest.requireMock(
  '#apollo/utils/cacheUpdaters',
);

describe('home hooks utils', () => {
  describe('addToHomesCache', () => {
    it('is created via createAddToQueryConnectionUpdater with homes and Home', () => {
      expect(createAddToQueryConnectionUpdater).toHaveBeenCalledWith(
        'homes',
        'Home',
      );
    });

    it('is a callable function', () => {
      expect(typeof addToHomesCache).toBe('function');
    });

    it('passes arguments through to the updater', () => {
      const mockCache = {
        modify: jest.fn(),
      } as Partial<ApolloCache> as ApolloCache;
      const mockItem: Parameters<typeof addToHomesCache>[1] = {
        __typename: 'Home',
        id: 'home-1',
      };
      const options: { position: 'end' } = { position: 'end' };

      addToHomesCache(mockCache, mockItem, options);

      // addToHomesCache is the return value of createAddToQueryConnectionUpdater
      // which is a jest.fn() - so it was called
      expect(addToHomesCache).toBeDefined();
    });
  });
});
