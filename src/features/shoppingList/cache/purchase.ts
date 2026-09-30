/**
 * The purchase stamp. `ShoppingListItem.purchaseInfo` carries a write-time
 * invariant in its merge policy, which `cache.modify` does not run — so it is
 * written through `cache.writeFragment` here and nowhere else.
 */

import type { ApolloCache, Cache } from '@apollo/client';
import type { DeepPartial } from '@apollo/client/utilities';
import {
  Purchase_WriteFragmentDoc,
  Purchase_WriteWithUpdatedAtFragmentDoc,
  type Purchase_WriteFragment,
  type Purchase_WriteWithUpdatedAtFragment,
} from './purchase.generated';

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
  return readHeldPurchaseInfo(cache, cacheId)?.movedToPantryAt ?? null;
}

/** What the record holds, partial by contract: a line may lack either field. */
function readHeldPurchaseInfo(cache: ApolloCache, cacheId: string) {
  const held: DeepPartial<Purchase_WriteFragment> | null = cache.readFragment({
    id: cacheId,
    fragment: Purchase_WriteFragmentDoc,
    returnPartialData: true,
  });
  return held?.purchaseInfo;
}

/** What {@link writePurchaseInfo} writes: `updatedAt` only when given. */
type PurchaseInfoWrite = Omit<
  Purchase_WriteWithUpdatedAtFragment,
  'updatedAt' | ' $fragmentName'
> & { updatedAt?: string };

/**
 * The ONLY writer of `ShoppingListItem.purchaseInfo`. Its type policy CLEARS every
 * field a server write omits whenever `isPurchased` changes; this write is marked
 * `extensions.local`, which the policy merges field-wise instead, so the amounts
 * the server recorded survive a local flip. `movedToPantryAt` is derived from the
 * flag, so a local flip clears the stamp. Callers say only what they change.
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

  const cached = readHeldPurchaseInfo(cache, cacheId);

  const wasPurchased = cached?.isPurchased ?? false;
  // Only a caller that names the flag may change it. Everything else leaves it
  // exactly as cached.
  const nextPurchased = patch.isPurchased ?? wasPurchased;

  const stamp = resolveStamp({
    patch,
    cached: cached?.movedToPantryAt ?? null,
    flipped: nextPurchased !== wasPurchased,
    restoring: options.restoring === true,
  });

  // `writeFragment`, not `cache.modify`: modify runs no type-policy merge and
  // cannot introduce a field the record lacks. Its options type omits
  // `extensions`, but it passes them to `write`, which hands them to the merge.
  const withUpdatedAt = options.updatedAt !== undefined;
  const write: Cache.WriteFragmentOptions<PurchaseInfoWrite, never> &
    Pick<Cache.WriteOptions, 'extensions'> = {
    id: cacheId,
    fragment: withUpdatedAt
      ? Purchase_WriteWithUpdatedAtFragmentDoc
      : Purchase_WriteFragmentDoc,
    data: {
      __typename: 'ShoppingListItem',
      id: itemId,
      ...(withUpdatedAt ? { updatedAt: options.updatedAt } : {}),
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: nextPurchased,
        movedToPantryAt: stamp,
      },
    },
    extensions: { local: true },
  };
  cache.writeFragment(write);
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
