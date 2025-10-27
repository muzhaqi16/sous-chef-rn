import { storage } from '#storage/mmkv';

const OPTIMISTIC_DATA_KEY = 'apollo-optimistic-data-v1';

interface OptimisticFieldUpdate {
  entityType: string; // 'ShoppingListItem', 'ShoppingList', 'PantryItem', etc.
  entityId: string;
  field: string;
  value: any;
  timestamp: number;
}

/**
 * Generic optimistic data persistence layer
 *
 * Stores ANY field for ANY entity type that should survive app restarts.
 * This is a reusable foundation for offline-first features across the entire app.
 *
 * Use cases:
 * - Shopping list sortOrder
 * - Pantry item quantities
 * - Recipe ratings
 * - Any field that should persist during offline operations
 *
 * @example
 * ```typescript
 * // Save
 * optimisticDataPersistence.save('ShoppingListItem', itemId, 'sortOrder', 'a5');
 * optimisticDataPersistence.save('PantryItem', itemId, 'quantity', 3);
 *
 * // Restore
 * const updates = optimisticDataPersistence.get('ShoppingListItem', itemId);
 * // { sortOrder: 'a5' }
 *
 * // Clear after sync
 * optimisticDataPersistence.clear('ShoppingListItem', itemId, 'sortOrder');
 * ```
 */
class OptimisticDataPersistence {
  /**
   * Save an optimistic field update
   *
   * @param entityType - Type of entity (e.g., 'ShoppingListItem', 'ShoppingList')
   * @param entityId - ID of the entity
   * @param field - Field name (e.g., 'sortOrder', 'quantity', 'name')
   * @param value - The optimistic value to persist
   */
  save(entityType: string, entityId: string, field: string, value: any): void {
    try {
      const existing = this.loadAll();
      const key = `${entityType}:${entityId}:${field}`;

      existing[key] = {
        entityType,
        entityId,
        field,
        value,
        timestamp: Date.now(),
      };

      storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(existing));
      console.log(`💾 Optimistic: Saved ${entityType}.${field} for ${entityId}`, { value });
    } catch (error) {
      console.error('Failed to save optimistic data:', error);
    }
  }

  /**
   * Get all optimistic updates for a specific entity instance
   *
   * @param entityType - Type of entity
   * @param entityId - ID of the entity
   * @returns Object with field names as keys and optimistic values
   *
   * @example
   * ```typescript
   * const updates = optimisticDataPersistence.get('ShoppingListItem', '123');
   * // { sortOrder: 'a5', quantity: 2 }
   * ```
   */
  get(entityType: string, entityId: string): Record<string, any> {
    const all = this.loadAll();
    const updates: Record<string, any> = {};

    Object.entries(all).forEach(([_key, data]) => {
      if (data.entityType === entityType && data.entityId === entityId) {
        updates[data.field] = data.value;
      }
    });

    return updates;
  }

  /**
   * Get all optimistic updates for an entity type
   * Groups updates by entity ID
   *
   * @param entityType - Type of entity
   * @returns Map of entity ID to field updates
   *
   * @example
   * ```typescript
   * const allUpdates = optimisticDataPersistence.getAllForType('ShoppingListItem');
   * // Map {
   * //   '123' => { sortOrder: 'a5' },
   * //   '456' => { sortOrder: 'b3', quantity: 2 }
   * // }
   * ```
   */
  getAllForType(entityType: string): Map<string, Record<string, any>> {
    const all = this.loadAll();
    const byEntity = new Map<string, Record<string, any>>();

    Object.entries(all).forEach(([_key, data]) => {
      if (data.entityType === entityType) {
        if (!byEntity.has(data.entityId)) {
          byEntity.set(data.entityId, {});
        }
        byEntity.get(data.entityId)![data.field] = data.value;
      }
    });

    return byEntity;
  }

  /**
   * Clear optimistic data for a specific field
   * Called after successful mutation sync
   *
   * @param entityType - Type of entity
   * @param entityId - ID of the entity
   * @param field - Field name to clear
   */
  clear(entityType: string, entityId: string, field: string): void {
    try {
      const existing = this.loadAll();
      const key = `${entityType}:${entityId}:${field}`;
      const hadData = key in existing;

      delete existing[key];

      if (Object.keys(existing).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
        console.log('🧹 Optimistic: Cleared all data (storage empty)');
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(existing));
        if (hadData) {
          console.log(`🧹 Optimistic: Cleared ${entityType}.${field} for ${entityId}`);
        }
      }
    } catch (error) {
      console.error('Failed to clear optimistic data:', error);
    }
  }

  /**
   * Clear all optimistic data for a specific entity instance
   * Useful when an entity is deleted or fully synced
   *
   * @param entityType - Type of entity
   * @param entityId - ID of the entity
   */
  clearEntity(entityType: string, entityId: string): void {
    try {
      const all = this.loadAll();
      const filtered = Object.entries(all).reduce((acc, [key, data]) => {
        if (!(data.entityType === entityType && data.entityId === entityId)) {
          acc[key] = data;
        }
        return acc;
      }, {} as Record<string, OptimisticFieldUpdate>);

      const clearedCount = Object.keys(all).length - Object.keys(filtered).length;

      if (Object.keys(filtered).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(filtered));
      }

      if (clearedCount > 0) {
        console.log(`🧹 Optimistic: Cleared ${clearedCount} fields for ${entityType}:${entityId}`);
      }
    } catch (error) {
      console.error('Failed to clear entity optimistic data:', error);
    }
  }

  /**
   * Clear all optimistic data for an entity type
   * Useful when signing out or clearing cache
   *
   * @param entityType - Type of entity
   */
  clearType(entityType: string): void {
    try {
      const all = this.loadAll();
      const filtered = Object.entries(all).reduce((acc, [key, data]) => {
        if (data.entityType !== entityType) {
          acc[key] = data;
        }
        return acc;
      }, {} as Record<string, OptimisticFieldUpdate>);

      const clearedCount = Object.keys(all).length - Object.keys(filtered).length;

      if (Object.keys(filtered).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(filtered));
      }

      if (clearedCount > 0) {
        console.log(`🧹 Optimistic: Cleared ${clearedCount} fields for ${entityType}`);
      }
    } catch (error) {
      console.error('Failed to clear type optimistic data:', error);
    }
  }

  /**
   * Clear all optimistic data (called on logout or cache reset)
   */
  clearAll(): void {
    try {
      storage.remove(OPTIMISTIC_DATA_KEY);
      console.log('🧹 Optimistic: Cleared all persisted data');
    } catch (error) {
      console.error('Failed to clear all optimistic data:', error);
    }
  }

  /**
   * Get statistics about stored optimistic data
   * Useful for debugging and monitoring
   */
  getStats(): {
    totalUpdates: number;
    entityTypes: string[];
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    const all = this.loadAll();
    const entries = Object.values(all);

    const entityTypes = Array.from(
      new Set(entries.map(e => e.entityType))
    );

    const timestamps = entries.map(e => e.timestamp);

    return {
      totalUpdates: entries.length,
      entityTypes,
      oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Load all persisted optimistic data from storage
   * @private
   */
  private loadAll(): Record<string, OptimisticFieldUpdate> {
    try {
      const data = storage.getString(OPTIMISTIC_DATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load optimistic data:', error);
      return {};
    }
  }
}

/**
 * Singleton instance for global access
 */
export const optimisticDataPersistence = new OptimisticDataPersistence();
