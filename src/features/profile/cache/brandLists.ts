import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import {
  BrandListsDocument,
  UseBrandLists_HeldBrandFragmentDoc,
  UseBrandLists_RowFragmentDoc,
  type UseBrandLists_RowFragment,
} from '#features/profile/hooks/useBrandLists.generated';
import {
  NEUTRAL_LOCAL_BRAND_LIST,
  NEUTRAL_LOCAL_BRAND_LIST_BY_TYPE,
} from '#features/profile/hooks/useBrandListsNeutral.generated';

type ListRow = Unmasked<UseBrandLists_RowFragment>;

/** One brand on a list, as the device shows it before the server answers. */
export type LocalBrandEntry = ListRow['entries'][number];

const rowId = (cache: ApolloCache, id: string) =>
  cache.identify({ __typename: 'BrandList', id });

export function readBrandList(cache: ApolloCache, id: string): ListRow | null {
  const cacheId = rowId(cache, id);
  return cacheId
    ? cache.readFragment<ListRow>({
        id: cacheId,
        fragment: UseBrandLists_RowFragmentDoc,
        fragmentName: 'useBrandLists_row',
        optimistic: true,
      })
    : null;
}

/** The brand's version as the cache holds it; 0 for one it has never read. */
export function heldBrandVersion(cache: ApolloCache, brandId: string): number {
  const cacheId = cache.identify({ __typename: 'Brand', id: brandId });
  const held = cacheId
    ? cache.readFragment({
        id: cacheId,
        fragment: UseBrandLists_HeldBrandFragmentDoc,
        fragmentName: 'useBrandLists_heldBrand',
        optimistic: true,
      })
    : null;
  return held?.version ?? 0;
}

/** Rewrites a list's entries as the cache holds them now; nothing when it is gone. */
export function changeBrandEntries(
  cache: ApolloCache,
  id: string,
  change: (entries: ListRow['entries']) => ListRow['entries'],
): void {
  const row = readBrandList(cache, id);
  const cacheId = rowId(cache, id);
  if (!row || !cacheId) return;
  cache.writeFragment<ListRow>({
    id: cacheId,
    fragment: UseBrandLists_RowFragmentDoc,
    fragmentName: 'useBrandLists_row',
    data: { ...row, entries: change(row.entries) },
  });
}

/** Puts a held list last in the user's lists; one already there stays put. */
export function listBrandList(cache: ApolloCache, id: string): void {
  const row = readBrandList(cache, id);
  if (!row) return;
  cache.updateQuery({ query: BrandListsDocument }, data => {
    if (!data || data.brandLists.some(list => list.id === row.id)) return data;
    return { ...data, brandLists: [...data.brandLists, row] };
  });
}

export function dropBrandList(cache: ApolloCache, id: string): void {
  cache.updateQuery({ query: BrandListsDocument }, data =>
    data
      ? {
          ...data,
          brandLists: data.brandLists.filter(list => list.id !== id),
        }
      : data,
  );
}

/** Writes a new list, switched on, and lists it. */
export function writeLocalBrandList(
  cache: ApolloCache,
  id: string,
  name: string,
): void {
  writeLocalEntity(cache, {
    fragment: UseBrandLists_RowFragmentDoc,
    fragmentName: 'useBrandLists_row',
    neutral: NEUTRAL_LOCAL_BRAND_LIST,
    neutralByType: NEUTRAL_LOCAL_BRAND_LIST_BY_TYPE,
    known: { __typename: 'BrandList', id, name, enabled: true },
  });
  listBrandList(cache, id);
}
