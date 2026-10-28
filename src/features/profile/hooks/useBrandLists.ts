import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { useTranslation } from '#/i18n';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import {
  AddBrandToListDocument,
  BrandListsDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
  UpdateBrandListDocument,
  UseBrandLists_RowFragmentDoc,
  type BrandListsQuery,
  type UseBrandLists_RowFragment,
} from './useBrandLists.generated';
import {
  NEUTRAL_LOCAL_BRAND_LIST,
  NEUTRAL_LOCAL_BRAND_LIST_BY_TYPE,
} from './useBrandListsNeutral.generated';

/** One of the user's lists, as the screens and the scan card show it. */
export interface BrandListView {
  id: string;
  name: string;
  enabled: boolean;
  brands: {
    entryId: string;
    brandId: string;
    name: string;
    reason: string | null;
  }[];
}

type ListRow = Unmasked<UseBrandLists_RowFragment>;

const toView = (
  list: BrandListsQuery['brandLists'][number],
): BrandListView => ({
  id: list.id,
  name: list.name,
  enabled: list.enabled,
  brands: list.entries.map(entry => ({
    entryId: entry.id,
    brandId: entry.brand.id,
    name: entry.brand.name,
    reason: entry.reason,
  })),
});

const rowId = (cache: ApolloCache, id: string) =>
  cache.identify({ __typename: 'BrandList', id });

function readRow(cache: ApolloCache, id: string): ListRow | null {
  const cacheId = rowId(cache, id);
  return cacheId
    ? cache.readFragment<ListRow>({
        id: cacheId,
        fragment: UseBrandLists_RowFragmentDoc,
        fragmentName: 'useBrandLists_row',
      })
    : null;
}

function writeRow(cache: ApolloCache, row: ListRow): void {
  const cacheId = rowId(cache, row.id);
  if (!cacheId) return;
  cache.writeFragment<ListRow>({
    id: cacheId,
    fragment: UseBrandLists_RowFragmentDoc,
    fragmentName: 'useBrandLists_row',
    data: row,
  });
}

/**
 * Rewrites a list as the cache holds it now, so undoing one write keeps any
 * other made since; nothing when the list is gone.
 */
function updateRow(
  cache: ApolloCache,
  id: string,
  change: (row: ListRow) => ListRow,
): void {
  const row = readRow(cache, id);
  if (row) writeRow(cache, change(row));
}

/** Puts a list in the user's lists, at `index` or last; a held one stays put. */
function insertList(cache: ApolloCache, row: ListRow, index?: number): void {
  cache.updateQuery({ query: BrandListsDocument }, data => {
    if (!data || data.brandLists.some(list => list.id === row.id)) return data;
    const lists = [...data.brandLists];
    lists.splice(index ?? lists.length, 0, row);
    return { ...data, brandLists: lists };
  });
}

function dropList(cache: ApolloCache, id: string): void {
  cache.updateQuery({ query: BrandListsDocument }, data =>
    data
      ? {
          ...data,
          brandLists: data.brandLists.filter(list => list.id !== id),
        }
      : data,
  );
}

/**
 * The user's own brand lists and their writes. Every write lands in the cache
 * first and queues offline, so a list can be built in a store with no signal.
 * A reader that mounts per scan reads `cache-first`: the lists move only by
 * this user's own writes, and a resync refreshes what is held.
 */
export function useBrandLists({
  fetchPolicy,
}: { fetchPolicy?: 'cache-first' } = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { data } = useQuery(
    BrandListsDocument,
    fetchPolicy ? { fetchPolicy } : {},
  );
  const [createMutation] = useMutation(CreateBrandListDocument, {
    context: { localFirst: true },
  });
  const [updateMutation] = useMutation(UpdateBrandListDocument, {
    context: { localFirst: true },
  });
  const [deleteMutation] = useMutation(DeleteBrandListDocument, {
    context: { localFirst: true },
  });
  const [addMutation] = useMutation(AddBrandToListDocument, {
    context: { localFirst: true },
  });
  const [removeMutation] = useMutation(RemoveBrandFromListDocument, {
    context: { localFirst: true },
  });

  /** Makes a list, switched on; resolves its id, or null when refused. */
  const createList = async (name: string): Promise<string | null> => {
    const id = generateEntityId();
    try {
      writeLocalEntity(client.cache, {
        fragment: UseBrandLists_RowFragmentDoc,
        fragmentName: 'useBrandLists_row',
        neutral: NEUTRAL_LOCAL_BRAND_LIST,
        neutralByType: NEUTRAL_LOCAL_BRAND_LIST_BY_TYPE,
        known: { __typename: 'BrandList', id, name, enabled: true },
      });
      const row = readRow(client.cache, id);
      if (row) insertList(client.cache, row);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Brand List (local)',
      });
    }
    const settled = await settleMutation(
      () =>
        createMutation({ variables: { input: { id, name, enabled: true } } }),
      {
        document: CreateBrandListDocument,
        fallback: t('brandLists.errors.createFailed'),
        onFailed: () => dropList(client.cache, id),
      },
    );
    return settled.status === 'failed' ? null : id;
  };

  /**
   * Renames or switches a list. No `version`: one person's own list, replayed
   * in order, ends where they left it, and two offline toggles would otherwise
   * share one stale version and the second be refused.
   */
  const updateList = async (
    id: string,
    fields: { name?: string; enabled?: boolean },
  ): Promise<boolean> => {
    const before = readRow(client.cache, id);
    if (!before) return false;
    writeRow(client.cache, { ...before, ...fields });
    // Only the fields this write changed go back on a refusal.
    const restored: Partial<ListRow> = {};
    if (fields.name !== undefined) restored.name = before.name;
    if (fields.enabled !== undefined) restored.enabled = before.enabled;
    const settled = await settleMutation(
      () => updateMutation({ variables: { input: { id, ...fields } } }),
      {
        document: UpdateBrandListDocument,
        fallback: t('brandLists.errors.updateFailed'),
        onFailed: () =>
          updateRow(client.cache, id, row => ({ ...row, ...restored })),
      },
    );
    return settled.status !== 'failed';
  };

  const deleteList = async (id: string): Promise<boolean> => {
    const index = data?.brandLists.findIndex(list => list.id === id) ?? -1;
    const before = readRow(client.cache, id);
    dropList(client.cache, id);
    const settled = await settleMutation(
      () => deleteMutation({ variables: { input: { id } } }),
      {
        document: DeleteBrandListDocument,
        fallback: t('brandLists.errors.deleteFailed'),
        onFailed: () => {
          if (before) insertList(client.cache, before, Math.max(index, 0));
        },
      },
    );
    return settled.status !== 'failed';
  };

  /**
   * Adds a catalog brand to a list under a client-minted entry id. A brand the
   * list already holds is left as it is; the payload's list settles which
   * entry the server kept.
   */
  const addBrand = async (
    listId: string,
    brand: { id: string; name: string },
    reason: string | null,
  ): Promise<boolean> => {
    const before = readRow(client.cache, listId);
    if (!before) return false;
    if (before.entries.some(entry => entry.brand.id === brand.id)) return true;
    const id = generateEntityId();
    writeRow(client.cache, {
      ...before,
      entries: [
        ...before.entries,
        {
          __typename: 'BrandListEntry',
          id,
          reason,
          version: 0,
          brand: { __typename: 'Brand', id: brand.id, name: brand.name },
        },
      ],
    });
    const settled = await settleMutation(
      () =>
        addMutation({
          variables: {
            input: { id, brandListId: listId, brandId: brand.id, reason },
          },
        }),
      {
        document: AddBrandToListDocument,
        fallback: t('brandLists.errors.addFailed'),
        onFailed: () =>
          updateRow(client.cache, listId, row => ({
            ...row,
            entries: row.entries.filter(entry => entry.id !== id),
          })),
      },
    );
    return settled.status !== 'failed';
  };

  const removeBrand = async (
    listId: string,
    entryId: string,
  ): Promise<boolean> => {
    const before = readRow(client.cache, listId);
    if (!before) return false;
    const index = before.entries.findIndex(entry => entry.id === entryId);
    const removed = before.entries[index];
    writeRow(client.cache, {
      ...before,
      entries: before.entries.filter(entry => entry.id !== entryId),
    });
    const settled = await settleMutation(
      () => removeMutation({ variables: { input: { id: entryId } } }),
      {
        document: RemoveBrandFromListDocument,
        fallback: t('brandLists.errors.removeFailed'),
        onFailed: () => {
          if (!removed) return;
          updateRow(client.cache, listId, row => {
            if (row.entries.some(entry => entry.id === entryId)) return row;
            const entries = [...row.entries];
            entries.splice(Math.min(index, entries.length), 0, removed);
            return { ...row, entries };
          });
        },
      },
    );
    return settled.status !== 'failed';
  };

  return {
    lists: data?.brandLists.map(toView) ?? [],
    /** True once the lists have been read, from the network or the cache. */
    loaded: !!data,
    createList,
    renameList: (id: string, name: string) => updateList(id, { name }),
    setEnabled: (id: string, enabled: boolean) => updateList(id, { enabled }),
    deleteList,
    addBrand,
    removeBrand,
  };
}
