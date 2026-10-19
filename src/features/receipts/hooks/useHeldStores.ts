import { useFragment } from '@apollo/client/react';
import { useAppStore } from '#store/useAppStore';
import type { HeldStore } from '../utils/unlocatedStoreNamed';
import {
  UseHeldStores_ListFragmentDoc,
  UseHeldStores_StoreFragmentDoc,
} from './useHeldStores.generated';

/**
 * The stores the device holds without asking the API: the store list warmed
 * for offline pickers, and the shop list `listId` is shopped at, once the
 * cache knows that shop's address.
 */
export function useHeldStores(listId: string | undefined): HeldStore[] {
  const cachedStores = useAppStore(state => state.cachedStores);
  const list = useFragment({
    fragment: UseHeldStores_ListFragmentDoc,
    fragmentName: 'useHeldStores_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  const targetStoreId = list.complete ? list.data.targetStore?.id : undefined;
  const target = useFragment({
    fragment: UseHeldStores_StoreFragmentDoc,
    fragmentName: 'useHeldStores_store',
    from: targetStoreId ? { __typename: 'Store', id: targetStoreId } : null,
  });

  const held = cachedStores.map(store => ({
    id: store.id,
    name: store.name,
    address: store.address ?? null,
    storeNumber: store.storeNumber ?? null,
  }));
  return target.complete ? [...held, target.data] : held;
}
