import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  heldBrandVersion,
  readBrandList,
} from '#features/profile/cache/brandLists';
import type {
  AddBrandInputs,
  CreateBrandListInputs,
  RemoveBrandInputs,
} from '#features/profile/offline/localWrites';
import {
  AddBrandToListDocument,
  BrandListsDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
  UpdateBrandListDocument,
  type BrandListsQuery,
} from './useBrandLists.generated';

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
    const inputs: CreateBrandListInputs = { name };
    const settled = await pendingWritesOf(client.cache).send(
      CreateBrandListDocument,
      { input: { id, name, enabled: true } },
      write =>
        settleMutation(() => createMutation(write), {
          document: CreateBrandListDocument,
          fallback: t('brandLists.errors.createFailed'),
        }),
      inputs,
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
    if (!readBrandList(client.cache, id)) return false;
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'BrandList', id },
      fields,
      variables: { input: { id, ...fields } },
      mutate: updateMutation,
      settle: {
        document: UpdateBrandListDocument,
        fallback: t('brandLists.errors.updateFailed'),
      },
    });
    return settled.status !== 'failed';
  };

  const deleteList = async (id: string): Promise<boolean> => {
    const settled = await pendingWritesOf(client.cache).send(
      DeleteBrandListDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteMutation(write), {
          document: DeleteBrandListDocument,
          fallback: t('brandLists.errors.deleteFailed'),
        }),
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
    const list = readBrandList(client.cache, listId);
    if (!list) return false;
    if (list.entries.some(entry => entry.brand.id === brand.id)) return true;
    const id = generateEntityId();
    const inputs: AddBrandInputs = {
      listId,
      entry: {
        __typename: 'BrandListEntry',
        id,
        reason,
        version: 0,
        brand: {
          __typename: 'Brand',
          id: brand.id,
          name: brand.name,
          version: heldBrandVersion(client.cache, brand.id),
        },
      },
    };
    const settled = await pendingWritesOf(client.cache).send(
      AddBrandToListDocument,
      { input: { id, brandListId: listId, brandId: brand.id, reason } },
      write =>
        settleMutation(() => addMutation(write), {
          document: AddBrandToListDocument,
          fallback: t('brandLists.errors.addFailed'),
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  const removeBrand = async (
    listId: string,
    entryId: string,
  ): Promise<boolean> => {
    if (!readBrandList(client.cache, listId)) return false;
    const inputs: RemoveBrandInputs = { listId };
    const settled = await pendingWritesOf(client.cache).send(
      RemoveBrandFromListDocument,
      { input: { id: entryId } },
      write =>
        settleMutation(() => removeMutation(write), {
          document: RemoveBrandFromListDocument,
          fallback: t('brandLists.errors.removeFailed'),
        }),
      inputs,
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
