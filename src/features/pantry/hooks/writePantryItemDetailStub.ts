/**
 * Detail-shaped cache write for a local-first pantry create.
 *
 * `buildOptimisticPantryItem` makes the new row complete for the LIST query;
 * this makes it complete for the DETAIL ones (`GetPantryItem`,
 * `GetPantryItemBatches`). Both halves are needed: a row that is list-complete
 * and detail-incomplete shows up in the pantry and then dead-ends the moment
 * it is tapped, because Apollo serves no partial data and goes to the network
 * for an id the server does not have yet. Offline there is no recovery.
 *
 * Paired with the `Query.pantryItem` cache redirect in `cache.ts` — the
 * redirect resolves the by-id read to this entity, and the entity being
 * complete is what stops that read falling through to the wire.
 * `__tests__/apollo/optimisticEntityCompleteness.test.ts` holds both ends.
 *
 * Values are neutral, never invented: empty connections, empty lists, nulls for
 * anything the client cannot know. A brand-new item genuinely has no purchase
 * record, no usage history and no batches, so the neutral value IS the correct
 * one until the server says otherwise.
 */

import { type ApolloCache } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { Unmasked } from '@apollo/client/masking';
import type {
  AcquisitionMethod,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';
import {
  NEUTRAL_PANTRY_ITEM_DETAIL,
  NEUTRAL_ITEM_IDENTITY,
  NEUTRAL_ITEM_MEDIA,
  NEUTRAL_ITEM_PHOTOS,
  NEUTRAL_ITEM_CATALOG,
} from './pantryItemDetailNeutral.generated';
import {
  WritePantryItemDetailStub_PantryItemFragmentDoc,
  WritePantryItemDetailStub_ItemRefFragmentDoc,
  WritePantryItemDetailStub_ItemIdentityFragmentDoc,
  WritePantryItemDetailStub_ItemMediaFragmentDoc,
  WritePantryItemDetailStub_ItemPhotosFragmentDoc,
  WritePantryItemDetailStub_ItemCatalogFragmentDoc,
} from './writePantryItemDetailStub.generated';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';

/** The detail-only facts a create site can supply. All optional. */
export interface PantryItemDetailStubFields {
  /** Catalog item id. Absent for a free-text create — see {@link resolveItemId}. */
  itemId?: string | null;
  itemName: string;
  condition?: ItemCondition | null;
  acquisitionMethod?: AcquisitionMethod | null;
  tags?: string[] | null;
  storageNotes?: string | null;
  restockQuantity?: number | null;
  costPerUnit?: number | null;
  quantity?: number | null;
  brand?: { id: string; name: string } | null;
  store?: { id: string; name: string } | null;
}

/**
 * Fill in the fields of `fragment` that `Item:<id>` does not already have.
 *
 * Presence is decided per FIELD, not per fragment. A plain `readFragment`
 * returns null on a PARTIAL entity exactly as on a missing one, so treating a
 * failed read as "nothing is here" defaults the whole group — and destroys real
 * catalog data that a narrower query already fetched. `ItemByUpcFilter` is the
 * case that bites: after a scan the `Item` holds `imageUrl`, `shelfLifeDays`,
 * `shelfLifeOpenedDays` and `categories`, but neither `images` nor
 * `nutritions`, so both of those groups read as absent and every real value in
 * them was overwritten with a neutral one. Offline that never heals.
 *
 * Grouping the fragments narrows that blast radius; it cannot remove it, because
 * the boundary just moves to the group. Reading with partial data tolerated and
 * letting every present field win removes it.
 *
 * Types come from the generated fragment docs — `TypedDocumentNode<TFragment>`
 * carries the shape, so `data`, the read and the write are all checked against
 * the codegen'd type rather than an erasing `Record<string, unknown>`.
 * `Unmasked<>` appears here against the usual convention (optimisticResponse
 * returns) because it is the parameter type `cache.writeFragment` declares; the
 * alternative is the erasure this helper exists to remove.
 */
function topUpItemGroup<TFragment extends { __typename: 'Item'; id: string }>(
  cache: ApolloCache,
  itemCacheId: string,
  fragment: TypedDocumentNode<TFragment, unknown>,
  fragmentName: string,
  data: Unmasked<TFragment>,
): void {
  const existing = cache.readFragment({
    id: itemCacheId,
    fragment,
    fragmentName,
    returnPartialData: true,
  });

  // What the cache actually holds. `undefined` means the field is not cached;
  // `null` is a real value the server supplied and must be kept.
  const cached = definedFields(existing);
  const hasAbsentField = Object.keys(data).some(key => !(key in cached));

  // Every field already present: nothing to supply, and writing would only risk
  // re-normalizing what is already correct.
  if (!hasAbsentField) return;

  cache.writeFragment({
    id: itemCacheId,
    fragment,
    fragmentName,
    // Neutral values first, so anything already cached wins.
    data: { ...data, ...cached },
  });
}

/**
 * The fields of a partially-read fragment that the cache actually holds.
 *
 * `Object.fromEntries` has no way to preserve the key/value relationship, so
 * the assertion below is where that is restated — the runtime filter keeps only
 * keys of `T`, and their values are `T`'s.
 */
function definedFields<T extends object>(
  source: T | null | undefined,
): Partial<T> {
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * `PantryItem.item` is `Item!`, so there is always an entity to point at — but
 * a free-text create has no catalog id, and the builder used to write
 * `Item:''` for it. Derive a stable per-row id instead: the server mints the
 * real `Item` and its create response re-points `PantryItem.item` at it,
 * leaving this one unreferenced for `cache.gc()`.
 */
const resolveItemId = (
  pantryItemId: string,
  itemId: string | null | undefined,
): string => itemId || `local-item-${pantryItemId}`;

export function writePantryItemDetailStub(
  cache: ApolloCache,
  pantryItemId: string,
  fields: PantryItemDetailStubFields,
): void {
  const pantryItemCacheId = cache.identify({
    __typename: 'PantryItem',
    id: pantryItemId,
  });
  if (!pantryItemCacheId) return;

  const itemId = resolveItemId(pantryItemId, fields.itemId);
  const itemCacheId = cache.identify({ __typename: 'Item', id: itemId });

  if (itemCacheId) {
    topUpItemGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemIdentityFragmentDoc,
      'writePantryItemDetailStub_itemIdentity',
      // `canEdit` is viewer-scoped and unknowable offline; the derived base
      // says `false`, which only hides the photo viewer's "set as main photo".
      { ...NEUTRAL_ITEM_IDENTITY, id: itemId, name: fields.itemName },
    );
    topUpItemGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemMediaFragmentDoc,
      'writePantryItemDetailStub_itemMedia',
      { ...NEUTRAL_ITEM_MEDIA, id: itemId },
    );
    topUpItemGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemPhotosFragmentDoc,
      'writePantryItemDetailStub_itemPhotos',
      { ...NEUTRAL_ITEM_PHOTOS, id: itemId },
    );
    topUpItemGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemCatalogFragmentDoc,
      'writePantryItemDetailStub_itemCatalog',
      { ...NEUTRAL_ITEM_CATALOG, id: itemId },
    );

    // Normalizing write: converts the embedded four-field `item` stub that
    // `addToPantryItemsCache` left behind into a reference to the entity topped
    // up above, so every catalog field resolves from the canonical row.
    cache.writeFragment({
      id: pantryItemCacheId,
      fragment: WritePantryItemDetailStub_ItemRefFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemRef',
      data: {
        __typename: 'PantryItem',
        id: pantryItemId,
        item: { __typename: 'Item', id: itemId },
      },
    });
  }

  const costPerUnit = fields.costPerUnit ?? null;
  const quantity = fields.quantity ?? null;

  cache.writeFragment({
    id: pantryItemCacheId,
    fragment: WritePantryItemDetailStub_PantryItemFragmentDoc,
    fragmentName: 'writePantryItemDetailStub_pantryItem',
    data: {
      // Neutral base derived from the SDL (see
      // scripts/generate-optimistic-fillers.mjs) so a field added to the
      // fragment cannot be forgotten here — that omission is invisible until a
      // detail screen blanks offline. Only what the user actually supplied is
      // overlaid on top.
      ...NEUTRAL_PANTRY_ITEM_DETAIL,
      id: pantryItemId,
      brand: fields.brand
        ? { __typename: 'Brand', id: fields.brand.id, name: fields.brand.name }
        : null,
      store: fields.store
        ? { __typename: 'Store', id: fields.store.id, name: fields.store.name }
        : null,
      tags: fields.tags ?? [],
      storageNotes: fields.storageNotes ?? null,
      restockQuantity: fields.restockQuantity ?? null,
      // The derived base supplies the schema's resting member for these two
      // non-null enums; the create sites all know the real value.
      condition: fields.condition ?? NEUTRAL_PANTRY_ITEM_DETAIL.condition,
      acquisitionMethod:
        fields.acquisitionMethod ??
        NEUTRAL_PANTRY_ITEM_DETAIL.acquisitionMethod,
      costPerUnit,
      totalCost:
        costPerUnit !== null && quantity !== null
          ? costPerUnit * quantity
          : null,
      // A row created a moment ago has no purchase record and no usage history.
      purchase: null,
      usageRecords: {
        __typename: 'PantryItemUsageConnection',
        edges: [],
      },
    },
  });

  // Batches live in their own query. Seeding it empty is what lets the detail
  // screen render offline instead of waiting on a wire read; the field is keyed
  // on `pantryItemId` + `status`, and the screen passes only `pantryItemId`, so
  // this write lands on exactly the field it reads.
  cache.writeQuery({
    query: GetPantryItemBatchesDocument,
    variables: { pantryItemId },
    data: {
      __typename: 'Query',
      pantryItemBatchesConnection: {
        __typename: 'PantryItemBatchConnection',
        edges: [],
      },
    },
  });
}
