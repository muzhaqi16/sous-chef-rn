import { storage } from '#storage/mmkv';
import { logger } from '#/utils/environment';
import type {
  MealPlanItem,
  PantryItem,
  PantryItemBatch,
  ShoppingListItem,
} from '#/graphql/generated/schemaTypes';

const OPTIMISTIC_DATA_KEY = 'apollo-optimistic-data-v1';

/** The entities whose fields survive a restart, keyed by generated typename. */
interface PersistedEntities {
  MealPlanItem: MealPlanItem;
  PantryItem: PantryItem;
  PantryItemBatch: PantryItemBatch;
  ShoppingListItem: ShoppingListItem;
}

export type PersistedEntityType = keyof PersistedEntities;

export type PersistedField<T extends PersistedEntityType> = Exclude<
  keyof PersistedEntities[T],
  '__typename'
> &
  string;

// A key that is not its entity's generated `__typename` types as `never` here.
type KeyedByTypename = {
  readonly [K in PersistedEntityType]: PersistedEntities[K]['__typename'] extends K
    ? K
    : never;
};
const PERSISTED_TYPENAMES: KeyedByTypename = {
  MealPlanItem: 'MealPlanItem',
  PantryItem: 'PantryItem',
  PantryItemBatch: 'PantryItemBatch',
  ShoppingListItem: 'ShoppingListItem',
};

export const isPersistedEntityType = (
  typename: string,
): typename is PersistedEntityType => typename in PERSISTED_TYPENAMES;

interface OptimisticFieldUpdate {
  entityType: string; // 'ShoppingListItem', 'ShoppingList', 'PantryItem', etc.
  entityId: string;
  field: string;
  value: unknown;
  timestamp: number;
}

const isFieldUpdate = (value: unknown): value is OptimisticFieldUpdate =>
  typeof value === 'object' &&
  value !== null &&
  'entityType' in value &&
  typeof value.entityType === 'string' &&
  'entityId' in value &&
  typeof value.entityId === 'string' &&
  'field' in value &&
  typeof value.field === 'string' &&
  'timestamp' in value &&
  typeof value.timestamp === 'number';

/** The stored JSON, keeping only entries in the shape `save` writes. */
function readPersistedUpdates(
  parsed: unknown,
): Record<string, OptimisticFieldUpdate> {
  const updates: Record<string, OptimisticFieldUpdate> = {};
  if (typeof parsed !== 'object' || parsed === null) return updates;
  for (const [key, entry] of Object.entries(parsed)) {
    if (isFieldUpdate(entry)) updates[key] = entry;
  }
  return updates;
}

/**
 * Persists an arbitrary field of an arbitrary entity type across app restarts,
 * so an offline change (sortOrder, quantity, a rating) survives a cold start
 * until its queued mutation lands. Keyed `entityType:entityId:field`.
 */
class OptimisticDataPersistence {
  private flushScheduled = false;
  private pendingUpdates: Record<string, OptimisticFieldUpdate> = {};

  // Kept in sync on every write, so no TTL: the data is small and only changes
  // through this class.
  private cache: Record<string, OptimisticFieldUpdate> | null = null;

  /** Batched — the write lands on the next microtask. */
  save<T extends PersistedEntityType>(
    entityType: T,
    entityId: string,
    field: PersistedField<T>,
    value: unknown,
  ): void {
    try {
      const key = `${entityType}:${entityId}:${field}`;

      this.pendingUpdates[key] = {
        entityType,
        entityId,
        field,
        value,
        timestamp: Date.now(),
      };

      if (__DEV__) {
        logger.debug(
          `💾 Optimistic: Queued ${entityType}.${field} for ${entityId}`,
          { value },
        );
      }

      // A microtask coalesces every save in this tick into one storage write,
      // without leaving a timer pending across an async boundary.
      if (!this.flushScheduled) {
        this.flushScheduled = true;
        queueMicrotask(() => {
          this.flushScheduled = false;
          this.flushPendingUpdates();
        });
      }
    } catch (error) {
      logger.error('Failed to save optimistic data:', error);
    }
  }

  /** Synchronous drain, for a path needing a guaranteed write before a read. */
  flush(): void {
    this.flushPendingUpdates();
  }

  private flushPendingUpdates(): void {
    try {
      if (Object.keys(this.pendingUpdates).length === 0) return;

      const existing = this.loadAll();
      const merged = { ...existing, ...this.pendingUpdates };

      storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(merged));
      if (__DEV__) {
        logger.debug(
          `💾 Optimistic: Flushed ${
            Object.keys(this.pendingUpdates).length
          } updates`,
        );
      }

      this.cache = merged;

      this.pendingUpdates = {};
    } catch (error) {
      logger.error('Failed to flush optimistic data:', error);
    }
  }

  /** Persisted field values for one entity instance, keyed by field name. */
  get(
    entityType: PersistedEntityType,
    entityId: string,
  ): Record<string, unknown> {
    const all = this.loadAll();
    const updates: Record<string, unknown> = {};

    Object.entries(all).forEach(([, data]) => {
      if (data.entityType === entityType && data.entityId === entityId) {
        updates[data.field] = data.value;
      }
    });

    return updates;
  }

  /** Every persisted field of an entity type, grouped by entity id. */
  getAllForType(
    entityType: PersistedEntityType,
  ): Map<string, Record<string, unknown>> {
    const all = this.loadAll();
    const byEntity = new Map<string, Record<string, unknown>>();

    Object.entries(all).forEach(([, data]) => {
      if (data.entityType === entityType) {
        const fields = byEntity.get(data.entityId) ?? {};
        fields[data.field] = data.value;
        byEntity.set(data.entityId, fields);
      }
    });

    return byEntity;
  }

  /** `save` plus the matching `clear`, for the save-then-mutate pattern. */
  track<T extends PersistedEntityType>(
    entityType: T,
    entityId: string,
    field: PersistedField<T>,
    value: unknown,
  ): () => void {
    this.save(entityType, entityId, field, value);
    return () => this.clear(entityType, entityId, field);
  }

  /** Drops one persisted field, once its mutation has synced. */
  clear<T extends PersistedEntityType>(
    entityType: T,
    entityId: string,
    field: PersistedField<T>,
  ): void {
    try {
      const existing = this.loadAll();
      const key = `${entityType}:${entityId}:${field}`;
      const hadData = key in existing;

      delete existing[key];

      if (Object.keys(existing).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
        this.cache = {};
        if (__DEV__) {
          logger.debug('🧹 Optimistic: Cleared all data (storage empty)');
        }
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(existing));
        this.cache = existing;
        if (__DEV__ && hadData) {
          logger.debug(
            `🧹 Optimistic: Cleared ${entityType}.${field} for ${entityId}`,
          );
        }
      }
    } catch (error) {
      logger.error('Failed to clear optimistic data:', error);
    }
  }

  /**
   * Drops every persisted field of one entity — deleted, or fully synced.
   * Takes the typename as read from the cache, which the caller cannot narrow.
   */
  clearEntity(entityType: string, entityId: string): void {
    try {
      const all = this.loadAll();
      const filtered = Object.fromEntries(
        Object.entries(all).filter(
          ([, data]) =>
            !(data.entityType === entityType && data.entityId === entityId),
        ),
      );

      const clearedCount =
        Object.keys(all).length - Object.keys(filtered).length;

      if (Object.keys(filtered).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
        this.cache = {};
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(filtered));
        this.cache = filtered;
      }

      if (__DEV__ && clearedCount > 0) {
        logger.debug(
          `🧹 Optimistic: Cleared ${clearedCount} fields for ${entityType}:${entityId}`,
        );
      }
    } catch (error) {
      logger.error('Failed to clear entity optimistic data:', error);
    }
  }

  /** Drops every persisted field of an entity type. */
  clearType(entityType: PersistedEntityType): void {
    try {
      const all = this.loadAll();
      const filtered = Object.fromEntries(
        Object.entries(all).filter(
          ([, data]) => data.entityType !== entityType,
        ),
      );

      const clearedCount =
        Object.keys(all).length - Object.keys(filtered).length;

      if (Object.keys(filtered).length === 0) {
        storage.remove(OPTIMISTIC_DATA_KEY);
        this.cache = {};
      } else {
        storage.set(OPTIMISTIC_DATA_KEY, JSON.stringify(filtered));
        this.cache = filtered;
      }

      if (__DEV__ && clearedCount > 0) {
        logger.debug(
          `🧹 Optimistic: Cleared ${clearedCount} fields for ${entityType}`,
        );
      }
    } catch (error) {
      logger.error('Failed to clear type optimistic data:', error);
    }
  }

  /** Everything, for a sign-out or cache reset. Drops the pending batch too. */
  clearAll(): void {
    try {
      this.pendingUpdates = {};

      storage.remove(OPTIMISTIC_DATA_KEY);
      this.cache = null;
      if (__DEV__) {
        logger.debug('🧹 Optimistic: Cleared all persisted data');
      }
    } catch (error) {
      logger.error('Failed to clear all optimistic data:', error);
    }
  }

  getStats(): {
    totalUpdates: number;
    entityTypes: string[];
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    const all = this.loadAll();
    const entries = Object.values(all);

    const entityTypes = Array.from(new Set(entries.map(e => e.entityType)));

    const timestamps = entries.map(e => e.timestamp);

    return {
      totalUpdates: entries.length,
      entityTypes,
      oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  private loadAll(): Record<string, OptimisticFieldUpdate> {
    try {
      if (this.cache !== null) {
        return this.cache;
      }

      const data = storage.getString(OPTIMISTIC_DATA_KEY);
      const parsed: unknown = data ? JSON.parse(data) : {};
      const loaded = readPersistedUpdates(parsed);

      this.cache = loaded;

      return loaded;
    } catch (error) {
      logger.error('Failed to load optimistic data:', error);
      return {};
    }
  }
}

export const optimisticDataPersistence = new OptimisticDataPersistence();
