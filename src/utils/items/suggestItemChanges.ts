import {
  Visibility,
  type BaseDimension,
  type ItemClassificationInput,
  type ItemType,
  type PackageInfoInput,
  type ProductDetailsInput,
  type StorageState,
  type SuggestibleItemChangesInput,
} from '#/graphql/generated/schemaTypes';
import type { UseItemForEdit_ItemFragment } from '#hooks/items/useItemForEdit.generated';
import type { AddItemFormData } from './createItemMapping';
import type { AddItemFormInitialData } from '#/components/organisms/AddItemForm/AddItemForm';

/**
 * The pre-edit original — the only thing `buildSuggestibleItemChanges` diffs
 * against. Sourced exclusively from the `useItemForEdit_item` fragment.
 *
 * Never build this from `ScannedItem` or `ItemSuggestion`: both are lossy
 * projections, and a field they drop reads as "the user cleared it".
 */
export interface EditableItemSnapshot {
  id: string;
  visibility: Visibility;
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
  displayUnitId?: string;
  displayUnitName?: string;
  baseDimension?: BaseDimension;
  imageUrl?: string;
}

export type ItemEditRoute = 'suggest' | 'direct';

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
    visibility: item.visibility,
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
    displayUnitId: item.displayUnit?.id,
    displayUnitName: item.displayUnit?.name,
    baseDimension: nullableToUndefined(item.baseDimension),
    imageUrl: nullableToUndefined(item.imageUrl),
  };
}

/**
 * Whether an edit should be proposed for review or written straight through.
 *
 * `Item` exposes no ownership signal (no `createdBy`, no `createdById` filter),
 * so visibility is the only field that can route this. Known cost: a PUBLIC item
 * the user created themselves goes through review. Accepted, because the
 * alternative is worse — `suggestItemEdit` rejects any non-PUBLIC item with a
 * ValidationError regardless of ownership, so routing a user's own private item
 * to `suggest` would hard-fail. `useSuggestItemEdit` falls back to `suggest`
 * when a `direct` write comes back ForbiddenError, which absorbs a wrong guess.
 */
export function resolveItemEditRoute(
  visibility: Visibility,
  isAdmin: boolean,
): ItemEditRoute {
  if (isAdmin) return 'direct';
  return visibility === Visibility.Public ? 'suggest' : 'direct';
}

/**
 * Minimal diff of a form submission against the item as it exists today.
 *
 * Emits ONLY changed fields. Absent keys inside a sub-input are left untouched
 * by the server, so there is no need to echo unchanged siblings — and padding
 * the payload would be actively harmful: an unchanged field in `changes` reads
 * to the reviewing admin as something the contributor wants changed.
 *
 * Fields deliberately excluded, and why:
 * - `media`         — on approve, `media.imageUrl` is ignored and `media.images`
 *                     replaces every image row. Photos go live immediately via
 *                     `uploadItemImage` instead.
 * - `brand`         — silently ignored by `updateItem`; `brandOps` is the path
 *                     that actually applies.
 * - `tagOps`        — combining addTags + removeTags drops the adds, and tagOps
 *                     destructively overrides `classification.tags`. The form
 *                     prefills the full tag list, so a set-replace via
 *                     `classification.tags` is both simpler and correct.
 * - `categoryIds`   — an empty array wipes all categories, and the form has no
 *                     category editor to diff against.
 * - `unitConfig` / `unitOps` / `storeSkuOps` — no round-trippable form surface;
 *                     see the hidden fields in AddItemForm's edit modes.
 *
 * Clearing a value is not expressible: an absent key means "no change", so a
 * blanked description or UPC is ignored rather than sent as a deletion. Users
 * asking for a removal say so in the note.
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
  if (netWeight?.unitId && netWeight.unitId !== original.displayUnitId) {
    packageInfo.displayUnitId = netWeight.unitId;
    changedFields.push('packageInfo.displayUnitId');
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

  // Only an id-bearing brand is diffable: brandOps works in ids, so a
  // free-typed brand name that matched nothing in autocomplete can't be
  // expressed. AddItemForm surfaces a hint pointing those users at the note.
  if (formData.brandId && formData.brandId !== original.brandId) {
    changes.brandOps = {
      addBrandIds: [formData.brandId],
      ...(original.brandId ? { removeBrandIds: [original.brandId] } : {}),
    };
    changedFields.push('brandOps');
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
    netWeights:
      snapshot.netWeight != null && snapshot.displayUnitName
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
