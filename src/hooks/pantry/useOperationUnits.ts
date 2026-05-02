import { useQuery } from '@apollo/client/react';
import {
  ConsumptionUnitsForItemDocument,
  RestockUnitsForItemDocument,
  type ConsumptionUnitsForItemQuery,
  type RestockUnitsForItemQuery,
} from '#operations/pantry/pantry.generated';
import {
  UnitType,
  UnitRole,
  UnitSource,
} from '#/graphql/generated/schemaTypes';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum PantryOperation {
  Consume = 'CONSUME',
  Waste = 'WASTE',
  Restock = 'RESTOCK',
}

export interface SelectedUnitInfo {
  unitId: string;
  unitSymbol: string;
  unitName: string;
  unitType: UnitType;
  isTrackingUnit: boolean;
  conversionRatio: number | null;
  conversionConfidence: number | null;
}

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
  itemId: string | undefined;
  pantryItemId: string | undefined;
  trackingUnitId: string | undefined;
  trackingUnitType: UnitType | undefined;
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
  error: Error | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<UnitType, string> = {
  [UnitType.Weight]: 'Weight',
  [UnitType.Volume]: 'Volume',
  [UnitType.Count]: 'Count',
  [UnitType.Length]: 'Length',
  [UnitType.Area]: 'Area',
  [UnitType.Time]: 'Time',
};

const TYPE_ORDER: UnitType[] = [
  UnitType.Volume,
  UnitType.Weight,
  UnitType.Count,
  UnitType.Length,
  UnitType.Area,
  UnitType.Time,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApiRankedUnit =
  | ConsumptionUnitsForItemQuery['consumptionUnitsForItem'][number]
  | RestockUnitsForItemQuery['restockUnitsForItem'][number];

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
    conversionRatio: null,
    conversionConfidence: null,
  };
}

function buildGroups(
  units: RankedUnitInfo[],
  trackingUnitType: UnitType | undefined,
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
  for (const t of TYPE_ORDER) {
    if (byType.has(t) && !orderedTypes.includes(t)) {
      orderedTypes.push(t);
    }
  }

  return orderedTypes.map(type => ({
    type,
    label: TYPE_LABELS[type],
    // Units arrive pre-sorted by rank from the API — preserve that order
    units: byType.get(type)!,
  }));
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOperationUnits({
  itemId,
  pantryItemId,
  trackingUnitId,
  trackingUnitType,
  netWeightUnitId,
  operation,
}: UseOperationUnitsOptions): UseOperationUnitsResult {
  const isConsumption =
    operation === PantryOperation.Consume ||
    operation === PantryOperation.Waste;

  // Consumption query (for consume & waste operations)
  const consumptionResult = useQuery(ConsumptionUnitsForItemDocument, {
    variables: {
      itemId: itemId!,
      trackingUnitId: trackingUnitId!,
      netWeightUnitId,
    },
    skip: !isConsumption || !itemId || !trackingUnitId,
  });

  // Restock query
  const restockResult = useQuery(RestockUnitsForItemDocument, {
    variables: { pantryItemId: pantryItemId! },
    skip: isConsumption || !pantryItemId,
  });

  const rawUnits = isConsumption
    ? consumptionResult.data?.consumptionUnitsForItem ?? []
    : restockResult.data?.restockUnitsForItem ?? [];
  const loading = isConsumption
    ? consumptionResult.loading
    : restockResult.loading;
  const error = isConsumption ? consumptionResult.error : restockResult.error;

  const allUnits = rawUnits.map(ru => toRankedUnitInfo(ru, trackingUnitId));
  const groups = buildGroups(allUnits, trackingUnitType);

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
    error,
  };
}
