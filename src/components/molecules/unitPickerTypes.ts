import type { UnitType } from '#/graphql/generated/schemaTypes';

/**
 * A unit as `UnitPicker` renders it. Declared here, not imported from a producing
 * hook: this is the kit component's own contract, and producers conform to it.
 */
export interface PickableUnit {
  unitId: string;
  unitSymbol: string;
  unitName: string;
  unitType: UnitType;
  isTrackingUnit: boolean;
  conversionRatio: number | null;
  conversionConfidence: number | null;
}
