import { useApolloClient, useMutation } from '@apollo/client/react';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';
import type { CreateStoreInput } from '#/graphql/generated/schemaTypes';
import type { CreateStoreInputs } from '#features/catalog/offline/localWrites';
import { CreateStoreDocument } from './useCreateStore.generated';

/** A store to add; the hook mints its id. */
export type NewStore = Omit<CreateStoreInput, 'id'>;

/** The store a create names: the one on file when it merged, else the new one. */
export interface CreatedStore {
  id: string;
  name: string;
}

/**
 * Adds a store local-first: its id is minted and the store shows until the
 * server answers, so a pick names it at once and a queued create replays under it.
 * A shop on file merges; the minted id still works wherever a store id goes.
 */
export function useCreateStore() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [create] = useMutation(CreateStoreDocument, {
    context: { localFirst: true },
  });

  const createStore = async (store: NewStore): Promise<CreatedStore | null> => {
    const id = generateEntityId();
    const inputs: CreateStoreInputs = {
      store: { id, name: store.name, address: store.address ?? null },
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreateStoreDocument,
      { input: { ...store, id } },
      write =>
        settleMutation(() => create(write), {
          document: CreateStoreDocument,
          fallback: t('errors.generic'),
        }),
      inputs,
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
