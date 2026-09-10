import {
  NetWeightKind,
  type BaseDimension,
  type ItemClassificationInput,
  type ItemType,
  type PackageInfoInput,
  type ProductDetailsInput,
  type StorageState,
  type SuggestibleItemChangesInput,
} from '#/graphql/generated/schemaTypes';
import type { UseItemForEdit_ItemFragment } from '#features/catalog/hooks/useItemForEdit.generated';
import type { AddItemFormData } from './createItemMapping';
import type { AddItemFormInitialData } from '#features/catalog/ui/AddItemForm/AddItemForm';

/**
 * The pre-edit original `buildSuggestibleItemChanges` diffs against. Source it
 * ONLY from the `useItemForEdit_item` fragment — `ScannedItem` and
 * `ItemSuggestion` are lossy, and a field they drop reads as "user cleared it".
 */
export interface EditableItemSnapshot {
  id: string;
  /**
   * May this user write to the item directly with `updateItem`? Viewer-scoped.
   * `false` does NOT mean "suggest instead" — the two flags are independent, and
   * both are false for a read-only item.
   */
  canEdit: boolean;
  /**
   * Does `createItemSuggestion` accept this item? Not viewer-scoped, and
   * STRUCTURAL only: the 5-pending cap and 10/hour limit come back as errors on
   * submit, not from here.
   */
  canSuggest: boolean;
  name: string;
  description?: string;
  type: ItemType;
  brandId?: string;
  brandName?: string;
  storageState: StorageState;
  tags: string[];
  primaryUpc?: string;
  shelfLifeDays?: number;
  shelfLifeOpenedDays?: number;
  netWeight?: number;
  netWeightKind?: NetWeightKind;
  displayUnitId?: string;
  displayUnitName?: string;
  baseDimension?: BaseDimension;
  imageUrl?: string;
}

export interface ItemChangesDiff {
  changes: SuggestibleItemChangesInput;
  hasChanges: boolean;
  /** Dotted keys, e.g. ['name', 'productDetails.primaryUpc'] — tests + telemetry. */
  changedFields: string[];
}

const nullableToUndefined = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

/** Trim, then collapse empty strings to undefined so '' and absent compare equal. */
const norm = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const dedupe = (tags: readonly string[]): string[] => [
  ...new Set(tags.map(tag => tag.trim()).filter(Boolean)),
];

/** Order- and duplicate-insensitive: re-ordering tags is not a change. */
const sameTagSet = (a: readonly string[], b: readonly string[]): boolean => {
  const left = dedupe(a);
  const right = dedupe(b);
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every(tag => rightSet.has(tag));
};

export function itemToEditableSnapshot(
  item: UseItemForEdit_ItemFragment,
): EditableItemSnapshot {
  const primaryBrand = item.brands[0]?.brand;
  return {
    id: item.id,
    canEdit: item.canEdit,
    canSuggest: item.canSuggest,
    name: item.name,
    description: nullableToUndefined(item.description),
    type: item.type,
    brandId: primaryBrand?.id,
    brandName: primaryBrand?.name,
    storageState: item.storageState,
    tags: item.tags,
    primaryUpc: nullableToUndefined(item.primaryUpc),
    shelfLifeDays: nullableToUndefined(item.shelfLifeDays),
    shelfLifeOpenedDays: nullableToUndefined(item.shelfLifeOpenedDays),
    netWeight: nullableToUndefined(item.netWeight),
    netWeightKind: nullableToUndefined(item.netWeightKind),
    displayUnitId: item.displayUnit?.id,
    displayUnitName: item.displayUnit?.name,
    baseDimension: nullableToUndefined(item.baseDimension),
    imageUrl: nullableToUndefined(item.imageUrl),
  };
}

/**
 * Emits ONLY changed fields — an unchanged one reads to the reviewing admin as a
 * requested change. An absent key means "no change", so CLEARING is not
 * expressible; a removal is asked for in the note. `media`, `tagOps`,
 * `categoryOps`, `unit*`, `storeSkuOps` and `packageInfo.defaultConsume*` never.
 */
export function buildSuggestibleItemChanges(
  original: EditableItemSnapshot,
  formData: AddItemFormData,
): ItemChangesDiff {
  const changes: SuggestibleItemChangesInput = {};
  const changedFields: string[] = [];

  const name = norm(formData.name);
  if (name && name !== norm(original.name)) {
    changes.name = name;
    changedFields.push('name');
  }

  const description = norm(formData.description);
  if (description && description !== norm(original.description)) {
    changes.description = description;
    changedFields.push('description');
  }

  if (formData.type && formData.type !== original.type) {
    changes.type = formData.type;
    changedFields.push('type');
  }

  const classification: ItemClassificationInput = {};
  if (
    formData.storageState &&
    formData.storageState !== original.storageState
  ) {
    classification.storageState = formData.storageState;
    changedFields.push('classification.storageState');
  }
  // `tags` is prefilled, so an empty list genuinely means "remove them all" —
  // unlike the scalars above, [] is a meaningful value the server applies.
  const nextTags = dedupe(formData.tags ?? []);
  if (!sameTagSet(nextTags, original.tags)) {
    classification.tags = nextTags;
    changedFields.push('classification.tags');
  }
  if (Object.keys(classification).length > 0) {
    changes.classification = classification;
  }

  const productDetails: ProductDetailsInput = {};
  const primaryUpc = norm(formData.primaryUpc);
  if (primaryUpc && primaryUpc !== norm(original.primaryUpc)) {
    productDetails.primaryUpc = primaryUpc;
    changedFields.push('productDetails.primaryUpc');
  }
  if (
    formData.shelfLifeDays != null &&
    formData.shelfLifeDays !== original.shelfLifeDays
  ) {
    productDetails.shelfLifeDays = formData.shelfLifeDays;
    changedFields.push('productDetails.shelfLifeDays');
  }
  if (
    formData.shelfLifeOpenedDays != null &&
    formData.shelfLifeOpenedDays !== original.shelfLifeOpenedDays
  ) {
    productDetails.shelfLifeOpenedDays = formData.shelfLifeOpenedDays;
    changedFields.push('productDetails.shelfLifeOpenedDays');
  }
  if (Object.keys(productDetails).length > 0) {
    changes.productDetails = productDetails;
  }

  const packageInfo: PackageInfoInput = {};
  // PackageInfoInput.netWeight is a single Float but the form collects a list
  // (dual-label packaging), so only the first entry is diffable. Extra rows are
  // ignored — AddItemForm caps the list at one entry in edit modes.
  const netWeight = formData.netWeights?.[0];
  if (netWeight?.value != null && netWeight.value !== original.netWeight) {
    packageInfo.netWeight = netWeight.value;
    changedFields.push('packageInfo.netWeight');
  }
  // The unit picker leaves `unitId` undefined when the user free-types a unit
  // the catalog doesn't have, so fall back to the by-name twin, which the
  // server resolves find-or-create. An explicit id always wins. Sending the
  // name is accepted and then dropped on approval, so diffing only the id would
  // let a free-typed unit change vanish silently.
  const unitName = norm(netWeight?.unitName);
  if (netWeight?.unitId) {
    if (netWeight.unitId !== original.displayUnitId) {
      packageInfo.displayUnitId = netWeight.unitId;
      changedFields.push('packageInfo.displayUnitId');
    }
  } else if (unitName && unitName !== norm(original.displayUnitName)) {
    packageInfo.displayUnitName = unitName;
    changedFields.push('packageInfo.displayUnitName');
  }
  if (
    formData.baseDimension &&
    formData.baseDimension !== original.baseDimension
  ) {
    packageInfo.baseDimension = formData.baseDimension;
    changedFields.push('packageInfo.baseDimension');
  }
  if (Object.keys(packageInfo).length > 0) {
    changes.packageInfo = packageInfo;
  }

  // `brand` resolves brandId, else finds-or-creates by brandName — the only way
  // to name a brand that isn't in the catalog yet, so a free-typed brand is
  // expressible. It is purely additive and never removes the brand already on
  // the item, so replacing one means pairing it with brandOps.removeBrandIds.
  const brandName = norm(formData.brandName);
  const brandChanged = formData.brandId
    ? formData.brandId !== original.brandId
    : !!brandName && brandName !== norm(original.brandName);

  if (brandChanged) {
    changes.brand = formData.brandId
      ? { brandId: formData.brandId }
      : { brandName };
    changedFields.push('brand');
    if (original.brandId) {
      changes.brandOps = { removeBrandIds: [original.brandId] };
      changedFields.push('brandOps.removeBrandIds');
    }
  }

  return {
    changes,
    hasChanges: changedFields.length > 0,
    changedFields,
  };
}

/** Prefill AddItemForm from the snapshot the diff will later compare against. */
export function buildInitialDataFromSnapshot(
  snapshot: EditableItemSnapshot,
): AddItemFormInitialData {
  return {
    name: snapshot.name,
    description: snapshot.description,
    upc: snapshot.primaryUpc,
    vendor: snapshot.brandName,
    brandId: snapshot.brandId,
    brandName: snapshot.brandName,
    imageUrl: snapshot.imageUrl,
    type: snapshot.type,
    storageState: snapshot.storageState,
    shelfLifeDays: snapshot.shelfLifeDays,
    shelfLifeOpenedDays: snapshot.shelfLifeOpenedDays,
    baseDimension: snapshot.baseDimension,
    tags: snapshot.tags,
    // Only a PACKAGE weight is a package size. A SERVING or a REFERENCE
    // (100g nutrition basis) means something else entirely, so seeding it into
    // a package-size field would present it as one — and an edit would submit
    // it as one. Absent kind is treated as PACKAGE, which is what the field
    // meant before the API said otherwise.
    netWeights:
      snapshot.netWeight != null &&
      snapshot.displayUnitName &&
      (snapshot.netWeightKind ?? NetWeightKind.Package) ===
        NetWeightKind.Package
        ? [
            {
              value: snapshot.netWeight,
              unitName: snapshot.displayUnitName,
              unitId: snapshot.displayUnitId,
            },
          ]
        : undefined,
  };
}
