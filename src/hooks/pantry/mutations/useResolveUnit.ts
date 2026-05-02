/**
 * useResolveUnit - Unit symbol resolution hook
 *
 * Single responsibility:
 * - Resolve unit symbols to unit IDs using GraphQL query
 * - Cache-first policy for efficient lookups
 */

import { useLazyQuery } from '@apollo/client/react';
import { GetUnitBySymbolDocument } from '../../../graphql/operations/item/unit.generated';

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
  const [unitQuery] = useLazyQuery(GetUnitBySymbolDocument, {
    fetchPolicy: 'cache-first',
  });

  /**
   * Resolve unit ID from symbol if not already set
   */
  const resolveUnitId = async (
    currentUnitId: string | null,
    unitSymbol: string,
  ): Promise<string | null> => {
    if (currentUnitId) return currentUnitId;
    if (!unitSymbol.trim()) return null;

    const result = await unitQuery({
      variables: { symbol: unitSymbol.trim() },
    });
    return result.data?.unitBySymbol?.id || null;
  };

  return { resolveUnitId };
}
