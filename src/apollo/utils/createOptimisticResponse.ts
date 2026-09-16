export interface VersionedEntity {
  id: string;
  version?: number | null;
  updatedAt?: string | null;
  __typename?: string;
}

/**
 * Merge `updates` into a cached entity for an optimistic response. The version is
 * kept, NOT incremented — the server owns that, and its response carries the
 * incremented one.
 */
export function enhanceWithVersion<T extends VersionedEntity>(
  currentItem: T | undefined,
  updates: Partial<T> | Record<string, unknown>,
): T {
  if (!currentItem) {
    throw new Error('enhanceWithVersion requires a current item from cache');
  }

  return {
    ...currentItem,
    ...updates,
    version: currentItem.version ?? 0,
    updatedAt: new Date().toISOString(),
  };
}
