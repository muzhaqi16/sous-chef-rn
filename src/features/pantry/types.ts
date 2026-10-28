import type {
  AdjustmentKind,
  ItemCondition,
  StorageState,
  UnitType,
  UsagePurpose,
} from '#/graphql/generated/schemaTypes';
import type { OfferedAcquisitionMethod } from '#features/pantry/utils/itemEnumLabels';
import type { MeasureShape } from '#domain/measure';
import type { UnitLabelSource } from '#/utils/formatQuantity';

/** A unit as `UnitPicker` renders it; the hooks that rank units produce this shape. */
export interface PickableUnit {
  unitId: string;
  /** The unit as the ranking returns it, to show. */
  unit: UnitLabelSource;
  unitType: UnitType;
  isTrackingUnit: boolean;
  conversionRatio: number | null;
  conversionConfidence: number | null;
}

/** An amount and the unit it reads in: "11 pc", "2 doz". */
export interface ShownQuantity {
  quantity: number;
  unit: UnitLabelSource;
  /** The unit's own notation; null where a fraction wins. */
  displayAsFraction: boolean | null;
}

export interface PantryActionSharedState {
  selectedUnitInfo: PickableUnit | null;
  setSelectedUnitInfo: (unit: PickableUnit) => void;
  notes: string;
  setNotes: (notes: string) => void;
  /** Available quantity in the tracking unit, which is always the base. */
  trackingQuantity: number;
  trackingUnit: UnitLabelSource;
  trackingUnitId: string | undefined;
  /** A unit's own notation; null where its flag is unknown. */
  displayAsFractionOf: (unitId: string | undefined) => boolean | null;
  /** Selected unit, falling back to the tracking unit. */
  activeUnit: UnitLabelSource;
  activeUnitId: string | undefined;
  /** A non-tracking unit is selected, so quantities need conversion. */
  isConvertedUnit: boolean;
  /**
   * Tracking units per selected unit when no conversion is needed: 1 for the
   * tracking unit, 12 for a dozen of it. Null for any other unit, and on a
   * dual-tracked stack, whose count moves by whole packages.
   */
  exactFactor: number | null;
  /** A tracking-unit amount as the stack shows it: "2 doz", "11 pc". */
  showStock: (held: number) => ShownQuantity;
  pantryItemId: string | undefined;
  /** Resolved from the ranked-units API, along with the two below. */
  defaultUnit: PickableUnit | null;
  defaultIncrement: number | null;
  commonFractions: number[] | null;
  /** Null when the unit is the same or the conversion failed. */
  availableInSelectedUnit: number | null;
  availableLoading: boolean;
  /** Dual-tracked items only. */
  remainingNetWeight: number | null;
  netWeightUnit: UnitLabelSource | undefined;
  netWeightUnitId: string | undefined;
  isDualTracked: boolean;
}

export interface UsageRecord {
  id: string;
  usedAt: string;
  quantityUsed: number;
  purpose: UsagePurpose;
  adjustmentKind?: AdjustmentKind | null;
  adjustmentReason?: string | null;
  usageUnit?: UnitLabelSource | null;
  totalCost?: number | null;
  currency?: { code: string } | null;
  /** A recount stated in a unit, read in both systems; null on every other row. */
  statedAmount?: MeasureShape | null;
}

/** The units a recount was typed in, where not the stack's own. */
export interface RecountUnits {
  newQuantityUnitId?: string;
  remainingNetWeightUnitId?: string;
}

export interface PackageSizeCorrectionInput {
  netWeight: number;
  netWeightUnitId: string;
  reason: string;
}

export type AddPantryItemFormData = {
  // Page 1 — Main
  itemName: string;
  brand: string;
  category: string;
  expirationDate: Date | null;
  storageState: StorageState;
  // Page 2 — Details
  quantityInput: string;
  unit: string;
  unitId: string | null;
  pantryNetWeight: string;
  pantryNetWeightUnit: string;
  pantryNetWeightUnitId: string | null;
  showPackageDetails: boolean;
  packageSize: string;
  contentUnit: string;
  contentUnitId: string | null;
  itemNetWeight: string;
  weightUnit: string;
  weightUnitId: string | null;
  // Page 3 — Storage
  storageLocation: string;
  selectedStorageLocationId: string | null;
  storageNotes: string;
  condition: ItemCondition;
  tags: string;
  // Page 4 — Stock + Purchase
  minQuantity: string;
  restockQuantity: string;
  storeName: string;
  storeId: string | null;
  costPerUnit: string;
  acquisitionMethod: OfferedAcquisitionMethod;
};
