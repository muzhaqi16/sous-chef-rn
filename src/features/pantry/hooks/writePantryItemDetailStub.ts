/**
 * `buildOptimisticPantryItem` completes a local-first row for the LIST query;
 * this completes it for the DETAIL ones. A list-complete but detail-incomplete
 * row dead-ends on tap: Apollo serves no partial data and goes to the wire for
 * an id the server does not have yet. Values are neutral, never invented.
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
 * Fills the fields of `fragment` that `Item:<id>` lacks, deciding presence per
 * FIELD (see {@link completeFields}): a plain `readFragment` returns null on a
 * PARTIAL entity exactly as on a missing one, so a per-fragment test defaults
 * the whole group and destroys real catalog data a narrower query fetched.
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
 * Completeness must be ASKED of the cache, not computed from returned values: a
 * `returnPartialData` read OMITS the key it cannot satisfy rather than setting it
 * `undefined`, so a `value !== undefined` filter judges partial objects whole. A
 * strict one-field `readFragment` answers for every level beneath it.
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
 * `fragment` narrowed to one field. Built by filtering the parsed AST, never by
 * re-parsing source, so no document is registered under a name it shares with
 * different content. Memoized per (group, field) pair.
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
 * `PantryItem.item` is `Item!`, but a free-text create has no catalog id, so a
 * stable per-row id stands in. The create response re-points `PantryItem.item`
 * at the server's real `Item`, leaving this one for `cache.gc()`.
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
        totalCount: 0,
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
        totalCount: 0,
        edges: [],
      },
    },
  });
}
