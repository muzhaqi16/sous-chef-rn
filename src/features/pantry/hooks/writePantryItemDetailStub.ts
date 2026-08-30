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
import { Kind, type DocumentNode, type FragmentDefinitionNode } from 'graphql';
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
  NEUTRAL_UNIT,
} from './pantryItemDetailNeutral.generated';
import {
  WritePantryItemDetailStub_PantryItemFragmentDoc,
  WritePantryItemDetailStub_ItemRefFragmentDoc,
  WritePantryItemDetailStub_ItemIdentityFragmentDoc,
  WritePantryItemDetailStub_ItemMediaFragmentDoc,
  WritePantryItemDetailStub_ItemPhotosFragmentDoc,
  WritePantryItemDetailStub_ItemCatalogFragmentDoc,
  WritePantryItemDetailStub_UnitFragmentDoc,
  WritePantryItemDetailStub_UnitRefFragmentDoc,
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
 * the boundary just moves to the group. Asking the cache, field by field, which
 * fields it can satisfy IN FULL removes it — see {@link completeFields}.
 *
 * Types come from the generated fragment docs — `TypedDocumentNode<TFragment>`
 * carries the shape, so `data`, the read and the write are all checked against
 * the codegen'd type rather than an erasing `Record<string, unknown>`.
 * `Unmasked<>` appears here against the usual convention (optimisticResponse
 * returns) because it is the parameter type `cache.writeFragment` declares; the
 * alternative is the erasure this helper exists to remove.
 */
function topUpEntityGroup<TFragment extends { __typename: string; id: string }>(
  cache: ApolloCache,
  entityCacheId: string,
  fragment: TypedDocumentNode<TFragment, unknown>,
  fragmentName: string,
  data: Unmasked<TFragment>,
): void {
  // The completeness test is the all-or-nothing read itself, not a scan of
  // top-level keys. A key-presence check sees only the surface: an `Item` whose
  // `categories` were cached by a narrower selection (no `isPrimary`) has the
  // key, so the group read as complete and the partially-cached nested object
  // was written straight back — leaving the read incomplete forever. Asking the
  // cache whether the whole selection resolves answers for every level.
  const complete = cache.readFragment({
    id: entityCacheId,
    fragment,
    fragmentName,
  });
  if (complete) return;

  // What the cache actually holds, judged one field at a time by the cache
  // itself. Anything it can satisfy in full wins over the neutral default.
  const cached = completeFields(cache, entityCacheId, fragment, fragmentName);

  cache.writeFragment({
    id: entityCacheId,
    fragment,
    fragmentName,
    // Neutral values first, so anything already cached wins.
    data: { ...data, ...cached },
  });
}

/**
 * The fields of `fragment` the cache can satisfy IN FULL, read one at a time.
 *
 * Completeness has to be asked of the cache, not computed from the values it
 * returns. A `returnPartialData` read OMITS the key it cannot satisfy rather
 * than setting it `undefined`, so a filter written as `value !== undefined`
 * judges every partially-cached nested object whole — and writing one back
 * re-states the incompleteness instead of repairing it, which is the exact case
 * the comment above says this fixed. Verified against the installed Apollo:
 * `node scripts/probe-apollo-cache-shapes.mjs`.
 *
 * A strict `readFragment` of ONE field answers for every level beneath it,
 * because all-or-nothing is what the later read will apply too. `null` still
 * reads complete, so a genuinely-null value the server supplied is kept as a
 * value rather than mistaken for a hole.
 *
 * The trade, deliberately: a nested value the cache holds only partially is
 * dropped in favour of the neutral default. It is the one value that cannot be
 * written back — keeping it leaves EVERY read of this entity failing, which
 * offline means a permanently blank detail screen, against losing one field
 * that the create response will supply. Preserving it instead would mean
 * completing it, which needs a neutral for the nested element and so a change
 * to `scripts/generate-optimistic-fillers.mjs`.
 */
function completeFields<TFragment extends { __typename: string; id: string }>(
  cache: ApolloCache,
  entityCacheId: string,
  fragment: TypedDocumentNode<TFragment, unknown>,
  fragmentName: string,
): Partial<Unmasked<TFragment>> {
  const out: Record<string, unknown> = {};

  for (const responseKey of topLevelResponseKeys(fragment, fragmentName)) {
    const narrowed = singleFieldFragment(fragment, fragmentName, responseKey);
    if (!narrowed) continue;

    const read = cache.readFragment<Record<string, unknown>>({
      id: entityCacheId,
      fragment: narrowed.doc,
      fragmentName: narrowed.name,
    });
    if (read && responseKey in read) out[responseKey] = read[responseKey];
  }

  return out as Partial<Unmasked<TFragment>>;
}

/** Response keys (alias, else field name) of `fragmentName`'s own selections. */
function topLevelResponseKeys(
  fragment: DocumentNode,
  fragmentName: string,
): string[] {
  const definition = findFragmentDefinition(fragment, fragmentName);
  if (!definition) return [];
  const keys: string[] = [];
  for (const selection of definition.selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const key = selection.alias?.value ?? selection.name.value;
    if (key !== '__typename') keys.push(key);
  }
  return keys;
}

function findFragmentDefinition(
  fragment: DocumentNode,
  fragmentName: string,
): FragmentDefinitionNode | undefined {
  return fragment.definitions.find(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      definition.name.value === fragmentName,
  );
}

/**
 * `fragment` narrowed to a single field, for a per-field completeness read.
 *
 * Built by filtering the already-parsed AST rather than by re-parsing source,
 * so no document is registered under a name it shares with different content —
 * see `writeEntityFields` for the same constraint. Memoized: these are fixed at
 * module scope, so each (group, field) pair is built once per process.
 */
const singleFieldDocs = new Map<
  string,
  { doc: DocumentNode; name: string } | null
>();

function singleFieldFragment(
  fragment: DocumentNode,
  fragmentName: string,
  responseKey: string,
): { doc: DocumentNode; name: string } | null {
  const memoKey = `${fragmentName}.${responseKey}`;
  const memo = singleFieldDocs.get(memoKey);
  if (memo !== undefined) return memo;

  const definition = findFragmentDefinition(fragment, fragmentName);
  const selection = definition?.selectionSet.selections.find(
    sel =>
      sel.kind === Kind.FIELD &&
      (sel.alias?.value ?? sel.name.value) === responseKey,
  );

  let built: { doc: DocumentNode; name: string } | null = null;
  if (definition && selection) {
    const name = `${fragmentName}__${responseKey}`;
    built = {
      name,
      doc: {
        ...fragment,
        definitions: [
          // Any sibling definitions stay, so a spread inside the kept field
          // still resolves. These fragments are flat today; this does not
          // depend on that.
          ...fragment.definitions.filter(d => d !== definition),
          {
            ...definition,
            name: { ...definition.name, value: name },
            selectionSet: {
              ...definition.selectionSet,
              selections: [selection],
            },
          },
        ],
      },
    };
  }

  singleFieldDocs.set(memoKey, built);
  return built;
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

/**
 * The id of the Unit the optimistic builder just linked, or null when the row
 * has none. Tolerates partial data — the row is mid-materialization here, so an
 * all-or-nothing read would report "no unit" for every one of them.
 */
function readWrittenUnitId(
  cache: ApolloCache,
  pantryItemCacheId: string,
): string | null {
  const row = cache.readFragment<{ unit?: { id?: string } | null }>({
    id: pantryItemCacheId,
    fragment: WritePantryItemDetailStub_UnitRefFragmentDoc,
    fragmentName: 'writePantryItemDetailStub_unitRef',
    returnPartialData: true,
  });
  return row?.unit?.id ?? null;
}

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
    topUpEntityGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemIdentityFragmentDoc,
      'writePantryItemDetailStub_itemIdentity',
      // `canEdit` is viewer-scoped and unknowable offline; the derived base
      // says `false`, which only hides the photo viewer's "set as main photo".
      { ...NEUTRAL_ITEM_IDENTITY, id: itemId, name: fields.itemName },
    );
    topUpEntityGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemMediaFragmentDoc,
      'writePantryItemDetailStub_itemMedia',
      { ...NEUTRAL_ITEM_MEDIA, id: itemId },
    );
    topUpEntityGroup(
      cache,
      itemCacheId,
      WritePantryItemDetailStub_ItemPhotosFragmentDoc,
      'writePantryItemDetailStub_itemPhotos',
      { ...NEUTRAL_ITEM_PHOTOS, id: itemId },
    );
    topUpEntityGroup(
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

  // The tracking Unit gets the same treatment as the catalog Item. The
  // optimistic builder embeds it with the five fields the LIST query selects
  // while the detail selects eleven — and an incomplete NESTED entity makes the
  // whole `GetPantryItem` read incomplete, so a create carrying a unit left the
  // detail screen blank offline for the rest of the session. It bit precisely
  // when the Unit was well cached, which is why no bare-create test saw it.
  const unitId = readWrittenUnitId(cache, pantryItemCacheId);
  const unitCacheId = unitId
    ? cache.identify({ __typename: 'Unit', id: unitId })
    : null;
  if (unitCacheId && unitId) {
    topUpEntityGroup(
      cache,
      unitCacheId,
      WritePantryItemDetailStub_UnitFragmentDoc,
      'writePantryItemDetailStub_unit',
      { ...NEUTRAL_UNIT, id: unitId },
    );

    // Topping up `Unit:<id>` is only half of it. `toReference(item, true)`
    // normalizes the top-level PantryItem and leaves nested objects EMBEDDED,
    // so the detail read resolves `unit` off the row's own five-field copy and
    // never reaches the entity just repaired. This normalizing write converts
    // the embedded object into a reference — the same move
    // `writePantryItemDetailStub_itemRef` makes for `item`.
    cache.writeFragment({
      id: pantryItemCacheId,
      fragment: WritePantryItemDetailStub_UnitRefFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_unitRef',
      data: {
        __typename: 'PantryItem',
        id: pantryItemId,
        unit: { __typename: 'Unit', id: unitId },
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
