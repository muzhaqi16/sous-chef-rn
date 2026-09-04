import { act } from '@testing-library/react-native';
import { StorageState } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { useHybridPantrySearch } from '../useHybridPantrySearch';

jest.mock('#/utils/searchUtils', () => ({
  pantryItemSearch: jest.fn(
    (item: { itemName?: string | null }, query: string) =>
      (item.itemName ?? '').toLowerCase().includes(query.toLowerCase()),
  ),
}));

jest.mock('#hooks/utils/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

jest.mock('#features/pantry/utils/hybridSort', () => ({
  shouldUseServerSort: (
    totalCount: number,
    pageSize: number,
    isOnline: boolean,
  ) => isOnline && totalCount > pageSize,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// Minimal fixtures — the hook only reads `id` and `itemName` (via the mocked
// pantryItemSearch); cast to the full PantryItem shape that the production
// hook prop expects.
const baseItems = [
  { id: 'i1', itemName: 'Milk' },
  { id: 'i2', itemName: 'Bread' },
] as unknown as Parameters<typeof useHybridPantrySearch>[0]['items'];

describe('useHybridPantrySearch', () => {
  describe('local search (small dataset)', () => {
    it('returns all items when no search query', () => {
      const { result } = renderHookWithApollo(() =>
        useHybridPantrySearch({
          pantryId: 'p1',
          locationQueryFilter: null,
          orderBy: undefined,
          items: baseItems,
          totalCount: 2,
          hasMore: false,
          loading: false,
          isOnline: true,
        }),
      );

      expect(result.current.activeItems).toEqual(baseItems);
      expect(result.current.useServerSort).toBe(false);
    });

    it('filters items locally via pantryItemSearch when below pageSize', () => {
      const { result } = renderHookWithApollo(() =>
        useHybridPantrySearch({
          pantryId: 'p1',
          locationQueryFilter: null,
          orderBy: undefined,
          items: baseItems,
          totalCount: 2,
          hasMore: false,
          loading: false,
          isOnline: true,
        }),
      );

      act(() => {
        result.current.setSearchQuery('Milk');
      });

      expect(result.current.activeItems).toEqual([
        { id: 'i1', itemName: 'Milk' },
      ]);
    });
  });

  describe('server search (large dataset)', () => {
    it('fires GetPantry with itemsFilter.search when totalCount > pageSize', async () => {
      const m = recordMock(GetPantryDocument, {
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            homeId: 'h1',
            name: 'Main',
            description: null,
            isDefault: true,
            version: 1,
            stats: {
              __typename: 'PantryStats',
              totalItems: 100,
              expiringCount: 0,
              lowStockCount: 0,
              storageStateCounts: {
                __typename: 'StorageStateCounts',
                refrigerated: 0,
                frozen: 0,
                ambient: 0,
              },
              storageLocationCounts: [],
            },
            itemsConnection: {
              __typename: 'PantryItemConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  cursor: 'c1',
                  node: {
                    __typename: 'PantryItem',
                    id: 'server-1',
                    itemName: 'Server Milk',
                    itemId: null,
                    quantity: 1,
                    updatedAt: '2026-01-01',
                    storageState: StorageState.Ambient,
                    expiresAt: null,
                    isLowStock: false,
                    lastUsedAt: null,
                    netWeight: null,
                    remainingNetWeight: null,
                    activeBatchCount: 0,
                    item: null,
                    unit: null,
                    netWeightUnit: null,
                    storageLocation: null,
                    packageBreakdown: null,
                    quantityBreakdown: null,
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 1,
            },
            storageLocationsConnection: {
              __typename: 'StorageLocationConnection',
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 0,
            },
          },
        },
      });

      const { result } = renderHookWithApollo(
        () =>
          useHybridPantrySearch({
            pantryId: 'p1',
            locationQueryFilter: { storageState: 'AMBIENT' },
            orderBy: { field: 'NAME', direction: 'ASC' },
            items: baseItems,
            totalCount: 1000,
            hasMore: true,
            loading: false,
            isOnline: true,
          }),
        { operationMocks: [m.mock] },
      );

      act(() => {
        result.current.setSearchQuery('Milk');
      });

      // Wait for the effect → client.query → recordMock to fire
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(m.fired).toContainEqual({
        id: 'p1',
        itemsFirst: expect.any(Number),
        itemsFilter: { storageState: 'AMBIENT', search: 'Milk' },
        itemsOrderBy: { field: 'NAME', direction: 'ASC' },
        storageLocationsFirst: 0,
      });
      expect(result.current.useServerSort).toBe(true);
    });

    it('skips the server query when pantryId is missing', async () => {
      const m = recordMock(GetPantryDocument, {
        data: { pantry: null },
      });

      const { result } = renderHookWithApollo(
        () =>
          useHybridPantrySearch({
            pantryId: null,
            locationQueryFilter: null,
            orderBy: undefined,
            items: baseItems,
            totalCount: 1000,
            hasMore: true,
            loading: false,
            isOnline: true,
          }),
        { operationMocks: [m.mock] },
      );

      act(() => {
        result.current.setSearchQuery('Anything');
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(m.fired).toEqual([]);
    });
  });

  describe('removeFromResults', () => {
    it('exposes a function to optimistically drop an item by id', () => {
      const { result } = renderHookWithApollo(() =>
        useHybridPantrySearch({
          pantryId: 'p1',
          locationQueryFilter: null,
          orderBy: undefined,
          items: baseItems,
          totalCount: 2,
          hasMore: false,
          loading: false,
          isOnline: true,
        }),
      );

      expect(typeof result.current.removeFromResults).toBe('function');
    });
  });
});
