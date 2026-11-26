import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#i18n';
import { errorService } from '#services/errorService';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { Settled } from '#apollo/utils/settleMutation';
import { storeChoiceTarget, type StoreChoice } from '#domain/stores';
import type {
  PinUsualStoreInputs,
  UsualStoreInputs,
} from '#features/catalog/offline/localWrites';
import {
  addUsualStoreWrite,
  removeUsualStoreWrite,
  updateUsualStoreWrite,
} from '#features/catalog/offline/localWrites';

/**
 * A household's usual-store writes (`homeId` null: the caller's own), each
 * shown at once and sent local-first, in the order they were made. Each answers
 * the whole list, which replaces the cached one. Each resolves false only when
 * the write failed, which settle has reported.
 */
export function useUsualStoreWrites(homeId: string | null) {
  const { t } = useTranslation();
  const client = useApolloClient();

  // A household keeps at most 20 it added or pinned.
  const overTheLimit = {
    VALIDATION_FAILED: {
      title: t('usualStores.limitTitle'),
      body: t('usualStores.limitBody'),
    },
  };
  const fallback = t('usualStores.saveFailed');
  const addStore = useLocalWrite(addUsualStoreWrite, {
    fallback,
    copy: overTheLimit,
  });
  const updateStore = useLocalWrite(updateUsualStoreWrite, {
    fallback,
    copy: overTheLimit,
  });
  const removeStore = useLocalWrite(removeUsualStoreWrite, {
    fallback,
    removal: true,
  });

  const kept = async (sending: Promise<Settled<unknown>>) => {
    const settled = await sending;
    // "Could you save?" compares the list at these stores. It is another
    // feature's query, so it is named rather than imported.
    if (settled.status === 'applied') {
      void client
        .refetchQueries({ include: ['ListSavings'] })
        .catch((error: unknown) => {
          errorService.reportError(error, {
            operation: 'Refresh list savings',
          });
        });
    }
    return settled.status !== 'failed';
  };

  const inputsOf = (choice: StoreChoice): UsualStoreInputs => ({
    homeId,
    choice,
    now: new Date().toISOString(),
  });

  return {
    add: (choice: StoreChoice) =>
      kept(
        addStore.send(
          { input: { homeId, target: storeChoiceTarget(choice) } },
          inputsOf(choice),
        ),
      ),
    setPinned: (choice: StoreChoice, pinned: boolean) => {
      const inputs: PinUsualStoreInputs = { ...inputsOf(choice), pinned };
      return kept(
        updateStore.send(
          { input: { homeId, target: storeChoiceTarget(choice), pinned } },
          inputs,
        ),
      );
    },
    remove: (choice: StoreChoice) =>
      kept(
        removeStore.send(
          { input: { homeId, target: storeChoiceTarget(choice) } },
          inputsOf(choice),
        ),
      ),
  };
}
