/**
 * useResolveUnit - Unit symbol resolution hook
 *
 * Single responsibility:
 * - Resolve unit symbols to unit IDs using GraphQL query
 * - Cache-first policy for efficient lookups
 */

import { useCallback } from 'react';
import { useGetUnitBySymbolLazyQuery } from '#generated';

/**
 * Hook for resolving unit symbols to unit IDs
 *
 * @example
 * ```tsx
 * const { resolveUnitId } = useResolveUnit();
 * const unitId = await resolveUnitId(currentUnitId, 'kg');
 * ```
 */
export function useResolveUnit() {
  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'cache-first',
  });

  /**
   * Resolve unit ID from symbol if not already set
   */
  const resolveUnitId = useCallback(
    async (
      currentUnitId: string | null,
      unitSymbol: string,
    ): Promise<string | null> => {
      if (currentUnitId) return currentUnitId;
      if (!unitSymbol.trim()) return null;

      const result = await unitQuery({
        variables: { symbol: unitSymbol.trim() },
      });
      return result.data?.unitBySymbol?.id || null;
    },
    [unitQuery],
  );

  return { resolveUnitId };
}
