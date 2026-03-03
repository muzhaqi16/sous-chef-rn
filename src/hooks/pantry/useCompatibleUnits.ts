import {
  useCompatibleUnitsForItemQuery,
  type CompatibleUnitsForItemQuery,
  UnitType,
} from '#generated';

export interface SelectedUnitInfo {
  unitId: string;
  unitSymbol: string;
  unitName: string;
  unitType: UnitType;
  isTrackingUnit: boolean;
  conversionConfidence: number | null;
}

export interface EnrichedUnit {
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitType: UnitType;
  isTrackingUnit: boolean;
  isNetWeightUnit: boolean;
  isContentUnit: boolean;
  isDefaultConsumeUnit: boolean;
  conversionRatio: number | null;
  conversionConfidence: number | null;
}

export interface UnitGroup {
  type: UnitType;
  label: string;
  units: EnrichedUnit[];
}

interface UseCompatibleUnitsOptions {
  itemId: string | undefined;
  trackingUnitId: string | undefined;
  trackingUnitType: UnitType | undefined;
  netWeightUnitId?: string | null;
  contentUnitId?: string | null;
  defaultConsumeUnitId?: string | null;
}

const TYPE_LABELS: Record<UnitType, string> = {
  [UnitType.Weight]: 'Weight',
  [UnitType.Volume]: 'Volume',
  [UnitType.Count]: 'Count',
  [UnitType.Length]: 'Length',
  [UnitType.Area]: 'Area',
  [UnitType.Time]: 'Time',
};

// Preferred display order for unit type groups
const TYPE_ORDER: UnitType[] = [
  UnitType.Volume,
  UnitType.Weight,
  UnitType.Count,
  UnitType.Length,
  UnitType.Area,
  UnitType.Time,
];

type CompatibleUnit = CompatibleUnitsForItemQuery['compatibleUnitsForItem'][number];

function enrichUnit(
  cu: CompatibleUnit,
  trackingUnitId: string | undefined,
  netWeightUnitId: string | null | undefined,
  contentUnitId: string | null | undefined,
  defaultConsumeUnitId: string | null | undefined,
): EnrichedUnit {
  return {
    unitId: cu.unit.id,
    unitName: cu.unit.name,
    unitSymbol: cu.unit.symbol,
    unitType: cu.unit.type,
    isTrackingUnit: cu.unit.id === trackingUnitId,
    isNetWeightUnit: cu.unit.id === netWeightUnitId,
    isContentUnit: cu.unit.id === contentUnitId,
    isDefaultConsumeUnit: cu.unit.id === defaultConsumeUnitId,
    conversionRatio: cu.conversionRatio,
    conversionConfidence: cu.conversionConfidence,
  };
}

function sortUnitsInGroup(units: EnrichedUnit[]): EnrichedUnit[] {
  return [...units].sort((a, b) => {
    // Tracking unit first
    if (a.isTrackingUnit !== b.isTrackingUnit) return a.isTrackingUnit ? -1 : 1;
    // Default consume unit second
    if (a.isDefaultConsumeUnit !== b.isDefaultConsumeUnit) return a.isDefaultConsumeUnit ? -1 : 1;
    // Configured units (netWeight, content) next
    const aConfigured = a.isNetWeightUnit || a.isContentUnit;
    const bConfigured = b.isNetWeightUnit || b.isContentUnit;
    if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
    // Higher confidence first
    const aConf = a.conversionConfidence ?? 0;
    const bConf = b.conversionConfidence ?? 0;
    if (aConf !== bConf) return bConf - aConf;
    // Alphabetical
    return a.unitName.localeCompare(b.unitName);
  });
}

function buildGroups(
  enrichedUnits: EnrichedUnit[],
  trackingUnitType: UnitType | undefined,
): UnitGroup[] {
  const byType = new Map<UnitType, EnrichedUnit[]>();
  for (const unit of enrichedUnits) {
    const existing = byType.get(unit.unitType);
    if (existing) {
      existing.push(unit);
    } else {
      byType.set(unit.unitType, [unit]);
    }
  }

  // Build ordered type list: tracking unit's type first, then the rest in TYPE_ORDER
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
    units: sortUnitsInGroup(byType.get(type)!),
  }));
}

function resolveDefaultUnit(
  allUnits: EnrichedUnit[],
  defaultConsumeUnitId: string | null | undefined,
  trackingUnitId: string | undefined,
): SelectedUnitInfo | null {
  // Prefer defaultConsumeUnit if it exists in the compatible list
  if (defaultConsumeUnitId) {
    const match = allUnits.find(u => u.unitId === defaultConsumeUnitId);
    if (match) return toSelectedUnitInfo(match);
  }
  // Fall back to tracking unit
  if (trackingUnitId) {
    const match = allUnits.find(u => u.unitId === trackingUnitId);
    if (match) return toSelectedUnitInfo(match);
  }
  // Fall back to first unit
  if (allUnits.length > 0) return toSelectedUnitInfo(allUnits[0]);
  return null;
}

function toSelectedUnitInfo(unit: EnrichedUnit): SelectedUnitInfo {
  return {
    unitId: unit.unitId,
    unitSymbol: unit.unitSymbol,
    unitName: unit.unitName,
    unitType: unit.unitType,
    isTrackingUnit: unit.isTrackingUnit,
    conversionConfidence: unit.conversionConfidence,
  };
}

export function useCompatibleUnits({
  itemId,
  trackingUnitId,
  trackingUnitType,
  netWeightUnitId,
  contentUnitId,
  defaultConsumeUnitId,
}: UseCompatibleUnitsOptions) {
  const { data, loading, error } = useCompatibleUnitsForItemQuery({
    variables: { itemId: itemId!, currentUnitId: trackingUnitId },
    skip: !itemId,
    fetchPolicy: 'cache-first',
  });

  const compatibleUnits = data?.compatibleUnitsForItem ?? [];

  const enrichedUnits = compatibleUnits.map(cu =>
    enrichUnit(cu, trackingUnitId, netWeightUnitId, contentUnitId, defaultConsumeUnitId),
  );

  const groups = buildGroups(enrichedUnits, trackingUnitType);
  const defaultUnit = resolveDefaultUnit(enrichedUnits, defaultConsumeUnitId, trackingUnitId);

  return { groups, allUnits: enrichedUnits, defaultUnit, loading, error };
}
