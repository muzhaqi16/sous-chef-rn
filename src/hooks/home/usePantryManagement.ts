/**
 * usePantryManagement - DEPRECATED: Re-exports from split hooks
 *
 * This file is maintained for backward compatibility.
 * For new code, import directly from './pantry':
 *
 * @example
 * ```tsx
 * // Individual hooks (preferred)
 * import { usePantryQuery } from '#/hooks/home/pantry';
 * import { usePantryStats } from '#/hooks/home/pantry';
 *
 * // Composition hook (backward compatible)
 * import { usePantryManagement } from '#/hooks/home/pantry';
 * ```
 */

export {
  usePantryManagement,
  usePantryQuery,
  usePantryStats,
  usePantryItemMutations,
  StorageState,
} from './pantry';

export type {
  PantryItemInput,
  PantryItemUpdate,
  PantryStats,
  LocationCounts,
  SectionedItems,
} from './pantry';
