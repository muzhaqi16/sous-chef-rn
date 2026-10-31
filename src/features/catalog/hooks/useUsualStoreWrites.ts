import type { OperationVariables } from '@apollo/client';
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
import {
  localUsualStore,
  replaceUsualStore,
} from '#features/catalog/cache/usualStores';
import type {
  PinUsualStoreInputs,
  UsualStoreInputs,
} from '#features/catalog/offline/localWrites';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from './useUsualStoreWrites.generated';

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

  const remove = (choice: StoreChoice) =>
    write(
      RemoveUsualStoreDocument,
      { input: { homeId, target: storeChoiceTarget(choice) } },
      removeStore,
      inputsOf(choice),
      { removal: true },
    );

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
     * at once with no write of its own. Its undo puts the list back, and once
     * \`recorded\` settles true (answered, or queued ahead) removes it there.
     */
    learn: (choice: StoreChoice, recorded: Promise<boolean>) => {
      const key = storeChoiceKey(choice);
      const before = replaceUsualStore(
        cache,
        homeId,
        key,
        held =>
          held ??
          localUsualStore(
            cache,
            choice,
            UsualStoreSource.Receipt,
            new Date().toISOString(),
          ),
      );
      return async () => {
        replaceUsualStore(cache, homeId, key, () => before ?? null);
        if (await recorded) await remove(choice);
      };
    },
  };
}
