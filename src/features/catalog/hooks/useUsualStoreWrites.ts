import type { ApolloCache, OperationVariables } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { useTranslation } from '#/i18n';
import {
  pendingWritesOf,
  type LocalWriteSend,
} from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import type { LocalInputs } from '#/apollo/pendingWrites/types';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  storeChoiceKey,
  storeChoiceTarget,
  type StoreChoice,
} from '#domain/stores';
import { serverListsStore } from '#features/catalog/cache/usualStores';
import type {
  PinUsualStoreInputs,
  UsualStoreInputs,
} from '#features/catalog/offline/localWrites';
import { UsualStoresDocument } from './useUsualStores.generated';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from './useUsualStoreWrites.generated';

/**
 * The layers showing a store the server adds itself, by household and store.
 * No write of the device's ends one, so a removal of the store has to, or the
 * layer would put it back once the removal is answered.
 */
const learnedLayers = new WeakMap<ApolloCache, Map<string, string>>();

const learnedLayersOf = (cache: ApolloCache): Map<string, string> => {
  const known = learnedLayers.get(cache);
  if (known) return known;
  const created = new Map<string, string>();
  learnedLayers.set(cache, created);
  return created;
};

/**
 * A household's usual-store writes (\`homeId\` null: the caller's own), each
 * shown at once and sent local-first, in the order they were made. Each answers
 * the whole list, which replaces the cached one. Each resolves false only when
 * the write failed, which settle has reported.
 */
export function useUsualStoreWrites(homeId: string | null) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { cache } = client;
  const [addStore] = useMutation(AddUsualStoreDocument, {
    context: { localFirst: true },
  });
  const [updateStore] = useMutation(UpdateUsualStoreDocument, {
    context: { localFirst: true },
  });
  const [removeStore] = useMutation(RemoveUsualStoreDocument, {
    context: { localFirst: true },
  });

  // A household keeps at most 20 it added or pinned.
  const overTheLimit = {
    VALIDATION_FAILED: {
      title: t('usualStores.limitTitle'),
      body: t('usualStores.limitBody'),
    },
  };

  const write = async <TVariables extends OperationVariables>(
    document: DocumentNode,
    variables: TVariables,
    mutate: (
      send: LocalWriteSend<TVariables>,
    ) => Promise<{ data?: unknown; error?: unknown }>,
    inputs: LocalInputs,
    options: Pick<SettleOptions, 'copy' | 'removal'>,
  ) => {
    const settled = await pendingWritesOf(cache).send(
      document,
      variables,
      send =>
        settleMutation(() => mutate(send), {
          ...options,
          document,
          fallback: t('usualStores.saveFailed'),
        }),
      inputs,
    );
    // "Could you save?" compares the list at these stores. It is another
    // feature's query, so it is named rather than imported.
    if (settled.status === 'applied') {
      void client.refetchQueries({ include: ['ListSavings'] });
    }
    return settled.status !== 'failed';
  };

  const inputsOf = (choice: StoreChoice): UsualStoreInputs => ({
    homeId,
    choice,
    now: new Date().toISOString(),
  });

  const endLearned = (key: string) => {
    const layers = learnedLayersOf(cache);
    const layerKey = `${homeId ?? 'own'}:${key}`;
    const id = layers.get(layerKey);
    if (!id) return;
    layers.delete(layerKey);
    pendingWritesOf(cache).drop(id);
  };

  const remove = (choice: StoreChoice) => {
    endLearned(storeChoiceKey(choice));
    return write(
      RemoveUsualStoreDocument,
      { input: { homeId, target: storeChoiceTarget(choice) } },
      removeStore,
      inputsOf(choice),
      { removal: true },
    );
  };

  return {
    add: (choice: StoreChoice) =>
      write(
        AddUsualStoreDocument,
        { input: { homeId, target: storeChoiceTarget(choice) } },
        addStore,
        inputsOf(choice),
        { copy: overTheLimit },
      ),
    setPinned: (choice: StoreChoice, pinned: boolean) => {
      const inputs: PinUsualStoreInputs = { ...inputsOf(choice), pinned };
      return write(
        UpdateUsualStoreDocument,
        { input: { homeId, target: storeChoiceTarget(choice), pinned } },
        updateStore,
        inputs,
        { copy: overTheLimit },
      );
    },
    remove: (choice: StoreChoice) => remove(choice),
    /**
     * A store the household's activity adds on the server, a receipt's, shown
     * at once as a layer with no write of its own, until the server's list
     * names it; a queued check-in keeps it showing. Its undo takes the layer
     * off, and once \`recorded\` settles true (answered, or queued ahead)
     * removes the store there.
     */
    learn: (choice: StoreChoice, recorded: Promise<boolean>) => {
      const key = storeChoiceKey(choice);
      const pending = pendingWritesOf(cache);
      const { id } = pending.begin(
        AddUsualStoreDocument,
        { input: { homeId, target: storeChoiceTarget(choice) } },
        { ...inputsOf(choice), addedVia: UsualStoreSource.Receipt },
      );
      learnedLayersOf(cache).set(`${homeId ?? 'own'}:${key}`, id);
      void recorded.then(async landed => {
        if (!landed) return;
        await client
          .query({
            query: UsualStoresDocument,
            variables: { homeId },
            fetchPolicy: 'network-only',
          })
          .catch(() => undefined);
        if (serverListsStore(cache, homeId, key)) endLearned(key);
      });
      return async () => {
        endLearned(key);
        if (await recorded) await remove(choice);
      };
    },
  };
}
