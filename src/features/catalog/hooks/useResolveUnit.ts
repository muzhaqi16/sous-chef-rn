import { useLazyQuery } from '@apollo/client/react';
import type { UnitType } from '#/graphql/generated/schemaTypes';
import { GetUnitBySymbolDocument } from '#operations/item/unit.generated';
import { useCachedUnits, useIsOnline } from '#store/useAppStore';
import { unitLabel } from '#/utils/formatQuantity';

interface HeldUnit {
  id: string;
  name: string;
  symbol: string;
  localizedSymbol?: string;
  symbolOther?: string;
  localizedName?: string;
  nameOther?: string;
  abbreviation?: string;
  type?: UnitType;
}

/** A unit a typed text names, as the field shows and checks it. */
export interface ResolvedUnit {
  id: string;
  /** Canonical, for checks; `label` is what the field shows. */
  symbol: string;
  label: string;
  /** Null where the unit came from the API with no kind. */
  type: UnitType | null;
}

// The app's language beside the canonical labels, so a unit typed in either
// resolves; the result still carries the canonical `symbol`.
const labelsOf = (unit: HeldUnit) =>
  [
    unit.symbol,
    unit.abbreviation,
    unit.name,
    unit.localizedSymbol,
    unit.symbolOther,
    unit.localizedName,
    unit.nameOther,
  ].flatMap(label => (label ? [label.toLowerCase()] : []));

// One letter added, dropped or changed.
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// So long before a typed name may carry a typo: `cartoon` is carton, `lbs` is
// only a plural.
const TYPO_TOLERANT_LENGTH = 4;

// "lbs" and "cups" name what "lb" and "cup" do; a longer name may carry one
// typo, when only one unit is that close.
const heldUnitNamed = (units: readonly HeldUnit[], typed: string) => {
  const text = typed.toLowerCase();
  const singular = text.endsWith('s') ? text.slice(0, -1) : null;
  const exact =
    units.find(unit => labelsOf(unit).includes(text)) ??
    (singular
      ? units.find(unit => labelsOf(unit).includes(singular))
      : undefined);
  if (exact || text.length < TYPO_TOLERANT_LENGTH) return exact;
  const near = units.filter(unit =>
    labelsOf(unit).some(label => withinOneEdit(label, text)),
  );
  return near.length === 1 ? near[0] : undefined;
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

  /** The unit a typed text names among those the device holds, at once. */
  const heldUnitFor = (unitText: string): ResolvedUnit | null => {
    const typed = unitText.trim();
    const held = typed ? heldUnitNamed(heldUnits, typed) : undefined;
    return held
      ? {
          id: held.id,
          symbol: held.symbol,
          label: unitLabel(held),
          type: held.type ?? null,
        }
      : null;
  };

  const resolveUnit = async (
    unitText: string,
  ): Promise<ResolvedUnit | null> => {
    const typed = unitText.trim();
    if (!typed) return null;
    const held = heldUnitFor(typed);
    if (held) return held;
    if (!isOnline) return null;
    const result = await unitQuery({ variables: { symbol: typed } });
    const unit = result.data?.unitBySymbol;
    return unit
      ? {
          id: unit.id,
          symbol: unit.symbol,
          label: unitLabel(unit),
          type: unit.type,
        }
      : null;
  };

  const resolveUnitId = async (
    currentUnitId: string | null,
    unitText: string,
  ): Promise<string | null> =>
    currentUnitId ?? (await resolveUnit(unitText))?.id ?? null;

  return { heldUnitFor, resolveUnit, resolveUnitId };
}
