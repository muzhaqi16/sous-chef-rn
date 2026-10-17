import { useApolloClient, useMutation } from '@apollo/client/react';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import type { CreateStoreInput } from '#/graphql/generated/schemaTypes';
import {
  CreateStoreDocument,
  UseCreateStore_RowFragmentDoc,
} from './useCreateStore.generated';
import {
  NEUTRAL_LOCAL_STORE,
  NEUTRAL_LOCAL_STORE_BY_TYPE,
} from './useCreateStoreNeutral.generated';

/** A store to add; the hook mints its id. */
export type NewStore = Omit<CreateStoreInput, 'id'>;

/** The store a create names: the one on file when it merged, else the new one. */
export interface CreatedStore {
  id: string;
  name: string;
}

/**
 * Adds a store local-first: the id is minted here and the store written to
 * the cache before the create fires, so a pick names it at once and a queued
 * create replays under it. A shop already on file merges, and the minted id
 * goes on naming it wherever a store id is taken.
 */
export function useCreateStore() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [create] = useMutation(CreateStoreDocument, {
    context: { localFirst: true },
  });

  const createStore = async (store: NewStore): Promise<CreatedStore | null> => {
    const id = generateEntityId();
    // Outside the try: a value block inside one bails the React Compiler.
    const address = store.address ?? null;
    try {
      writeLocalEntity(client.cache, {
        fragment: UseCreateStore_RowFragmentDoc,
        fragmentName: 'useCreateStore_row',
        neutral: NEUTRAL_LOCAL_STORE,
        neutralByType: NEUTRAL_LOCAL_STORE_BY_TYPE,
        known: { __typename: 'Store', id, name: store.name, address },
      });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create store (optimistic)',
      });
    }

    const settled = await settleMutation(
      () => create({ variables: { input: { ...store, id } } }),
      {
        document: CreateStoreDocument,
        fallback: t('errors.generic'),
        onFailed: () => safeEvict(client.cache, 'Store', id),
      },
    );
    if (settled.status === 'failed') return null;
    // Answered: the store on file, merged or new; queued: the minted id.
    const answered = appliedPayload(settled.data)?.store;
    return answered
      ? { id: answered.id, name: answered.name }
      : { id, name: store.name };
  };

  return { createStore };
}
