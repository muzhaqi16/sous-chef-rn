/**
 * Fractional Indexing Utilities
 *
 * Provides utilities for managing ordered lists using fractional indexing.
 * This allows reordering items with minimal database updates (typically just 1 update
 * instead of updating all items in the list).
 *
 * Based on the fractional-indexing package and Figma's approach to list ordering.
 *
 * @see https://www.figma.com/blog/realtime-editing-of-ordered-sequences/
 * @see https://github.com/rocicorp/fractional-indexing
 */

import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key for a new item being inserted into a list
 *
 * @param prevKey - The position key of the item before the insertion point (null if inserting at start)
 * @param nextKey - The position key of the item after the insertion point (null if inserting at end)
 * @returns A new position key that sorts between prevKey and nextKey
 *
 * @example
 * // Insert at the beginning
 * const pos = generatePosition(null, 'a0'); // Returns something like 'Zz'
 *
 * @example
 * // Insert between two items
 * const pos = generatePosition('a0', 'a1'); // Returns something like 'a0V'
 *
 * @example
 * // Insert at the end
 * const pos = generatePosition('a1', null); // Returns something like 'a2'
 */
export function generatePosition(
  prevKey: string | null | undefined,
  nextKey: string | null | undefined,
): string {
  // Handle undefined by converting to null (fractional-indexing expects null for boundaries)
  const prev = prevKey === undefined ? null : prevKey;
  const next = nextKey === undefined ? null : nextKey;

  return generateKeyBetween(prev, next);
}
