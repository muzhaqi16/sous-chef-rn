import type { ApolloCache } from '@apollo/client';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { UseCreateStore_RowFragmentDoc } from '#features/catalog/hooks/useCreateStore.generated';
import {
  NEUTRAL_LOCAL_STORE,
  NEUTRAL_LOCAL_STORE_BY_TYPE,
} from '#features/catalog/hooks/useCreateStoreNeutral.generated';

/** What a create states about a store, under the id it minted. */
export type LocalStore = { id: string; name: string; address: string | null };

export function writeLocalStore(cache: ApolloCache, store: LocalStore): void {
  writeLocalEntity(cache, {
    fragment: UseCreateStore_RowFragmentDoc,
    fragmentName: 'useCreateStore_row',
    neutral: NEUTRAL_LOCAL_STORE,
    neutralByType: NEUTRAL_LOCAL_STORE_BY_TYPE,
    known: { __typename: 'Store', ...store },
  });
}
