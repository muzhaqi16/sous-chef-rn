import type { UnitType } from '#/graphql/generated/schemaTypes';

/**
 * A unit as `UnitPicker` renders it.
 *
 * Declared here rather than imported from the hook that happens to produce it:
 * `UnitPicker` is a kit component with two callers in different features, so
 * the shape it accepts is part of ITS contract. A producer conforms to this;
 * this does not follow a producer.
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
