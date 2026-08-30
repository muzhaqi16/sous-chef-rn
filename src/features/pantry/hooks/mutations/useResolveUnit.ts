import { useLazyQuery } from '@apollo/client/react';
import { GetUnitBySymbolDocument } from '#operations/item/unit.generated';

export function useResolveUnit() {
  const [unitQuery] = useLazyQuery(GetUnitBySymbolDocument, {
    fetchPolicy: 'cache-first',
  });

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
