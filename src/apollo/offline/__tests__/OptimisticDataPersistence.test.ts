'use no memo';

import { storage } from '#storage/mmkv';
import { optimisticDataPersistence } from '../OptimisticDataPersistence';

const DATA_KEY = 'apollo-optimistic-data-v1';

/**
 * Helper to seed data through the singleton's own save method.
 * This avoids any issues with the in-memory cache being out of sync
 * with storage when we write directly via storage.set().
 */
function seedData(
  entries: Array<{
    entityType: string;
    entityId: string;
    field: string;
    value: string | number;
  }>,
) {
  for (const entry of entries) {
    optimisticDataPersistence.save(
      entry.entityType,
      entry.entityId,
      entry.field,
      entry.value,
    );
  }
  // Drain the batched microtask synchronously
  optimisticDataPersistence.flush();
}

describe('OptimisticDataPersistence', () => {
  beforeEach(() => {
    // Clear underlying MMKV store and reset singleton state
    storage.clearAll();
    optimisticDataPersistence.clearAll();
  });

  describe('save (batched)', () => {
    it('does not write to storage immediately', () => {
      optimisticDataPersistence.save(
        'ShoppingListItem',
        '123',
        'sortOrder',
        'a5',
      );
      expect(storage.getString(DATA_KEY)).toBeUndefined();
    });

    it('flushes to storage on the next microtask', async () => {
      optimisticDataPersistence.save(
        'ShoppingListItem',
        '123',
        'sortOrder',
        'a5',
      );
      await Promise.resolve();

      const stored = JSON.parse(storage.getString(DATA_KEY)!);
      expect(stored['ShoppingListItem:123:sortOrder']).toMatchObject({
        entityType: 'ShoppingListItem',
        entityId: '123',
        field: 'sortOrder',
        value: 'a5',
      });
      expect(stored['ShoppingListItem:123:sortOrder'].timestamp).toEqual(
        expect.any(Number),
      );
    });

    it('batches multiple saves into a single storage write', async () => {
      // Track how many times storage.set is called for the data key
      let dataKeySetCount = 0;
      const originalSet = storage.set.bind(storage);
      const wrappedSet = jest.fn((...args: Parameters<typeof storage.set>) => {
        if (args[0] === DATA_KEY) dataKeySetCount++;
        return originalSet(...args);
      });
      storage.set = wrappedSet;

      optimisticDataPersistence.save(
        'ShoppingListItem',
        '1',
        'sortOrder',
        'a1',
      );
      optimisticDataPersistence.save(
        'ShoppingListItem',
        '2',
        'sortOrder',
        'a2',
      );
      optimisticDataPersistence.save('PantryItem', '3', 'quantity', 5);

      await Promise.resolve();

      // Only one set call for the data key
      expect(dataKeySetCount).toBe(1);

      const stored = JSON.parse(storage.getString(DATA_KEY)!);
      expect(Object.keys(stored)).toHaveLength(3);

      // Restore
      storage.set = originalSet;
    });

    it('merges with existing data in storage', async () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: 'old',
          field: 'field',
          value: 'existing',
        },
      ]);

      optimisticDataPersistence.save(
        'ShoppingListItem',
        'new',
        'sortOrder',
        'a1',
      );
      await Promise.resolve();

      const stored = JSON.parse(storage.getString(DATA_KEY)!);
      expect(stored['ShoppingListItem:old:field']).toBeDefined();
      expect(stored['ShoppingListItem:new:sortOrder']).toBeDefined();
    });

    it('overwrites existing field for same entity', async () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
      ]);

      optimisticDataPersistence.save(
        'ShoppingListItem',
        '1',
        'sortOrder',
        'b2',
      );
      await Promise.resolve();

      const stored = JSON.parse(storage.getString(DATA_KEY)!);
      expect(stored['ShoppingListItem:1:sortOrder'].value).toBe('b2');
    });
  });

  describe('get', () => {
    it('returns empty object when no data exists', () => {
      const result = optimisticDataPersistence.get('ShoppingListItem', '123');
      expect(result).toEqual({});
    });

    it('returns field updates for the specific entity', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '123',
          field: 'sortOrder',
          value: 'a5',
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '123',
          field: 'quantity',
          value: 2,
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '456',
          field: 'sortOrder',
          value: 'b1',
        },
      ]);

      const result = optimisticDataPersistence.get('ShoppingListItem', '123');
      expect(result).toEqual({ sortOrder: 'a5', quantity: 2 });
    });

    it('does not return updates for other entity types', () => {
      seedData([
        {
          entityType: 'PantryItem',
          entityId: '123',
          field: 'quantity',
          value: 10,
        },
      ]);

      const result = optimisticDataPersistence.get('ShoppingListItem', '123');
      expect(result).toEqual({});
    });
  });

  describe('getAllForType', () => {
    it('returns empty map when no data exists', () => {
      const result =
        optimisticDataPersistence.getAllForType('ShoppingListItem');
      expect(result.size).toBe(0);
    });

    it('groups updates by entity ID', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'quantity',
          value: 3,
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '2',
          field: 'sortOrder',
          value: 'b1',
        },
        {
          entityType: 'PantryItem',
          entityId: '3',
          field: 'quantity',
          value: 5,
        },
      ]);

      const result =
        optimisticDataPersistence.getAllForType('ShoppingListItem');
      expect(result.size).toBe(2);
      expect(result.get('1')).toEqual({ sortOrder: 'a1', quantity: 3 });
      expect(result.get('2')).toEqual({ sortOrder: 'b1' });
    });

    it('does not include other entity types', () => {
      seedData([
        {
          entityType: 'PantryItem',
          entityId: '1',
          field: 'quantity',
          value: 5,
        },
      ]);

      const result =
        optimisticDataPersistence.getAllForType('ShoppingListItem');
      expect(result.size).toBe(0);
    });
  });

  describe('clear (single field)', () => {
    it('removes a specific field from storage', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'quantity',
          value: 2,
        },
      ]);

      optimisticDataPersistence.clear('ShoppingListItem', '1', 'sortOrder');

      const saved = JSON.parse(storage.getString(DATA_KEY)!);
      expect(saved['ShoppingListItem:1:sortOrder']).toBeUndefined();
      expect(saved['ShoppingListItem:1:quantity']).toBeDefined();
    });

    it('removes entire storage key when last field is cleared', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
      ]);

      optimisticDataPersistence.clear('ShoppingListItem', '1', 'sortOrder');

      expect(storage.getString(DATA_KEY)).toBeUndefined();
    });

    it('is a no-op when key does not exist', () => {
      // Should not throw
      optimisticDataPersistence.clear(
        'ShoppingListItem',
        'nonexistent',
        'field',
      );
    });
  });

  describe('clearEntity', () => {
    it('removes all fields for a specific entity', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'quantity',
          value: 2,
        },
        {
          entityType: 'ShoppingListItem',
          entityId: '2',
          field: 'sortOrder',
          value: 'b1',
        },
      ]);

      optimisticDataPersistence.clearEntity('ShoppingListItem', '1');

      const saved = JSON.parse(storage.getString(DATA_KEY)!);
      expect(Object.keys(saved)).toHaveLength(1);
      expect(saved['ShoppingListItem:2:sortOrder']).toBeDefined();
    });

    it('removes storage key when all entities are cleared', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
      ]);

      optimisticDataPersistence.clearEntity('ShoppingListItem', '1');

      expect(storage.getString(DATA_KEY)).toBeUndefined();
    });
  });

  describe('clearType', () => {
    it('removes all fields for a specific entity type', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
        {
          entityType: 'PantryItem',
          entityId: '2',
          field: 'quantity',
          value: 5,
        },
      ]);

      optimisticDataPersistence.clearType('ShoppingListItem');

      const saved = JSON.parse(storage.getString(DATA_KEY)!);
      expect(Object.keys(saved)).toHaveLength(1);
      expect(saved['PantryItem:2:quantity']).toBeDefined();
    });

    it('removes storage key when all types are cleared', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
      ]);

      optimisticDataPersistence.clearType('ShoppingListItem');

      expect(storage.getString(DATA_KEY)).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('removes the entire optimistic data key from storage', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
      ]);

      optimisticDataPersistence.clearAll();

      expect(storage.getString(DATA_KEY)).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('returns zero stats when no data exists', () => {
      const stats = optimisticDataPersistence.getStats();
      expect(stats).toEqual({
        totalUpdates: 0,
        entityTypes: [],
        oldestTimestamp: null,
        newestTimestamp: null,
      });
    });

    it('returns correct stats for stored data', () => {
      seedData([
        {
          entityType: 'ShoppingListItem',
          entityId: '1',
          field: 'sortOrder',
          value: 'a1',
        },
        {
          entityType: 'PantryItem',
          entityId: '2',
          field: 'quantity',
          value: 5,
        },
      ]);

      const stats = optimisticDataPersistence.getStats();
      expect(stats.totalUpdates).toBe(2);
      expect(stats.entityTypes).toEqual(
        expect.arrayContaining(['ShoppingListItem', 'PantryItem']),
      );
      expect(stats.oldestTimestamp).toEqual(expect.any(Number));
      expect(stats.newestTimestamp).toEqual(expect.any(Number));
    });
  });
});
