'use no memo';

import { usePantryStats } from '../usePantryStats';
import { StorageState } from '#/graphql/generated/schemaTypes';

type PantryStatsItem = Parameters<
  typeof usePantryStats
>[0]['pantryItems'][number];

function makeStatsItem(overrides?: Partial<PantryStatsItem>): PantryStatsItem {
  return { storageState: StorageState.Ambient, ...overrides };
}

describe('usePantryStats', () => {
  describe('client-side fallback (no storageStateCounts)', () => {
    it('returns zero counts for empty array', () => {
      const { locationCounts } = usePantryStats({ pantryItems: [] });

      expect(locationCounts.all).toBe(0);
      expect(locationCounts.fridge).toBe(0);
      expect(locationCounts.freezer).toBe(0);
      expect(locationCounts.pantry).toBe(0);
    });

    it('returns zero counts for null input', () => {
      const { locationCounts } = usePantryStats({
        pantryItems: null as any,
      });

      expect(locationCounts.all).toBe(0);
      expect(locationCounts.fridge).toBe(0);
      expect(locationCounts.freezer).toBe(0);
      expect(locationCounts.pantry).toBe(0);
    });

    it('counts refrigerated items correctly', () => {
      const items = [
        { id: '1', storageState: StorageState.Refrigerated },
        { id: '2', storageState: StorageState.Refrigerated },
        { id: '3', storageState: StorageState.Ambient },
      ];

      const { locationCounts } = usePantryStats({ pantryItems: items });

      expect(locationCounts.fridge).toBe(2);
      expect(locationCounts.pantry).toBe(1);
      expect(locationCounts.all).toBe(3);
    });

    it('counts frozen items correctly', () => {
      const items = [
        { id: '1', storageState: StorageState.Frozen },
        { id: '2', storageState: StorageState.Frozen },
        { id: '3', storageState: StorageState.Frozen },
      ];

      const { locationCounts } = usePantryStats({ pantryItems: items });

      expect(locationCounts.freezer).toBe(3);
      expect(locationCounts.fridge).toBe(0);
      expect(locationCounts.pantry).toBe(0);
    });

    it('counts items with default/other storage states as pantry', () => {
      const items = [
        makeStatsItem({ storageState: StorageState.Ambient }),
        makeStatsItem({ storageState: StorageState.None }),
        makeStatsItem({ storageState: undefined }),
      ];

      const { locationCounts } = usePantryStats({ pantryItems: items });

      expect(locationCounts.pantry).toBe(3);
    });

    it('uses totalCount parameter for all count when provided', () => {
      const items = [
        { id: '1', storageState: StorageState.Refrigerated },
        { id: '2', storageState: StorageState.Frozen },
      ];

      const { locationCounts } = usePantryStats({
        pantryItems: items,
        totalCount: 100,
      });

      expect(locationCounts.all).toBe(100);
      expect(locationCounts.fridge).toBe(1);
      expect(locationCounts.freezer).toBe(1);
    });

    it('counts custom storage locations', () => {
      const items = [
        {
          id: '1',
          storageState: StorageState.Ambient,
          storageLocation: { id: 'loc-1' },
        },
        {
          id: '2',
          storageState: StorageState.Ambient,
          storageLocation: { id: 'loc-1' },
        },
        {
          id: '3',
          storageState: StorageState.Refrigerated,
          storageLocation: { id: 'loc-2' },
        },
        { id: '4', storageState: StorageState.Frozen },
      ];

      const { locationCounts } = usePantryStats({ pantryItems: items });

      expect(locationCounts['loc-1']).toBe(2);
      expect(locationCounts['loc-2']).toBe(1);
      expect(locationCounts.all).toBe(4);
    });

    it('handles mixed storage states in a single pass', () => {
      const items = [
        { id: '1', storageState: StorageState.Refrigerated },
        { id: '2', storageState: StorageState.Frozen },
        { id: '3', storageState: StorageState.Ambient },
        { id: '4', storageState: StorageState.Refrigerated },
        { id: '5', storageState: StorageState.None },
      ];

      const { locationCounts } = usePantryStats({ pantryItems: items });

      expect(locationCounts.fridge).toBe(2);
      expect(locationCounts.freezer).toBe(1);
      expect(locationCounts.pantry).toBe(2);
      expect(locationCounts.all).toBe(5);
    });
  });

  describe('server-side counts (storageStateCounts)', () => {
    it('uses server-side counts when storageStateCounts is provided', () => {
      const { locationCounts } = usePantryStats({
        pantryItems: [],
        totalCount: 50,
        storageStateCounts: {
          refrigerated: 20,
          frozen: 15,
          ambient: 15,
        },
      });

      expect(locationCounts.all).toBe(50);
      expect(locationCounts.fridge).toBe(20);
      expect(locationCounts.freezer).toBe(15);
      expect(locationCounts.pantry).toBe(15);
    });

    it('falls back to pantryItems.length for all when totalCount is not provided', () => {
      const items = [makeStatsItem(), makeStatsItem()];

      const { locationCounts } = usePantryStats({
        pantryItems: items,
        storageStateCounts: {
          refrigerated: 1,
          frozen: 0,
          ambient: 1,
        },
      });

      expect(locationCounts.all).toBe(2);
      expect(locationCounts.fridge).toBe(1);
      expect(locationCounts.freezer).toBe(0);
      expect(locationCounts.pantry).toBe(1);
    });

    it('ignores client-side item data when server counts are available', () => {
      // Even though all items are REFRIGERATED, server says otherwise
      const items = [
        { id: '1', storageState: StorageState.Refrigerated },
        { id: '2', storageState: StorageState.Refrigerated },
        { id: '3', storageState: StorageState.Refrigerated },
      ];

      const { locationCounts } = usePantryStats({
        pantryItems: items,
        totalCount: 100,
        storageStateCounts: {
          refrigerated: 40,
          frozen: 30,
          ambient: 30,
        },
      });

      expect(locationCounts.all).toBe(100);
      expect(locationCounts.fridge).toBe(40);
      expect(locationCounts.freezer).toBe(30);
      expect(locationCounts.pantry).toBe(30);
    });
  });

  describe('custom storage locations with storageLocationCounts', () => {
    it('uses storageLocationCounts when server counts are available', () => {
      const { locationCounts } = usePantryStats({
        pantryItems: [],
        totalCount: 30,
        storageStateCounts: {
          refrigerated: 10,
          frozen: 10,
          ambient: 10,
        },
        storageLocationCounts: [
          { storageLocationId: 'garage', itemCount: 5 },
          { storageLocationId: 'basement', itemCount: 3 },
        ],
      });

      expect(locationCounts.all).toBe(30);
      expect(locationCounts.fridge).toBe(10);
      expect(locationCounts.freezer).toBe(10);
      expect(locationCounts.pantry).toBe(10);
      expect(locationCounts.garage).toBe(5);
      expect(locationCounts.basement).toBe(3);
    });

    it('uses storageLocationCounts and omits locations not in the array', () => {
      const { locationCounts } = usePantryStats({
        pantryItems: [],
        totalCount: 20,
        storageStateCounts: {
          refrigerated: 10,
          frozen: 5,
          ambient: 5,
        },
        storageLocationCounts: [{ storageLocationId: 'garage', itemCount: 7 }],
      });

      expect(locationCounts.garage).toBe(7);
      expect(locationCounts.shed).toBeUndefined();
    });

    it('handles empty storageLocations array', () => {
      const { locationCounts } = usePantryStats({
        pantryItems: [],
        totalCount: 10,
        storageStateCounts: {
          refrigerated: 5,
          frozen: 3,
          ambient: 2,
        },
        storageLocationCounts: [],
      });

      expect(locationCounts.all).toBe(10);
      expect(locationCounts.fridge).toBe(5);
      expect(locationCounts.freezer).toBe(3);
      expect(locationCounts.pantry).toBe(2);
    });
  });
});
