import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import type { PickableUnit } from '#features/pantry/components/unitPickerTypes';
import {
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
  type ConsumptionUnitsForPantryItemQuery,
  type RestockUnitsForPantryItemQuery,
} from '#features/pantry/graphql/pantry.generated';
import type { UnitRole } from '#/graphql/generated/schemaTypes';
import { UnitType, UnitSource } from '#/graphql/generated/schemaTypes';
export enum PantryOperation {
  Consume = 'CONSUME',
  Waste = 'WASTE',
  Restock = 'RESTOCK',
}

/**
 * What this hook selects, and exactly what `UnitPicker` accepts. The shape is
 * the component's — see `#features/pantry/components/unitPickerTypes` for why
 * the dependency points that way.
 */
export type SelectedUnitInfo = PickableUnit;

export interface RankedUnitInfo {
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitType: UnitType;
  isTrackingUnit: boolean;
  role: UnitRole;
  source: UnitSource;
  rank: number;
  defaultIncrement: number | null;
  commonFractions: number[] | null;
  isWholeContainer: boolean;
  displayAsFraction: boolean;
  hasStandardCountFactor: boolean;
  // For useConversionPreview compatibility (not available from ranked queries)
  conversionRatio: number | null;
  conversionConfidence: number | null;
}

export interface RankedUnitGroup {
  type: UnitType;
  label: string;
  units: RankedUnitInfo[];
}

interface UseOperationUnitsOptions {
  pantryItemId: string | undefined;
  trackingUnitId: string | undefined;
  trackingUnitType: UnitType | undefined;
  /** Preferred as the default unit for a dual-tracked stack; not a query input. */
  netWeightUnitId?: string | null;
  operation: PantryOperation;
}

interface UseOperationUnitsResult {
  groups: RankedUnitGroup[];
  allUnits: RankedUnitInfo[];
  defaultUnit: SelectedUnitInfo | null;
  defaultIncrement: number | null;
  defaultCommonFractions: number[] | null;
  loading: boolean;
}

const TYPE_ORDER: UnitType[] = [
  UnitType.Volume,
  UnitType.Weight,
  UnitType.Count,
  UnitType.Length,
  UnitType.Area,
  UnitType.Time,
];

type ApiRankedUnit =
  | ConsumptionUnitsForPantryItemQuery['consumptionUnitsForPantryItem'][number]
  | RestockUnitsForPantryItemQuery['restockUnitsForPantryItem'][number];

function toRankedUnitInfo(
  ru: ApiRankedUnit,
  trackingUnitId: string | undefined,
): RankedUnitInfo {
  return {
    unitId: ru.unit.id,
    unitName: ru.unit.name,
    unitSymbol: ru.unit.symbol,
    unitType: ru.unit.type,
    isTrackingUnit: ru.unit.id === trackingUnitId,
    role: ru.unit.unitRole,
    source: ru.source,
    rank: ru.rank,
    defaultIncrement: ru.defaultIncrement,
    commonFractions: ru.commonFractions,
    isWholeContainer: ru.isWholeContainer,
    displayAsFraction: ru.unit.displayAsFraction,
    hasStandardCountFactor: ru.unit.hasStandardCountFactor,
    conversionRatio: null,
    conversionConfidence: null,
  };
}

/**
 * Two COUNT units convert only when both declare a universal factor (dozen =
 * 12); a clove and a head each carry a factor of 1 to "piece" that means
 * nothing. Applied ONLY to `AUTO` — derived from role and convertibility alone.
 * `CURATED` and `TRACKING_UNIT` carry an item-scoped relationship and stand.
 */
function convertsFromTracking(
  unit: RankedUnitInfo,
  trackingUnitType: UnitType | undefined,
): boolean {
  if (unit.source !== UnitSource.Auto) return true;
  if (trackingUnitType !== UnitType.Count || unit.unitType !== UnitType.Count) {
    return true;
  }
  return unit.hasStandardCountFactor;
}

function buildGroups(
  units: RankedUnitInfo[],
  trackingUnitType: UnitType | undefined,
  translate: Translate,
): RankedUnitGroup[] {
  const byType = new Map<UnitType, RankedUnitInfo[]>();
  for (const unit of units) {
    const existing = byType.get(unit.unitType);
    if (existing) {
      existing.push(unit);
    } else {
      byType.set(unit.unitType, [unit]);
    }
  }

  // Tracking unit's type first, then the standard order
  const orderedTypes: UnitType[] = [];
  if (trackingUnitType && byType.has(trackingUnitType)) {
    orderedTypes.push(trackingUnitType);
  }
  for (const orderedType of TYPE_ORDER) {
    if (byType.has(orderedType) && !orderedTypes.includes(orderedType)) {
      orderedTypes.push(orderedType);
    }
  }

  return orderedTypes.flatMap(type => {
    // Units arrive pre-sorted by rank from the API — preserve that order
    const typeUnits = byType.get(type);
    return typeUnits
      ? [{ type, label: translate(`unitType.${type}`), units: typeUnits }]
      : [];
  });
}

function toSelectedUnitInfo(unit: RankedUnitInfo): SelectedUnitInfo {
  return {
    unitId: unit.unitId,
    unitSymbol: unit.unitSymbol,
    unitName: unit.unitName,
    unitType: unit.unitType,
    isTrackingUnit: unit.isTrackingUnit,
    conversionRatio: unit.conversionRatio,
    conversionConfidence: unit.conversionConfidence,
  };
}

export function useOperationUnits({
  pantryItemId,
  trackingUnitId,
  trackingUnitType,
  netWeightUnitId,
  operation,
}: UseOperationUnitsOptions): UseOperationUnitsResult {
  const { t } = useTranslation();
  const isConsumption =
    operation === PantryOperation.Consume ||
    operation === PantryOperation.Waste;

  // Consume and waste: keyed by the STACK so the server reads its whole
  // measurement profile — the client holds only part of it.
  const consumptionResult = useQuery(
    ConsumptionUnitsForPantryItemDocument,
    isConsumption && pantryItemId ? { variables: { pantryItemId } } : skipToken,
  );

  // Restock query
  const restockResult = useQuery(
    RestockUnitsForPantryItemDocument,
    !isConsumption && pantryItemId
      ? { variables: { pantryItemId } }
      : skipToken,
  );

  const rawUnits = isConsumption
    ? consumptionResult.data?.consumptionUnitsForPantryItem ?? []
    : restockResult.data?.restockUnitsForPantryItem ?? [];
  const loading = isConsumption
    ? consumptionResult.loading
    : restockResult.loading;

  const allUnits = rawUnits
    .map(ru => toRankedUnitInfo(ru, trackingUnitId))
    .filter(unit => convertsFromTracking(unit, trackingUnitType));
  const groups = buildGroups(allUnits, trackingUnitType, t);

  // Default unit = first in ranked list (rank 1), prefer net weight unit for dual-tracked items
  const defaultRankedUnit =
    (netWeightUnitId != null
      ? allUnits.find(u => u.unitId === netWeightUnitId)
      : null) ?? (allUnits.length > 0 ? allUnits[0] : null);
  const defaultUnit = defaultRankedUnit
    ? toSelectedUnitInfo(defaultRankedUnit)
    : null;

  return {
    groups,
    allUnits,
    defaultUnit,
    defaultIncrement: defaultRankedUnit?.defaultIncrement ?? null,
    defaultCommonFractions: defaultRankedUnit?.commonFractions ?? null,
    loading,
  };
}
