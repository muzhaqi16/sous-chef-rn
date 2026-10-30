import type { ApolloCache } from '@apollo/client';
import { useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  settleMutation,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  UsualStoreSource,
  type UsualStoreTargetInput,
} from '#/graphql/generated/schemaTypes';
import {
  storeChoiceKey,
  storeChoiceTarget,
  type StoreChoice,
} from '#domain/stores';
import {
  keepUsualStores,
  localUsualStore,
  replaceUsualStore,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from './useUsualStoreWrites.generated';

type Change = (held: UsualStoreEntry | undefined) => UsualStoreEntry | null;

/**
 * One screen's writes in the order they were made: each is sent once the one
 * before has answered, so two taps never land out of order, and an answer is
 * shown only when no later tap waits, whose own answer holds both.
 */
function writeOrder() {
  let last: Promise<unknown> = Promise.resolve();
  let unsettled = 0;
  return {
    after<T>(write: () => Promise<T>): Promise<T> {
      unsettled += 1;
      const next = last.then(write, write);
      last = next.then(
        () => {
          unsettled -= 1;
        },
        () => {
          unsettled -= 1;
        },
      );
      return next;
    },
    isLatest: () => unsettled <= 1,
  };
}

/**
 * A household's usual-store writes (`homeId` null: the caller's own), each
 * shown at once and sent local-first. Each answers the whole list, which
 * replaces the cached one; a failure puts back the one entry it changed.
 * Each resolves false only when the write failed, which settle has reported.
 */
export function useUsualStoreWrites(homeId: string | null) {
  const { t } = useTranslation();
  const { cache } = useApolloClient();
  // Made once, for this hook's life: a screen that leaves takes it along.
  const [order] = useState(writeOrder);
  const answer = (
    into: ApolloCache,
    usualStores: readonly UsualStoreEntry[] | undefined,
  ) => {
    if (usualStores && order.isLatest()) {
      writeUsualStores(into, homeId, usualStores);
    }
  };
  const [addStore] = useMutation(AddUsualStoreDocument, {
    context: { localFirst: true },
    update: (into, { data }) => answer(into, appliedPayload(data)?.usualStores),
  });
  const [updateStore] = useMutation(UpdateUsualStoreDocument, {
    context: { localFirst: true },
    update: (into, { data }) => answer(into, appliedPayload(data)?.usualStores),
  });
  // A removal's answer names the list by its keys only.
  const [removeStore] = useMutation(RemoveUsualStoreDocument, {
    context: { localFirst: true },
    update: (into, { data }) => {
      const kept = appliedPayload(data)?.usualStores;
      if (kept && order.isLatest()) {
        keepUsualStores(
          into,
          homeId,
          kept.map(entry => entry.id),
        );
      }
    },
  });

  // A household keeps at most 20 it added or pinned.
  const overTheLimit = {
    VALIDATION_FAILED: {
      title: t('usualStores.limitTitle'),
      body: t('usualStores.limitBody'),
    },
  };

  const write = (
    choice: StoreChoice,
    change: Change,
    send: (
      target: UsualStoreTargetInput,
    ) => Promise<{ data?: unknown; error?: unknown }>,
    options: Pick<SettleOptions, 'document' | 'copy' | 'removal'>,
  ) => {
    const key = storeChoiceKey(choice);
    const before = replaceUsualStore(cache, homeId, key, change);
    return order
      .after(() =>
        settleMutation(() => send(storeChoiceTarget(choice)), {
          ...options,
          fallback: t('usualStores.saveFailed'),
          onFailed: () => {
            replaceUsualStore(cache, homeId, key, () => before ?? null);
          },
        }),
      )
      .then(settled => settled.status !== 'failed');
  };

  const remove = (choice: StoreChoice) =>
    write(
      choice,
      () => null,
      target => removeStore({ variables: { input: { homeId, target } } }),
      { document: RemoveUsualStoreDocument, removal: true },
    );

  return {
    add: (choice: StoreChoice) =>
      write(
        choice,
        held => held ?? localUsualStore(cache, choice, UsualStoreSource.Picked),
        target => addStore({ variables: { input: { homeId, target } } }),
        { document: AddUsualStoreDocument, copy: overTheLimit },
      ),
    setPinned: (choice: StoreChoice, pinned: boolean) =>
      write(
        choice,
        held =>
          held ? { ...held, pinned, compared: pinned || held.compared } : null,
        target =>
          updateStore({ variables: { input: { homeId, target, pinned } } }),
        { document: UpdateUsualStoreDocument, copy: overTheLimit },
      ),
    remove: (choice: StoreChoice) => remove(choice),
    /**
     * A store the household's activity adds on the server, a receipt's, shown
     * at once with no write of its own. Its undo puts the list back, and once
     * `recorded` settles true (answered, or queued ahead) removes it there.
     */
    learn: (choice: StoreChoice, recorded: Promise<boolean>) => {
      const key = storeChoiceKey(choice);
      const before = replaceUsualStore(
        cache,
        homeId,
        key,
        held =>
          held ?? localUsualStore(cache, choice, UsualStoreSource.Receipt),
      );
      return async () => {
        replaceUsualStore(cache, homeId, key, () => before ?? null);
        if (await recorded) await remove(choice);
      };
    },
  };
}
