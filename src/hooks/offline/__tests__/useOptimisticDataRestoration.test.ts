'use no memo';
import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { renderHook } from '@testing-library/react-native';
import type { Cache, InMemoryCache, StoreObject } from '@apollo/client';
import { useOptimisticDataRestorationMultiple } from '../useOptimisticDataRestoration';

// The client the code under test reads from the registry.
registerApolloClient({
  cache: {
    batch: (opts: Cache.BatchOptions<InMemoryCache>) => mockBatch(opts),
    identify: jest.fn((obj: StoreObject) => `${obj.__typename}:${obj.id}`),
    modify: jest.fn(),
    readFragment: jest.fn(() => null),
  },
} as unknown as ApolloClient);

const mockGetAllForType = jest.fn<
  Map<string, Record<string, unknown>>,
  [string]
>(() => new Map());
const mockBatch = jest.fn();

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    getAllForType: (entityType: string) => mockGetAllForType(entityType),
  },
}));
jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

// Mock startTransition to execute synchronously
jest
  .spyOn(require('react'), 'startTransition')
  .mockImplementation((...args: unknown[]) => {
    const fn = args[0];
    if (typeof fn === 'function') fn();
  });

describe('useOptimisticDataRestorationMultiple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('processes multiple entity types', () => {
    mockGetAllForType.mockReturnValue(new Map());
    renderHook(() =>
      useOptimisticDataRestorationMultiple(['ShoppingListItem', 'PantryItem']),
    );
    expect(mockBatch).toHaveBeenCalled();
  });
});
