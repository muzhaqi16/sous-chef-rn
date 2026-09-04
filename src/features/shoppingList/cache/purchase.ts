/**
 * The purchase stamp. `ShoppingListItem.purchaseInfo` carries a write-time
 * invariant in its merge policy, which `cache.modify` does not run — so it is
 * written through `cache.writeFragment` here and nowhere else.
 */

import { gql, isReference, type ApolloCache } from '@apollo/client';
import { Kind, type DocumentNode, type FragmentDefinitionNode } from 'graphql';

export interface PurchaseInfoPatch {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
}

/**
 * The stamp a cached line already carries, or null — the read counterpart to
 * {@link writePurchaseInfo}, so a caller deciding whether to stamp a line never
 * reaches into the record itself.
 */
export function readMovedToPantryAt(
  cache: ApolloCache,
  itemId: string,
): string | null {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return null;
  return (
    cache.readFragment<{ purchaseInfo?: { movedToPantryAt?: string | null } }>({
      id: cacheId,
      fragment: gql`
        fragment _MovedToPantryAt on ShoppingListItem {
          purchaseInfo {
            movedToPantryAt
          }
        }
      `,
      fragmentName: '_MovedToPantryAt',
    })?.purchaseInfo?.movedToPantryAt ?? null
  );
}

/**
 * Every field of `ShoppingListItemPurchaseInfo`; must stay complete against the
 * SDL, which `__tests__/graphql/purchaseInfoWriterCoversType.test.ts` enforces —
 * a field missing here is one a local write silently drops.
 */
const PURCHASE_INFO_FIELDS = `
      __typename
      isPurchased
      movedToPantryAt
      purchaseDate
      purchasedById
      purchasedPrice
      purchasedQuantity
      purchasedBy {
        __typename
        id
      }`;

/** The row's purchase record as this module reads and writes it. */
const PURCHASE_INFO_FRAGMENT = gql`
  fragment _WritePurchaseInfo on ShoppingListItem {
    __typename
    id
    purchaseInfo {${PURCHASE_INFO_FIELDS}
    }
  }
`;

const PURCHASE_INFO_WITH_UPDATED_AT_FRAGMENT = gql`
  fragment _WritePurchaseInfoWithUpdatedAt on ShoppingListItem {
    __typename
    id
    updatedAt
    purchaseInfo {${PURCHASE_INFO_FIELDS}
    }
  }
`;

/** The purchase record's own fields, as read from the cache. */
type CachedPurchaseInfo = Record<string, unknown> & {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
};

/**
 * The ONLY writer of `ShoppingListItem.purchaseInfo`. Its type policy CLEARS every
 * field a write omits whenever `isPurchased` changes, so a write asserting a flag
 * it does not own destroys the record; and `movedToPantryAt` is derived from the
 * flag, so a local flip must clear the stamp. Callers say only what they change.
 */
export function writePurchaseInfo(
  cache: ApolloCache,
  itemId: string,
  patch: PurchaseInfoPatch,
  options: { updatedAt?: string; restoring?: boolean } = {},
): void {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return;

  const existing = cache.readFragment<{
    purchaseInfo?: CachedPurchaseInfo | null;
  }>({
    id: cacheId,
    fragment: PURCHASE_INFO_FRAGMENT,
    fragmentName: '_WritePurchaseInfo',
    returnPartialData: true,
  })?.purchaseInfo;

  // A value object with no key fields is never stored as a reference, but the
  // read's type admits one and spreading it would write `__ref` over the record.
  const cached: CachedPurchaseInfo | undefined = isReference(existing)
    ? undefined
    : existing ?? undefined;

  const wasPurchased = cached?.isPurchased ?? false;
  // Only a caller that names the flag may change it. Everything else leaves it
  // exactly as cached.
  const nextPurchased = patch.isPurchased ?? wasPurchased;
  const flipped = nextPurchased !== wasPurchased;

  const stamp = resolveStamp({
    patch,
    cached: cached?.movedToPantryAt ?? null,
    flipped,
    restoring: options.restoring === true,
  });

  // `writeFragment`, not `cache.modify`: modify runs no type-policy merge and
  // cannot introduce a field the record lacks. Every cached field is written back
  // explicitly, so the policy's clear-on-flip has nothing to clear on a LOCAL
  // write — the amounts belong to the purchase the server recorded.
  const purchaseInfo = {
    ...carriedForward(cached),
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: nextPurchased,
    movedToPantryAt: stamp,
  };

  // The fragment is narrowed to what is being written, not to what the type
  // has — see {@link purchaseInfoWriteFragment}.
  const written = purchaseInfoWriteFragment(
    Object.keys(purchaseInfo),
    options.updatedAt !== undefined,
  );

  cache.writeFragment({
    id: cacheId,
    fragment: written.doc,
    fragmentName: written.name,
    data: {
      __typename: 'ShoppingListItem',
      id: itemId,
      ...(options.updatedAt === undefined
        ? {}
        : { updatedAt: options.updatedAt }),
      purchaseInfo,
    },
  });
}

/**
 * The record's other fields, exactly as cached. A field the cache does not hold is
 * left OUT rather than written as null: the write must not invent a value, and an
 * absent key is one the policy has nothing to clear either.
 */
function carriedForward(
  cached: CachedPurchaseInfo | undefined,
): Record<string, unknown> {
  if (!cached) return {};
  const carried: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(cached)) {
    if (field === '__typename') continue;
    if (field === 'isPurchased' || field === 'movedToPantryAt') continue;
    if (value === undefined) continue;
    carried[field] = value;
  }
  return carried;
}

/**
 * The write fragment narrowed to exactly the fields a write supplies:
 * `writeFragment` reports every field its fragment SELECTS and the data OMITS, and
 * the record's cached shape is whatever the READING operation selected. The store
 * outcome is unchanged — Apollo drops a missing field BEFORE the merge runs.
 */
const purchaseInfoWriteDocs = new Map<
  string,
  { doc: DocumentNode; name: string }
>();

// Built by filtering the read fragment's AST rather than a second field list, so
// the two cannot drift. Each field set gets its own NAME: Apollo caches a parsed
// document by name, and two documents sharing one would serve each other's
// selections.
function purchaseInfoWriteFragment(
  fields: readonly string[],
  withUpdatedAt: boolean,
): { doc: DocumentNode; name: string } {
  const baseName = withUpdatedAt
    ? '_WritePurchaseInfoWithUpdatedAt'
    : '_WritePurchaseInfo';
  const kept = new Set(fields);
  const name = `${baseName}_${fields
    .filter(field => field !== '__typename')
    .sort()
    .join('_')}`;

  const memo = purchaseInfoWriteDocs.get(name);
  if (memo) return memo;

  const source = withUpdatedAt
    ? PURCHASE_INFO_WITH_UPDATED_AT_FRAGMENT
    : PURCHASE_INFO_FRAGMENT;
  const definition = source.definitions.find(
    (node): node is FragmentDefinitionNode =>
      node.kind === Kind.FRAGMENT_DEFINITION && node.name.value === baseName,
  );
  // The read fragment is a module-scope literal, so this cannot miss. Falling
  // back to it whole rather than throwing keeps a write correct if it ever did.
  if (!definition) return { doc: source, name: baseName };

  const built = {
    name,
    doc: {
      ...source,
      definitions: [
        {
          ...definition,
          name: { ...definition.name, value: name },
          selectionSet: {
            ...definition.selectionSet,
            selections: definition.selectionSet.selections.map(selection =>
              selection.kind === Kind.FIELD &&
              selection.name.value === 'purchaseInfo' &&
              selection.selectionSet
                ? {
                    ...selection,
                    selectionSet: {
                      ...selection.selectionSet,
                      selections: selection.selectionSet.selections.filter(
                        sub =>
                          sub.kind === Kind.FIELD &&
                          (sub.name.value === '__typename' ||
                            kept.has(sub.name.value)),
                      ),
                    },
                  }
                : selection,
            ),
          },
        },
      ],
    },
  };

  purchaseInfoWriteDocs.set(name, built);
  return built;
}

/**
 * The stamp a write should leave behind. Restoring is not flipping: a revert
 * re-asserts the flag the row had before the user touched it, which looks like a
 * flip from the cache's side. The server never saw the change, so it still holds
 * the stamp, and clearing it would re-offer a move-to-pantry already done.
 */
function resolveStamp({
  patch,
  cached,
  flipped,
  restoring,
}: {
  patch: PurchaseInfoPatch;
  cached: string | null;
  flipped: boolean;
  restoring: boolean;
}): string | null {
  if (restoring) {
    return patch.movedToPantryAt !== undefined ? patch.movedToPantryAt : cached;
  }
  if (flipped) return null;
  if (patch.movedToPantryAt !== undefined) return patch.movedToPantryAt;
  return cached;
}

/**
 * Does `storeFieldName`'s serialized keyArgs carry `key: value`? Apollo encodes
 * them as `itemsConnection:{"filters":{"isPurchased":true}}`.
 */
