import { useLazyQuery } from '@apollo/client/react';
import { GetUnitBySymbolDocument } from '#operations/item/unit.generated';
import { useCachedUnits, useIsOnline } from '#store/useAppStore';

interface HeldUnit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

const named = (unit: HeldUnit, text: string) =>
  [unit.symbol, unit.abbreviation, unit.name].some(
    label => label?.toLowerCase() === text,
  );

// "lbs" and "cups" name what "lb" and "cup" do.
const heldUnitNamed = (units: readonly HeldUnit[], typed: string) => {
  const text = typed.toLowerCase();
  const singular = text.endsWith('s') ? text.slice(0, -1) : null;
  return (
    units.find(unit => named(unit, text)) ??
    (singular ? units.find(unit => named(unit, singular)) : undefined)
  );
};

/**
 * The unit a typed text names: from the units held on the device first, from
 * the API only when they hold none and the phone is online.
 */
export function useResolveUnit() {
  const heldUnits = useCachedUnits();
  const isOnline = useIsOnline();
  const [unitQuery] = useLazyQuery(GetUnitBySymbolDocument, {
    fetchPolicy: 'cache-first',
    refetchOn: false,
  });

  const resolveUnitId = async (
    currentUnitId: string | null,
    unitText: string,
  ): Promise<string | null> => {
    if (currentUnitId) return currentUnitId;
    const typed = unitText.trim();
    if (!typed) return null;
    const held = heldUnitNamed(heldUnits, typed);
    if (held) return held.id;
    if (!isOnline) return null;
    const result = await unitQuery({ variables: { symbol: typed } });
    return result.data?.unitBySymbol?.id ?? null;
  };

  return { resolveUnitId };
}
